// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CLIENT_ID = Deno.env.get("QUICKBOOKS_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("QUICKBOOKS_CLIENT_SECRET") ?? "";
const REDIRECT_URI = Deno.env.get("QUICKBOOKS_REDIRECT_URI") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// QuickBooks Online OAuth 2.0 endpoints
const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // === Start OAuth flow: generate authorize URL ===
    if (action === "start") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const authed = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await authed.auth.getUser();
      const user = userData?.user;
      if (!user) return json({ error: "Unauthorized" }, 401);

      const propertyId = url.searchParams.get("property_id");
      const environment = url.searchParams.get("environment") ?? "sandbox";
      const returnUrl = url.searchParams.get("return_url") ?? "";
      if (!propertyId) return json({ error: "property_id required" }, 400);

      if (!CLIENT_ID || CLIENT_ID.startsWith("DUMMY_")) {
        return json(
          { error: "QuickBooks Client ID not configured. Add real credentials in project secrets." },
          400,
        );
      }

      // State carries property + user + env + return URL, signed as base64 JSON
      const state = btoa(
        JSON.stringify({
          p: propertyId,
          u: user.id,
          e: environment,
          r: returnUrl,
          n: crypto.randomUUID(),
        }),
      );

      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        scope: "com.intuit.quickbooks.accounting",
        redirect_uri: REDIRECT_URI,
        state,
      });

      return json({ authorize_url: `${AUTH_URL}?${params.toString()}` });
    }

    // === OAuth callback from Intuit ===
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const realmId = url.searchParams.get("realmId");
    const errorParam = url.searchParams.get("error");

    if (errorParam) return htmlClose(`QuickBooks connection cancelled: ${errorParam}`);
    if (!code || !stateRaw || !realmId) return htmlClose("Missing OAuth callback parameters");

    let state: any;
    try {
      state = JSON.parse(atob(stateRaw));
    } catch {
      return htmlClose("Invalid state");
    }
    const propertyId = state.p as string;
    const userId = state.u as string;
    const environment = (state.e as string) ?? "sandbox";
    const returnUrl = (state.r as string) ?? "";

    // Exchange code for tokens
    const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return htmlClose(`Token exchange failed: ${errText.slice(0, 200)}`);
    }
    const tokens = await tokenRes.json();

    // Try to fetch company info for display name
    const apiBase = environment === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";
    let companyName: string | null = null;
    try {
      const infoRes = await fetch(
        `${apiBase}/v3/company/${realmId}/companyinfo/${realmId}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${tokens.access_token}`,
          },
        },
      );
      if (infoRes.ok) {
        const info = await infoRes.json();
        companyName = info?.CompanyInfo?.CompanyName ?? null;
      }
    } catch (_) { /* ignore */ }

    const now = new Date();
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await admin.from("accounting_integrations").upsert(
      {
        property_id: propertyId,
        provider: "quickbooks",
        environment,
        realm_id: realmId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(now.getTime() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
        refresh_token_expires_at: new Date(
          now.getTime() + (tokens.x_refresh_token_expires_in ?? 8726400) * 1000,
        ).toISOString(),
        company_name: companyName,
        is_active: true,
        connected_at: now.toISOString(),
        connected_by: userId,
      },
      { onConflict: "property_id,provider" },
    );

    await admin.from("accounting_sync_log").insert({
      property_id: propertyId,
      provider: "quickbooks",
      sync_type: "connect",
      status: "success",
      external_ref: realmId,
      synced_by: userId,
    });

    return htmlClose(
      `Connected to ${companyName ?? "QuickBooks"} successfully.`,
      returnUrl,
      true,
    );
  } catch (e) {
    console.error("quickbooks-oauth error", e);
    return htmlClose(`Unexpected error: ${(e as Error).message}`);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function htmlClose(message: string, returnUrl = "", success = false) {
  const color = success ? "#059669" : "#dc2626";
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>QuickBooks</title>
<style>body{font-family:system-ui;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#e2e8f0;padding:24px}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:32px;max-width:480px;text-align:center}
h1{color:${color};margin:0 0 12px;font-size:20px}p{margin:0 0 16px;line-height:1.5;color:#94a3b8}
a{color:#38bdf8}</style></head><body><div class="card">
<h1>${success ? "Connected" : "Something went wrong"}</h1>
<p>${escapeHtml(message)}</p>
${returnUrl ? `<p><a href="${escapeHtml(returnUrl)}">Return to app</a></p>` : ""}
<script>setTimeout(function(){try{window.close();}catch(e){}${returnUrl ? `if(!window.closed){window.location.href=${JSON.stringify(returnUrl)};}` : ""}}, 1500);</script>
</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
