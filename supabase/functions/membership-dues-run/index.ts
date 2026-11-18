// Membership dues run: find members due for renewal, create dues invoices, and
// attempt Adyen recurring charges using stored tokens. PCI SAQ A - no raw card data.
import { installConsoleRedaction, safeLog, safeError } from "../_shared/pci.ts";
installConsoleRedaction();
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADYEN_API_KEY = Deno.env.get("ADYEN_API_KEY") ?? "";
const ADYEN_MERCHANT_ACCOUNT = Deno.env.get("ADYEN_MERCHANT_ACCOUNT") ?? "";
const ADYEN_ENVIRONMENT = (Deno.env.get("ADYEN_ENVIRONMENT") ?? "test").toLowerCase();
const IS_PLACEHOLDER = ADYEN_API_KEY.startsWith("PLACEHOLDER_") || !ADYEN_API_KEY;

function adyenBase() {
  return ADYEN_ENVIRONMENT === "live"
    ? "https://checkout-live.adyen.com/v71"
    : "https://checkout-test.adyen.com/v71";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function periodEnd(start: Date, period: string): Date {
  const d = new Date(start);
  switch (period) {
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "annual": d.setFullYear(d.getFullYear() + 1); break;
    case "lifetime": d.setFullYear(d.getFullYear() + 100); break;
  }
  return d;
}

async function chargeRecurring(shopperRef: string, detailRef: string, amountMinor: number, currency: string, reference: string) {
  const res = await fetch(`${adyenBase()}/payments`, {
    method: "POST",
    headers: { "x-API-key": ADYEN_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: { value: amountMinor, currency },
      reference,
      merchantAccount: ADYEN_MERCHANT_ACCOUNT,
      paymentMethod: { type: "scheme", storedPaymentMethodId: detailRef },
      shopperReference: shopperRef,
      shopperInteraction: "ContAuth",
      recurringProcessingModel: "Subscription",
    }),
  });
  const data = await res.json();
  return { ok: res.ok && (data.resultCode === "Authorised" || data.resultCode === "Received"), data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Find members whose auto-renew is on and are within 3 days of expiry with no pending invoice.
    const soon = new Date(); soon.setDate(soon.getDate() + 3);
    const { data: candidates, error } = await admin
      .from("member_accounts")
      .select("id, program_id, tier_id, organization_id, auto_renew, status, expires_at, adyen_shopper_reference, adyen_recurring_detail_reference, member_number")
      .eq("auto_renew", true)
      .eq("status", "active")
      .lte("expires_at", soon.toISOString());
    if (error) throw error;

    const results: any[] = [];
    for (const m of candidates ?? []) {
      const { data: existing } = await admin
        .from("member_dues_invoices")
        .select("id, status")
        .eq("member_account_id", m.id)
        .in("status", ["pending", "paid"])
        .gte("period_end", new Date().toISOString().slice(0, 10))
        .limit(1);
      if (existing?.length) { results.push({ member: m.member_number, skipped: "invoice_exists" }); continue; }

      const { data: prog } = await admin
        .from("membership_programs")
        .select("dues_amount, currency, billing_period")
        .eq("id", m.program_id).maybeSingle();
      const { data: tier } = m.tier_id
        ? await admin.from("membership_tiers").select("dues_amount_override").eq("id", m.tier_id).maybeSingle()
        : { data: null };

      if (!prog) { results.push({ member: m.member_number, skipped: "no_program" }); continue; }
      const amount = Number((tier as any)?.dues_amount_override ?? prog.dues_amount ?? 0);
      const currency = prog.currency ?? "USD";
      const startDate = m.expires_at ? new Date(m.expires_at) : new Date();
      const endDate = periodEnd(startDate, prog.billing_period);

      const { data: invoice, error: invErr } = await admin
        .from("member_dues_invoices")
        .insert({
          member_account_id: m.id,
          organization_id: m.organization_id,
          amount,
          currency,
          period_start: startDate.toISOString().slice(0, 10),
          period_end: endDate.toISOString().slice(0, 10),
          status: "pending",
          attempted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (invErr || !invoice) { results.push({ member: m.member_number, error: invErr?.message }); continue; }

      if (IS_PLACEHOLDER || !m.adyen_shopper_reference || !m.adyen_recurring_detail_reference) {
        safeLog("dues: no token, invoice created but not charged", m.member_number);
        results.push({ member: m.member_number, invoice_id: invoice.id, charged: false, reason: "no_token" });
        continue;
      }

      try {
        const { ok, data } = await chargeRecurring(
          m.adyen_shopper_reference,
          m.adyen_recurring_detail_reference,
          Math.round(amount * 100),
          currency,
          `DUES-${invoice.id}`,
        );
        if (ok) {
          await admin.from("member_dues_invoices").update({
            status: "paid",
            paid_at: new Date().toISOString(),
            adyen_psp_reference: data.pspReference ?? null,
          }).eq("id", invoice.id);
          // Extend membership
          await admin.from("member_accounts").update({ expires_at: endDate.toISOString() }).eq("id", m.id);
          results.push({ member: m.member_number, invoice_id: invoice.id, charged: true });
        } else {
          await admin.from("member_dues_invoices").update({
            status: "failed",
            failure_reason: data.refusalReason ?? data.resultCode ?? "unknown",
          }).eq("id", invoice.id);
          results.push({ member: m.member_number, invoice_id: invoice.id, charged: false, reason: data.refusalReason });
        }
      } catch (e) {
        safeError("dues charge failed", e);
        await admin.from("member_dues_invoices").update({ status: "failed", failure_reason: "exception" }).eq("id", invoice.id);
      }
    }

    return json({ processed: results.length, results });
  } catch (e) {
    safeError("dues-run error", e);
    return json({ error: "internal" }, 500);
  }
});
