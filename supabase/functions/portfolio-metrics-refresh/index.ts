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
    const { property_ids, from_date, to_date } = body ?? {};
    if (!Array.isArray(property_ids) || !from_date || !to_date) {
      return json({ error: "property_ids[], from_date, to_date required" }, 400);
    }

    const results: unknown[] = [];
    for (const pid of property_ids) {
      const { data, error } = await supabase.rpc("refresh_portfolio_metrics", {
        _property_id: pid, _from: from_date, _to: to_date,
      });
      results.push({ property_id: pid, ok: !error, rows: data, error: error?.message });
    }
    return json({ results });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
