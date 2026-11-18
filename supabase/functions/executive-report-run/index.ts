import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json().catch(() => ({}));
    const { organization_id, brand_id, region_id, period_start, period_end } = body ?? {};
    if (!organization_id || !period_start || !period_end) {
      return json({ error: "organization_id, period_start, period_end required" }, 400);
    }
    const { data, error } = await supabase.rpc("compute_executive_snapshot", {
      _organization_id: organization_id,
      _brand_id: brand_id ?? null,
      _region_id: region_id ?? null,
      _period_start: period_start,
      _period_end: period_end,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ snapshot_id: data });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
