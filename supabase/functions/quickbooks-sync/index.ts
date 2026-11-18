// deno-lint-ignore-file no-explicit-any
// QuickBooks Online sync: fetch chart of accounts, post day-end journal entry, disconnect.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CLIENT_ID = Deno.env.get("QUICKBOOKS_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("QUICKBOOKS_CLIENT_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const authed = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authed.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action;
    const propertyId: string = body.property_id;
    if (!action || !propertyId) return json({ error: "action and property_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify property access via authed client (RLS)
    const { data: propCheck } = await authed
      .from("accounting_integrations")
      .select("id")
      .eq("property_id", propertyId)
      .eq("provider", "quickbooks")
      .maybeSingle();

    // For 'disconnect' or 'fetch_accounts' we need existing integration.
    // For all actions, load integration with service role (bypass RLS after auth check).
    const { data: integration, error: intErr } = await admin
      .from("accounting_integrations")
      .select("*")
      .eq("property_id", propertyId)
      .eq("provider", "quickbooks")
      .maybeSingle();

    if (intErr) return json({ error: intErr.message }, 500);
    if (!integration && action !== "status") return json({ error: "QuickBooks not connected" }, 400);

    // But make sure the caller has visibility (RLS pass via authed client above)
    if (!propCheck && integration) return json({ error: "Forbidden" }, 403);

    if (action === "status") {
      return json({ connected: !!integration?.is_active, integration: integration ?? null });
    }

    if (action === "disconnect") {
      await admin
        .from("accounting_integrations")
        .update({
          is_active: false,
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
        })
        .eq("id", integration!.id);
      await admin.from("accounting_sync_log").insert({
        property_id: propertyId,
        provider: "quickbooks",
        sync_type: "disconnect",
        status: "success",
        synced_by: user.id,
      });
      return json({ ok: true });
    }

    if (action === "set_frequency") {
      const freq: string = body.sync_frequency;
      if (!["manual", "on_dayend", "daily", "weekly"].includes(freq)) {
        return json({ error: "Invalid sync_frequency" }, 400);
      }
      await admin
        .from("accounting_integrations")
        .update({ sync_frequency: freq })
        .eq("id", integration!.id);
      return json({ ok: true, sync_frequency: freq });
    }

    if (action === "list_pending_closes") {
      const lookbackDays = Number(body.lookback_days ?? 30);
      const since = new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);
      const { data: closes } = await admin
        .from("dayend_closes")
        .select("id, close_date, status")
        .eq("property_id", propertyId)
        .gte("close_date", since)
        .order("close_date", { ascending: false });
      const { data: logs } = await admin
        .from("accounting_sync_log")
        .select("dayend_close_id")
        .eq("property_id", propertyId)
        .eq("provider", "quickbooks")
        .eq("sync_type", "post_dayend")
        .eq("status", "success");
      const posted = new Set((logs ?? []).map((l: any) => l.dayend_close_id));
      const pending = (closes ?? []).filter((c: any) => !posted.has(c.id));
      return json({ pending, total_closes: closes?.length ?? 0 });
    }



    // Ensure fresh access token for API actions
    const accessToken = await ensureFreshToken(admin, integration!);
    const apiBase = integration!.environment === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";
    const realmId = integration!.realm_id;

    if (action === "fetch_accounts") {
      const q = "select Id, Name, AccountType, AccountSubType, Classification, Active from Account where Active = true MAXRESULTS 1000";
      const res = await fetch(
        `${apiBase}/v3/company/${realmId}/query?query=${encodeURIComponent(q)}&minorversion=73`,
        {
          headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
        },
      );
      const text = await res.text();
      if (!res.ok) {
        await logSync(admin, propertyId, "fetch_accounts", "failed", null, null, null, text.slice(0, 2000), user.id);
        return json({ error: "QuickBooks fetch failed", detail: text.slice(0, 500) }, 502);
      }
      const parsed = JSON.parse(text);
      const accounts = (parsed?.QueryResponse?.Account ?? []).map((a: any) => ({
        id: a.Id,
        name: a.Name,
        type: a.AccountType,
        sub_type: a.AccountSubType,
        classification: a.Classification,
      }));
      await logSync(admin, propertyId, "fetch_accounts", "success", null, null, { count: accounts.length }, null, user.id);
      return json({ accounts });
    }

    if (action === "post_dayend") {
      const dayendCloseId: string = body.dayend_close_id;
      if (!dayendCloseId) return json({ error: "dayend_close_id required" }, 400);

      // Idempotency: if already posted successfully, return existing
      const { data: existing } = await admin
        .from("accounting_sync_log")
        .select("*")
        .eq("dayend_close_id", dayendCloseId)
        .eq("provider", "quickbooks")
        .eq("sync_type", "post_dayend")
        .eq("status", "success")
        .maybeSingle();
      if (existing) {
        return json({ ok: true, already_posted: true, external_ref: existing.external_ref });
      }

      const { data: close } = await admin
        .from("dayend_closes")
        .select("*")
        .eq("id", dayendCloseId)
        .maybeSingle();
      if (!close) return json({ error: "Day-end close not found" }, 404);

      // Build revenue-by-account breakdown from folio_postings for the close_date
      const nextDay = new Date(new Date(close.close_date).getTime() + 86400000)
        .toISOString().slice(0, 10);

      const { data: ledgerIdsRows } = await admin
        .from("ledger_accounts")
        .select("id")
        .eq("property_id", propertyId);
      const ledgerIds = (ledgerIdsRows ?? []).map((r: any) => r.id);

      const { data: postings } = await admin
        .from("folio_postings")
        .select("posting_type, amount, account_id")
        .in("ledger_account_id", ledgerIds.length ? ledgerIds : ["00000000-0000-0000-0000-000000000000"])
        .gte("posting_date", close.close_date)
        .lt("posting_date", nextDay)
        .eq("is_voided", false);

      // Group by account_id
      const byAccount = new Map<string, { debit: number; credit: number }>();
      let totalRevenue = 0, totalTax = 0, totalPayments = 0, totalRefunds = 0;
      for (const p of postings ?? []) {
        const amt = Number(p.amount) || 0;
        if (p.posting_type === "revenue" || p.posting_type === "room") totalRevenue += amt;
        else if (p.posting_type === "tax") totalTax += amt;
        else if (p.posting_type === "payment") totalPayments += Math.abs(amt);
        else if (p.posting_type === "refund") totalRefunds += Math.abs(amt);

        if (!p.account_id) continue;
        const cur = byAccount.get(p.account_id) ?? { debit: 0, credit: 0 };
        // Revenue/tax => credit; payments => debit (cash); refunds => credit (cash out)
        if (p.posting_type === "payment") cur.debit += Math.abs(amt);
        else if (p.posting_type === "refund") cur.credit += Math.abs(amt);
        else cur.credit += amt;
        byAccount.set(p.account_id, cur);
      }

      // Load account -> qb_account_id mapping
      const accountIds = Array.from(byAccount.keys());
      const { data: accountRows } = await admin
        .from("accounts")
        .select("id, name, qb_account_id, qb_account_name")
        .in("id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"]);
      const accountMap = new Map((accountRows ?? []).map((a: any) => [a.id, a]));

      const unmapped: string[] = [];
      const lines: any[] = [];
      let debitTotal = 0, creditTotal = 0;
      for (const [aid, { debit, credit }] of byAccount) {
        const acc: any = accountMap.get(aid);
        if (!acc?.qb_account_id) {
          if (acc?.name) unmapped.push(acc.name);
          continue;
        }
        if (debit > 0) {
          lines.push({
            DetailType: "JournalEntryLineDetail",
            Amount: round2(debit),
            Description: `${acc.name} (${close.close_date})`,
            JournalEntryLineDetail: {
              PostingType: "Debit",
              AccountRef: { value: acc.qb_account_id, name: acc.qb_account_name ?? acc.name },
            },
          });
          debitTotal += debit;
        }
        if (credit > 0) {
          lines.push({
            DetailType: "JournalEntryLineDetail",
            Amount: round2(credit),
            Description: `${acc.name} (${close.close_date})`,
            JournalEntryLineDetail: {
              PostingType: "Credit",
              AccountRef: { value: acc.qb_account_id, name: acc.qb_account_name ?? acc.name },
            },
          });
          creditTotal += credit;
        }
      }

      if (unmapped.length) {
        const msg = `Cannot post: unmapped accounts — ${Array.from(new Set(unmapped)).join(", ")}`;
        await logSync(admin, propertyId, "post_dayend", "failed", dayendCloseId, null, { unmapped }, msg, user.id);
        return json({ error: msg }, 400);
      }

      if (lines.length === 0) {
        const msg = "No activity to post for this day-end close.";
        await logSync(admin, propertyId, "post_dayend", "failed", dayendCloseId, null, null, msg, user.id);
        return json({ error: msg }, 400);
      }

      // Balance the JE with a plug line to Cash Clearing if debits != credits (should not happen with double-entry, but safety)
      const diff = round2(creditTotal - debitTotal);
      if (Math.abs(diff) > 0.01) {
        const msg = `Journal entry unbalanced by ${diff.toFixed(2)}. Verify account mappings for all posting types.`;
        await logSync(admin, propertyId, "post_dayend", "failed", dayendCloseId, null, { debitTotal, creditTotal }, msg, user.id);
        return json({ error: msg }, 400);
      }

      const jePayload = {
        TxnDate: close.close_date,
        DocNumber: `DAYEND-${close.close_date}`,
        PrivateNote: `PMS Day-End Close ${close.close_date} — Revenue $${totalRevenue.toFixed(2)}, Tax $${totalTax.toFixed(2)}, Payments $${totalPayments.toFixed(2)}, Refunds $${totalRefunds.toFixed(2)}`,
        Line: lines,
      };

      const res = await fetch(
        `${apiBase}/v3/company/${realmId}/journalentry?minorversion=73`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(jePayload),
        },
      );
      const text = await res.text();
      if (!res.ok) {
        await logSync(admin, propertyId, "post_dayend", "failed", dayendCloseId, null, jePayload, text.slice(0, 2000), user.id);
        return json({ error: "QuickBooks post failed", detail: text.slice(0, 500) }, 502);
      }
      const parsed = JSON.parse(text);
      const jeId = parsed?.JournalEntry?.Id ?? null;
      await logSync(admin, propertyId, "post_dayend", "success", dayendCloseId, jeId, { request: jePayload, response: parsed }, null, user.id);
      await admin
        .from("accounting_integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", integration!.id);

      return json({ ok: true, external_ref: jeId, lines: lines.length });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("quickbooks-sync error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function ensureFreshToken(admin: SupabaseClient, integration: any): Promise<string> {
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0;
  if (integration.access_token && expiresAt > Date.now() + 60_000) return integration.access_token;
  if (!integration.refresh_token) throw new Error("No refresh token — reconnect QuickBooks");

  const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: integration.refresh_token,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token refresh failed: ${t.slice(0, 200)}`);
  }
  const tokens = await res.json();
  const now = new Date();
  await admin
    .from("accounting_integrations")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? integration.refresh_token,
      token_expires_at: new Date(now.getTime() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      refresh_token_expires_at: new Date(
        now.getTime() + (tokens.x_refresh_token_expires_in ?? 8726400) * 1000,
      ).toISOString(),
    })
    .eq("id", integration.id);
  return tokens.access_token;
}

async function logSync(
  admin: SupabaseClient,
  propertyId: string,
  syncType: string,
  status: string,
  dayendCloseId: string | null,
  externalRef: string | null,
  payload: unknown,
  errorMessage: string | null,
  userId: string,
) {
  await admin.from("accounting_sync_log").insert({
    property_id: propertyId,
    provider: "quickbooks",
    sync_type: syncType,
    status,
    dayend_close_id: dayendCloseId,
    external_ref: externalRef,
    response_payload: payload as any,
    error_message: errorMessage,
    synced_by: userId,
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
