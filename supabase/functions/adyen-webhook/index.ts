// Adyen async notification webhook. HMAC-verified. Updates payment_authorizations
import { installConsoleRedaction } from "../_shared/pci.ts";
installConsoleRedaction();
// and payment_transactions based on AUTHORISATION / CAPTURE / REFUND events.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeLog, safeError } from "../_shared/pci.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HMAC_KEY_HEX = Deno.env.get("ADYEN_HMAC_KEY") ?? "";
const IS_PLACEHOLDER = HMAC_KEY_HEX.startsWith("PLACEHOLDER_");

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function escapeField(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

// Adyen signing string: pspReference:originalReference:merchantAccountCode:merchantReference:value:currency:eventCode:success
function buildSigningString(item: any): string {
  const nrd = item.NotificationRequestItem ?? item;
  const parts = [
    nrd.pspReference ?? "",
    nrd.originalReference ?? "",
    nrd.merchantAccountCode ?? "",
    nrd.merchantReference ?? "",
    String(nrd.amount?.value ?? ""),
    nrd.amount?.currency ?? "",
    nrd.eventCode ?? "",
    nrd.success ?? "",
  ].map(escapeField);
  return parts.join(":");
}

async function verifyHmac(item: any): Promise<boolean> {
  if (IS_PLACEHOLDER) return false;
  const nrd = item.NotificationRequestItem ?? item;
  const provided = nrd.additionalData?.hmacSignature;
  if (!provided) return false;

  const signingString = buildSigningString(item);
  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(HMAC_KEY_HEX),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingString),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expected === provided;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const items = body?.notificationItems ?? [];

    for (const item of items) {
      const valid = await verifyHmac(item);
      if (!valid) {
        safeError("Rejecting notification with invalid HMAC");
        continue;
      }

      const nrd = item.NotificationRequestItem;
      const eventCode = nrd.eventCode;
      const success = nrd.success === "true";
      const pspRef = nrd.pspReference;
      const originalRef = nrd.originalReference;

      safeLog("Adyen notification", { eventCode, success, pspRef });

      if (eventCode === "AUTHORISATION" && success) {
        await supabase
          .from("payment_authorizations")
          .update({ status: "active", adyen_psp_reference: pspRef })
          .eq("adyen_psp_reference", pspRef);
      } else if (eventCode === "CAPTURE" && success) {
        await supabase
          .from("payment_transactions")
          .update({ status: "success" })
          .eq("adyen_psp_reference", pspRef);
      } else if (eventCode === "REFUND" && success) {
        await supabase
          .from("payment_transactions")
          .update({ status: "success", transaction_type: "refund" })
          .eq("adyen_psp_reference", originalRef);
      } else if (eventCode === "CANCELLATION" || (eventCode === "AUTHORISATION" && !success)) {
        await supabase
          .from("payment_authorizations")
          .update({ status: "cancelled" })
          .eq("adyen_psp_reference", pspRef);
      }
    }

    return new Response("[accepted]", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (err) {
    safeError("adyen-webhook error", { message: (err as Error).message });
    // Return 200 anyway so Adyen doesn't retry-storm on transient issues;
    // we log for investigation.
    return new Response("[accepted]", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
