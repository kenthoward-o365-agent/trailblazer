import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Warehouse export: emits Parquet-friendly JSONL for a property + date range.
// Meant to be consumed by a customer-owned bucket loader (Snowflake / BigQuery / Redshift).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { property_id, from_date, to_date, tables } = body ?? {};
    if (!property_id || !from_date || !to_date) {
      return json({ error: "property_id, from_date, to_date required" }, 400);
    }

    const allowed = new Set(["reservations", "folio_postings", "portfolio_metrics_daily", "payment_transactions"]);
    const targets: string[] = Array.isArray(tables) && tables.length
      ? tables.filter((t: string) => allowed.has(t))
      : Array.from(allowed);

    const summary: Record<string, { rows: number; jsonl_bytes: number; sample?: unknown }> = {};
    for (const table of targets) {
      let q = userClient.from(table).select("*").eq("property_id", property_id);
      if (table === "portfolio_metrics_daily") {
        q = q.gte("stay_date", from_date).lte("stay_date", to_date);
      } else {
        q = q.gte("created_at", from_date).lte("created_at", to_date);
      }
      const { data, error } = await q.limit(5000);
      if (error) { summary[table] = { rows: 0, jsonl_bytes: 0, sample: error.message }; continue; }
      const jsonl = (data ?? []).map((r) => JSON.stringify(r)).join("\n");
      summary[table] = { rows: data?.length ?? 0, jsonl_bytes: jsonl.length, sample: data?.[0] };
    }
    // Real implementation would stream to customer-owned S3 bucket. For now, return a manifest.
    return json({ property_id, from_date, to_date, summary, generated_at: new Date().toISOString() });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
