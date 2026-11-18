// PCI SAQ A payment orchestration.
import { installConsoleRedaction } from "../_shared/pci.ts";
installConsoleRedaction();
//
// This function NEVER accepts raw PAN, CVV, or track data. Card capture happens
// on the browser inside Adyen's hosted Drop-in; here we only:
//   - verify the Adyen session/result on the server via API key
//   - persist tokens returned by Adyen (brand, last4, expiry, recurring reference)
//   - record authorizations / captures / refunds against Adyen pspReferences
//
// Any inbound field named `cardNumber`, `pan`, `cvv`, `cvc`, `csc`, or that
// looks like a 13–19 digit number, causes the request to be rejected outright
// (see _shared/pci.ts).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeLog, safeError, assertNoCardData } from "../_shared/pci.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADYEN_API_KEY = Deno.env.get("ADYEN_API_KEY") ?? "";
const ADYEN_ENVIRONMENT = (Deno.env.get("ADYEN_ENVIRONMENT") ?? "test").toLowerCase();
const IS_PLACEHOLDER = ADYEN_API_KEY.startsWith("PLACEHOLDER_");

function adyenBaseUrl(): string {
  return ADYEN_ENVIRONMENT === "live"
    ? "https://checkout-live.adyen.com/v71"
    : "https://checkout-test.adyen.com/v71";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchAdyenSession(sessionId: string, sessionResult?: string) {
  const url = new URL(`${adyenBaseUrl()}/sessions/${sessionId}`);
  if (sessionResult) url.searchParams.set("sessionResult", sessionResult);
  const resp = await fetch(url.toString(), {
    headers: { "x-API-key": ADYEN_API_KEY },
  });
  if (!resp.ok) {
    throw new Error(`Adyen session lookup failed (${resp.status})`);
  }
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "Unauthorized" }, 401);

    const authedClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ success: false, error: "Unauthorized" }, 401);

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    assertNoCardData(body); // hard PCI guard

    const { action, propertyId } = body;
    if (!propertyId) return json({ success: false, error: "propertyId required" }, 400);
    if (!action) return json({ success: false, error: "action required" }, 400);

    safeLog("process-payment invoked", { action, propertyId });

    switch (action) {
      case "record_tokenization":
        return await recordTokenization(service, body);
      case "record_authorization":
        return await recordAuthorization(service, body);
      case "record_sale":
        return await recordSale(service, body);
      case "capture":
        return await capture(service, body);
      case "refund":
        return await refund(service, body);
      case "void":
        return await voidAuth(service, body);
      case "incremental_auth":
        return await incrementalAuth(service, body);
      default:
        return json({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    safeError("process-payment error", { message: (err as Error).message });
    return json({ success: false, error: (err as Error).message ?? "Internal error" }, 500);
  }
});

async function extractCardFromSession(sessionId: string, sessionResult?: string) {
  if (IS_PLACEHOLDER) {
    throw new Error(
      "Adyen is not configured. Add ADYEN_API_KEY, ADYEN_HMAC_KEY, and ADYEN_MERCHANT_ACCOUNT.",
    );
  }
  const s = await fetchAdyenSession(sessionId, sessionResult);
  const payment = s?.paymentResponse ?? s;
  const additional = payment?.additionalData ?? {};
  return {
    resultCode: payment?.resultCode,
    pspReference: payment?.pspReference,
    recurringReference: additional["recurring.recurringDetailReference"] ?? null,
    shopperReference: additional["recurring.shopperReference"] ?? null,
    lastFour: additional["cardSummary"] ?? null,
    brand: additional["paymentMethod"] ?? null,
    expiryMonth: additional["expiryDate"]?.split("/")?.[0] ?? null,
    expiryYear: additional["expiryDate"]?.split("/")?.[1] ?? null,
    cardHolder: additional["cardHolderName"] ?? null,
    amountValue: payment?.amount?.value ?? null,
    currency: payment?.amount?.currency ?? "USD",
  };
}

async function recordTokenization(supabase: any, body: any) {
  const { propertyId, reservationId, ledgerAccountId, guestId, cardSequence = 1, adyenSessionId, adyenSessionResult, source = "pms" } = body;
  if (!adyenSessionId) return json({ success: false, error: "adyenSessionId required" }, 400);

  const info = await extractCardFromSession(adyenSessionId, adyenSessionResult);
  if (info.resultCode !== "Authorised" && info.resultCode !== "Received") {
    return json({ success: false, error: `Adyen result: ${info.resultCode}` }, 400);
  }

  const { data: card, error } = await supabase
    .from("payment_cards")
    .insert({
      property_id: propertyId,
      reservation_id: reservationId,
      ledger_account_id: ledgerAccountId,
      guest_id: guestId,
      card_sequence: cardSequence,
      card_brand: (info.brand ?? "unknown").toLowerCase(),
      last_four_digits: info.lastFour ?? "0000",
      cardholder_name: info.cardHolder ?? "",
      expiry_month: parseInt(info.expiryMonth ?? "1", 10),
      expiry_year: parseInt(info.expiryYear ?? String(new Date().getFullYear()), 10),
      token_status: "active",
      is_mock: false,
      adyen_shopper_reference: info.shopperReference,
      adyen_recurring_reference: info.recurringReference,
      is_primary: cardSequence === 1,
    })
    .select()
    .single();
  if (error) return json({ success: false, error: error.message }, 500);

  await supabase.from("payment_transactions").insert({
    property_id: propertyId,
    reservation_id: reservationId,
    ledger_account_id: ledgerAccountId,
    payment_card_id: card.id,
    amount: 0,
    transaction_type: "tokenization",
    status: "success",
    source,
    is_mock: false,
    adyen_psp_reference: info.pspReference,
  });

  return json({ success: true, cardId: card.id });
}

async function recordAuthorization(supabase: any, body: any) {
  const { propertyId, ledgerAccountId, adyenSessionId, adyenSessionResult, source = "pms" } = body;
  if (!adyenSessionId || !ledgerAccountId) return json({ success: false, error: "adyenSessionId and ledgerAccountId required" }, 400);

  const info = await extractCardFromSession(adyenSessionId, adyenSessionResult);
  if (info.resultCode !== "Authorised") return json({ success: false, error: `Adyen result: ${info.resultCode}` }, 400);

  // Also persist the card if we got a token
  let cardId: string | null = null;
  if (info.recurringReference) {
    const { data: card } = await supabase
      .from("payment_cards")
      .insert({
        property_id: propertyId,
        ledger_account_id: ledgerAccountId,
        card_sequence: 1,
        card_brand: (info.brand ?? "unknown").toLowerCase(),
        last_four_digits: info.lastFour ?? "0000",
        cardholder_name: info.cardHolder ?? "",
        expiry_month: parseInt(info.expiryMonth ?? "1", 10),
        expiry_year: parseInt(info.expiryYear ?? String(new Date().getFullYear()), 10),
        token_status: "active",
        is_mock: false,
        adyen_shopper_reference: info.shopperReference,
        adyen_recurring_reference: info.recurringReference,
      })
      .select()
      .single();
    cardId = card?.id ?? null;
  }

  const amount = (info.amountValue ?? 0) / 100;
  const { data: auth, error } = await supabase
    .from("payment_authorizations")
    .insert({
      property_id: propertyId,
      ledger_account_id: ledgerAccountId,
      payment_card_id: cardId,
      original_amount: amount,
      current_amount: amount,
      captured_amount: 0,
      currency: info.currency,
      status: "active",
      adyen_psp_reference: info.pspReference,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      is_mock: false,
    })
    .select()
    .single();
  if (error) return json({ success: false, error: error.message }, 500);

  await supabase.from("payment_transactions").insert({
    property_id: propertyId,
    ledger_account_id: ledgerAccountId,
    payment_card_id: cardId,
    authorization_id: auth.id,
    amount,
    currency: info.currency,
    transaction_type: "authorization",
    status: "success",
    source,
    is_mock: false,
    adyen_psp_reference: info.pspReference,
  });

  return json({ success: true, authorizationId: auth.id, cardId });
}

async function recordSale(supabase: any, body: any) {
  const { propertyId, reservationId, ledgerAccountId, adyenSessionId, adyenSessionResult, source = "pms" } = body;
  if (!adyenSessionId) return json({ success: false, error: "adyenSessionId required" }, 400);

  const info = await extractCardFromSession(adyenSessionId, adyenSessionResult);
  if (info.resultCode !== "Authorised") return json({ success: false, error: `Adyen result: ${info.resultCode}` }, 400);

  const amount = (info.amountValue ?? 0) / 100;
  const { data: tx, error } = await supabase.from("payment_transactions").insert({
    property_id: propertyId,
    reservation_id: reservationId,
    ledger_account_id: ledgerAccountId,
    amount,
    currency: info.currency,
    transaction_type: "sale",
    status: "success",
    source,
    is_mock: false,
    adyen_psp_reference: info.pspReference,
  }).select().single();
  if (error) return json({ success: false, error: error.message }, 500);

  return json({ success: true, transactionId: tx.id });
}

// --- Server-initiated (MIT) operations use the stored token via Adyen /payments ---

async function capture(supabase: any, body: any) {
  const { authorizationId, amount } = body;
  if (!authorizationId || !amount) return json({ success: false, error: "authorizationId and amount required" }, 400);
  if (IS_PLACEHOLDER) return json({ success: false, error: "Adyen not configured" }, 503);

  const { data: auth } = await supabase.from("payment_authorizations").select("*").eq("id", authorizationId).single();
  if (!auth) return json({ success: false, error: "Authorization not found" }, 404);

  const resp = await fetch(`${adyenBaseUrl()}/payments/${auth.adyen_psp_reference}/captures`, {
    method: "POST",
    headers: { "x-API-key": ADYEN_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      merchantAccount: Deno.env.get("ADYEN_MERCHANT_ACCOUNT"),
      amount: { currency: auth.currency, value: Math.round(amount * 100) },
    }),
  });
  const data = await resp.json();
  if (!resp.ok) return json({ success: false, error: "Adyen capture failed" }, 502);

  const newCaptured = Number(auth.captured_amount ?? 0) + Number(amount);
  const fullyCaptured = newCaptured >= Number(auth.current_amount);
  await supabase.from("payment_authorizations").update({
    captured_amount: newCaptured,
    status: fullyCaptured ? "fully_captured" : "partially_captured",
  }).eq("id", authorizationId);

  const { data: tx } = await supabase.from("payment_transactions").insert({
    property_id: auth.property_id,
    ledger_account_id: auth.ledger_account_id,
    payment_card_id: auth.payment_card_id,
    authorization_id: authorizationId,
    amount,
    currency: auth.currency,
    transaction_type: fullyCaptured ? "capture" : "partial_capture",
    status: "pending", // confirmed via webhook
    is_mock: false,
    adyen_psp_reference: data.pspReference,
  }).select().single();

  return json({ success: true, transactionId: tx?.id, pspReference: data.pspReference });
}

async function refund(supabase: any, body: any) {
  const { transactionId, amount } = body;
  if (!transactionId || !amount) return json({ success: false, error: "transactionId and amount required" }, 400);
  if (IS_PLACEHOLDER) return json({ success: false, error: "Adyen not configured" }, 503);

  const { data: tx } = await supabase.from("payment_transactions").select("*").eq("id", transactionId).single();
  if (!tx) return json({ success: false, error: "Transaction not found" }, 404);

  const resp = await fetch(`${adyenBaseUrl()}/payments/${tx.adyen_psp_reference}/refunds`, {
    method: "POST",
    headers: { "x-API-key": ADYEN_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      merchantAccount: Deno.env.get("ADYEN_MERCHANT_ACCOUNT"),
      amount: { currency: tx.currency, value: Math.round(amount * 100) },
    }),
  });
  const data = await resp.json();
  if (!resp.ok) return json({ success: false, error: "Adyen refund failed" }, 502);

  const { data: refundTx } = await supabase.from("payment_transactions").insert({
    property_id: tx.property_id,
    reservation_id: tx.reservation_id,
    ledger_account_id: tx.ledger_account_id,
    payment_card_id: tx.payment_card_id,
    amount: -Math.abs(amount),
    currency: tx.currency,
    transaction_type: "refund",
    status: "pending",
    is_mock: false,
    adyen_psp_reference: data.pspReference,
  }).select().single();

  return json({ success: true, transactionId: refundTx?.id });
}

async function voidAuth(supabase: any, body: any) {
  const { authorizationId } = body;
  if (!authorizationId) return json({ success: false, error: "authorizationId required" }, 400);
  if (IS_PLACEHOLDER) return json({ success: false, error: "Adyen not configured" }, 503);

  const { data: auth } = await supabase.from("payment_authorizations").select("*").eq("id", authorizationId).single();
  if (!auth) return json({ success: false, error: "Authorization not found" }, 404);

  const resp = await fetch(`${adyenBaseUrl()}/payments/${auth.adyen_psp_reference}/cancels`, {
    method: "POST",
    headers: { "x-API-key": ADYEN_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ merchantAccount: Deno.env.get("ADYEN_MERCHANT_ACCOUNT") }),
  });
  if (!resp.ok) return json({ success: false, error: "Adyen cancel failed" }, 502);

  await supabase.from("payment_authorizations").update({ status: "cancelled" }).eq("id", authorizationId);
  return json({ success: true });
}

async function incrementalAuth(_supabase: any, _body: any) {
  // Adyen /payments/{pspRef}/amountUpdates — implement when needed.
  return json({ success: false, error: "Not implemented" }, 501);
}
