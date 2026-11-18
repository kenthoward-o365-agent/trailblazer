// Runs every minute (via pg_cron). Finds due TrailGuide Items, advances
// their next_run_at based on schedule_config, and invokes trailguide-item-run.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();

    const { data: items } = await admin
      .from("trailguide_items")
      .select("*")
      .eq("is_active", true)
      .in("schedule_type", ["preset", "cron"])
      .lte("next_run_at", now.toISOString());

    const dispatched: string[] = [];
    for (const item of items || []) {
      const next = computeNext(item, now);
      await admin.from("trailguide_items").update({ next_run_at: next.toISOString() }).eq("id", item.id);
      // Fire and forget
      fetch(`${SUPABASE_URL}/functions/v1/trailguide-item-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ item_id: item.id, triggered_by: "scheduled" }),
      }).catch((e) => console.error("dispatch", item.id, e));
      dispatched.push(item.id);
    }
    return new Response(JSON.stringify({ ok: true, dispatched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("dispatcher", e);
    return new Response(JSON.stringify({ error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function computeNext(item: any, from: Date): Date {
  const cfg = item.schedule_config || {};
  if (item.schedule_type === "preset") {
    // { frequency: 'daily'|'weekly'|'monthly', hour, minute, weekday? (0-6, sun=0), day_of_month? }
    const freq = cfg.frequency || "daily";
    const h = Number(cfg.hour ?? 9);
    const m = Number(cfg.minute ?? 0);
    const next = new Date(from);
    next.setUTCSeconds(0, 0);
    next.setUTCHours(h, m, 0, 0);
    if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
    if (freq === "weekly") {
      const target = Number(cfg.weekday ?? 1);
      while (next.getUTCDay() !== target) next.setUTCDate(next.getUTCDate() + 1);
    } else if (freq === "monthly") {
      const dom = Math.min(28, Number(cfg.day_of_month ?? 1));
      next.setUTCDate(dom);
      if (next <= from) next.setUTCMonth(next.getUTCMonth() + 1);
    }
    return next;
  }
  if (item.schedule_type === "cron") {
    // v1: naive — bump by 1 hour if we can't parse. Users can rely on preset for now.
    const next = new Date(from);
    next.setUTCMinutes(next.getUTCMinutes() + 60);
    return next;
  }
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
