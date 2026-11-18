import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/hubspot";

async function hs(path: string, init: RequestInit = {}) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
  if (!LOVABLE_API_KEY || !HUBSPOT_API_KEY) {
    throw new Error("HubSpot connector is not connected. Ask an admin to link it under Connectors.");
  }
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": HUBSPOT_API_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HubSpot ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Verify caller is a super admin (internal Trailblazer staff)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await supabase.rpc("is_super_admin");
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { organization_id } = await req.json();
    if (!organization_id) throw new Error("organization_id required");

    const { data: org, error: orgErr } = await supabase
      .from("organizations").select("*").eq("id", organization_id).single();
    if (orgErr || !org) throw new Error("Organization not found");

    const { data: sub } = await supabase
      .from("subscriptions").select("*").eq("organization_id", organization_id).maybeSingle();

    // Compute MRR
    const cycleFactor = sub?.billing_cycle === "annual" ? 1 / 12 : 1;
    const mrr = sub
      ? (sub.pricing_model === "flat"
          ? Number(sub.flat_amount ?? 0) * cycleFactor
          : Number(sub.price_per_site ?? 0) * (sub.max_sites ?? 0) * cycleFactor)
      : 0;

    // Upsert company
    const companyProps = {
      name: org.name,
      trailblazer_client_number: String(org.client_number ?? ""),
      trailblazer_payment_status: org.payment_status,
    };
    let companyId: string | null = org.hubspot_company_id ?? null;
    if (companyId) {
      await hs(`/crm/v3/objects/companies/${companyId}`, {
        method: "PATCH", body: JSON.stringify({ properties: companyProps }),
      });
    } else {
      const created = await hs(`/crm/v3/objects/companies`, {
        method: "POST", body: JSON.stringify({ properties: companyProps }),
      });
      companyId = created.id;
      await supabase.from("organizations").update({ hubspot_company_id: companyId }).eq("id", organization_id);
    }

    // Upsert deal for the subscription contract
    let dealId: string | null = sub?.hubspot_deal_id ?? null;
    if (sub) {
      const dealProps: Record<string, string> = {
        dealname: `${org.name} — Trailblazer PMS`,
        amount: String((mrr * 12).toFixed(2)),
        dealstage: sub.suspended_at ? "closedlost" : "closedwon",
        pipeline: "default",
      };
      if (sub.contract_start_date) dealProps.closedate = new Date(sub.contract_start_date).toISOString();
      if (sub.contract_end_date) dealProps.trailblazer_contract_end_date = sub.contract_end_date;
      if (sub.contract_start_date) dealProps.trailblazer_contract_start_date = sub.contract_start_date;

      if (dealId) {
        await hs(`/crm/v3/objects/deals/${dealId}`, {
          method: "PATCH", body: JSON.stringify({ properties: dealProps }),
        });
      } else {
        const created = await hs(`/crm/v3/objects/deals`, {
          method: "POST",
          body: JSON.stringify({
            properties: dealProps,
            associations: companyId ? [{
              to: { id: companyId },
              types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 5 }],
            }] : [],
          }),
        });
        dealId = created.id;
      }
      await supabase.from("subscriptions").update({
        hubspot_deal_id: dealId,
        hubspot_last_synced_at: new Date().toISOString(),
      }).eq("id", sub.id);
    }

    return new Response(JSON.stringify({ ok: true, hubspot_company_id: companyId, hubspot_deal_id: dealId, mrr }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("hubspot-sync-customer error", e);
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
