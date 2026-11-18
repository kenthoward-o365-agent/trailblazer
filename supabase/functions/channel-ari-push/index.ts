import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { channelAdapters, type ChannelCode, type AriUpdate } from "../_shared/channels/adapters.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: { channel_id?: string; property_id?: string; limit?: number } = {};
  try { if (req.method === "POST") body = await req.json(); } catch { /* cron may send empty */ }
  const limit = Math.min(body.limit ?? 200, 500);

  // Fetch pending queue rows
  let q = supabase
    .from("channel_ari_queue")
    .select("id, channel_id, property_id, site_type_id, stay_date")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (body.channel_id) q = q.eq("channel_id", body.channel_id);
  if (body.property_id) q = q.eq("property_id", body.property_id);
  const { data: queue, error: qErr } = await q;
  if (qErr) return json({ error: qErr.message }, 500);
  if (!queue?.length) return json({ ok: true, processed: 0 });

  // Group by channel for efficient dispatch
  const byChannel = new Map<string, typeof queue>();
  for (const row of queue) {
    const arr = byChannel.get(row.channel_id) ?? [];
    arr.push(row);
    byChannel.set(row.channel_id, arr);
  }

  let totalSent = 0;
  let totalFailed = 0;

  for (const [channelId, rows] of byChannel) {
    // Load channel
    const { data: channel } = await supabase.from("channels").select("*").eq("id", channelId).maybeSingle();
    if (!channel || !channel.is_enabled) {
      await supabase.from("channel_ari_queue").update({ status: "failed", last_error: "channel disabled" })
        .in("id", rows.map((r) => r.id));
      totalFailed += rows.length;
      continue;
    }

    // Mark sending
    await supabase.from("channel_ari_queue").update({ status: "sending" }).in("id", rows.map((r) => r.id));

    // Build updates
    const updates: (AriUpdate & { queue_id: string })[] = [];
    for (const row of rows) {
      const exposed = await computeExposedAvailability(supabase, {
        property_id: row.property_id,
        channel_id: row.channel_id,
        site_type_id: row.site_type_id,
        stay_date: row.stay_date,
      });
      const mapping = await getSiteTypeMapping(supabase, row.channel_id, row.site_type_id);
      const ratePlan = await getPrimaryRatePlan(supabase, row.channel_id);
      const rateAmount = await getRateAmount(supabase, row.property_id, row.site_type_id, row.stay_date);
      if (!mapping) continue;
      updates.push({
        queue_id: row.id,
        external_room_type_code: mapping.external_room_type_code,
        external_rate_plan_code: ratePlan?.external_rate_plan_code ?? null,
        stay_date: row.stay_date,
        available_count: exposed,
        rate_amount: rateAmount,
        currency: channel.currency,
      });
    }

    const adapter = channelAdapters[channel.channel_code as ChannelCode];
    const t0 = Date.now();
    const result = await adapter.pushAri(
      {
        channel_code: channel.channel_code,
        hotel_id: channel.hotel_id,
        credentials_ref: channel.credentials_ref,
        mock_mode: channel.mock_mode,
      },
      updates.map(({ queue_id: _q, ...u }) => u)
    );

    // Update queue rows
    if (result.ok) {
      await supabase.from("channel_ari_queue")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .in("id", updates.map((u) => u.queue_id));
      await supabase.from("channels").update({ last_ari_sync_at: new Date().toISOString(), status: "connected", last_error: null }).eq("id", channelId);
      totalSent += updates.length;
    } else {
      await supabase.from("channel_ari_queue")
        .update({ status: "failed", last_error: result.detail ?? "adapter error" })
        .in("id", updates.map((u) => u.queue_id));
      await supabase.from("channels").update({ status: "error", last_error: result.detail ?? "push failed" }).eq("id", channelId);
      totalFailed += updates.length;
    }

    // Log
    await supabase.from("channel_sync_log").insert({
      channel_id: channelId,
      property_id: rows[0].property_id,
      direction: "outbound",
      action: "ari_push",
      status: result.ok ? "success" : "error",
      http_status: result.http_status ?? null,
      duration_ms: Date.now() - t0,
      items_count: updates.length,
      request_summary: { count: updates.length, mocked: result.mocked },
      error: result.ok ? null : result.detail ?? null,
    });
  }

  return json({ ok: true, sent: totalSent, failed: totalFailed });
});

async function computeExposedAvailability(
  supabase: ReturnType<typeof createClient>,
  args: { property_id: string; channel_id: string; site_type_id: string; stay_date: string }
): Promise<number> {
  // Total sites of type
  const { count: totalSites } = await supabase.from("sites")
    .select("id", { count: "exact", head: true })
    .eq("property_id", args.property_id)
    .eq("site_type_id", args.site_type_id)
    .eq("is_active", true);
  const total = totalSites ?? 0;

  // Booked count on this date
  const { count: bookedCount } = await supabase.from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("property_id", args.property_id)
    .eq("site_type_id", args.site_type_id)
    .in("status", ["CONFIRMED", "CHECKED_IN"])
    .lte("check_in_date", args.stay_date)
    .gt("check_out_date", args.stay_date);
  const booked = bookedCount ?? 0;
  let available = Math.max(0, total - booked);

  // Apply hold-back rules ordered by priority DESC
  const { data: rules } = await supabase.from("channel_holdback_rules")
    .select("*")
    .eq("channel_id", args.channel_id)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  for (const r of rules ?? []) {
    if (r.site_type_id && r.site_type_id !== args.site_type_id) continue;
    if (r.start_date && args.stay_date < r.start_date) continue;
    if (r.end_date && args.stay_date > r.end_date) continue;
    if (r.hold_type === "fixed") {
      available = Math.max(0, available - r.hold_value);
    } else if (r.hold_type === "percent") {
      const cap = Math.floor(total * (1 - r.hold_value / 100));
      available = Math.min(available, Math.max(0, cap));
    }
  }
  return available;
}

async function getSiteTypeMapping(supabase: ReturnType<typeof createClient>, channel_id: string, site_type_id: string) {
  const { data } = await supabase.from("channel_site_type_mappings")
    .select("external_room_type_code")
    .eq("channel_id", channel_id).eq("site_type_id", site_type_id).eq("is_active", true).maybeSingle();
  return data;
}

async function getPrimaryRatePlan(supabase: ReturnType<typeof createClient>, channel_id: string) {
  const { data } = await supabase.from("channel_rate_mappings")
    .select("external_rate_plan_code")
    .eq("channel_id", channel_id).eq("is_active", true).limit(1).maybeSingle();
  return data;
}

async function getRateAmount(
  supabase: ReturnType<typeof createClient>,
  property_id: string,
  site_type_id: string,
  _stay_date: string
): Promise<number | null> {
  // Use default rate x site type base price as a simple baseline.
  // The full rate engine (seasons, LOS, weekend multipliers) is exercised by the app quote path.
  const { data: st } = await supabase.from("site_types")
    .select("base_price")
    .eq("id", site_type_id).eq("property_id", property_id).maybeSingle();
  return st?.base_price ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
