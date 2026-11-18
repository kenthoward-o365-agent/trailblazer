// Creates an Adyen Checkout Session so the browser Drop-in can capture card
import { installConsoleRedaction } from "../_shared/pci.ts";
installConsoleRedaction();
// data directly against Adyen. PAN NEVER touches our origin — this is the
// PCI SAQ A entry point.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeLog, safeError, assertNoCardData } from "../_shared/pci.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADYEN_API_KEY = Deno.env.get("ADYEN_API_KEY") ?? "";
const ADYEN_MERCHANT_ACCOUNT = Deno.env.get("ADYEN_MERCHANT_ACCOUNT") ?? "";
const ADYEN_ENVIRONMENT = (Deno.env.get("ADYEN_ENVIRONMENT") ?? "test").toLowerCase();
const IS_PLACEHOLDER = ADYEN_API_KEY.startsWith("PLACEHOLDER_");

function adyenBaseUrl(): string {
  return ADYEN_ENVIRONMENT === "live"
    ? "https://checkout-live.adyen.com/v71"
    : "https://checkout-test.adyen.com/v71";
}

function adyenClientEnv(): "test" | "live" {
  return ADYEN_ENVIRONMENT === "live" ? "live" : "test";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // AuthN — this endpoint MUST be called by an authenticated staff user.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    assertNoCardData(body);

    const {
      propertyId,
      amount = 0, // zero-auth for tokenization
      currency = "USD",
      reference,
      shopperReference,
      reservationId,
      mode = "tokenize", // 'tokenize' | 'authorize' | 'sale'
      returnUrl,
    } = body ?? {};

    if (!propertyId) return json({ error: "propertyId is required" }, 400);

    // Property access check via RLS
    const { data: property, error: propErr } = await supabase
      .from("properties")
      .select("id, payment_gateway_mode")
      .eq("id", propertyId)
      .maybeSingle();
    if (propErr || !property) return json({ error: "Property not found" }, 404);

    if (IS_PLACEHOLDER || !ADYEN_MERCHANT_ACCOUNT) {
      return json({
        error: "adyen_not_configured",
        message:
          "Adyen credentials are placeholders. Add ADYEN_API_KEY, ADYEN_HMAC_KEY, and ADYEN_MERCHANT_ACCOUNT to enable card capture.",
      }, 503);
    }

    const sessionReference = reference ??
      `${mode}-${propertyId}-${crypto.randomUUID()}`;

    const payload: Record<string, unknown> = {
      merchantAccount: ADYEN_MERCHANT_ACCOUNT,
      reference: sessionReference,
      amount: {
        currency,
        value: Math.round(Number(amount) * 100),
      },
      returnUrl: returnUrl ?? "https://example.com/return",
      countryCode: "US",
      shopperReference: shopperReference ?? `guest-${propertyId}`,
      metadata: {
        propertyId,
        reservationId: reservationId ?? "",
        mode,
        initiatedBy: userData.user.id,
      },
    };

    // For tokenize / future MIT charges, ask Adyen to store the payment method.
    if (mode === "tokenize" || mode === "authorize") {
      payload.storePaymentMethodMode = "askForConsent";
      payload.recurringProcessingModel = "CardOnFile";
    }

    const resp = await fetch(`${adyenBaseUrl()}/sessions`, {
      method: "POST",
      headers: {
        "x-API-key": ADYEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      safeError("Adyen /sessions failed", { status: resp.status, body: raw });
      return json({ error: "adyen_error", status: resp.status }, 502);
    }

    const session = JSON.parse(raw);
    safeLog("Adyen session created", { id: session.id, reference: sessionReference });

    return json({
      id: session.id,
      sessionData: session.sessionData,
      clientKey: session.clientKey, // returned by Adyen when generated per-session
      environment: adyenClientEnv(),
      reference: sessionReference,
    });
  } catch (err) {
    safeError("adyen-session error", { message: (err as Error).message });
    return json({ error: "internal_error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
