import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { channelAdapters, type ChannelCode, type ContentPayload } from "../_shared/channels/adapters.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BodySchema = z.object({
  channel_id: z.string().uuid(),
  site_type_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return j({ error: parsed.error.flatten() }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: channel } = await supabase.from("channels").select("*").eq("id", parsed.data.channel_id).maybeSingle();
  if (!channel) return j({ error: "channel_not_found" }, 404);

  const { data: content } = await supabase.from("channel_content")
    .select("*").eq("channel_id", channel.id).eq("site_type_id", parsed.data.site_type_id).maybeSingle();
  if (!content) return j({ error: "content_not_found" }, 404);

  const { data: mapping } = await supabase.from("channel_site_type_mappings")
    .select("external_room_type_code").eq("channel_id", channel.id).eq("site_type_id", parsed.data.site_type_id).maybeSingle();
  if (!mapping) return j({ error: "mapping_missing" }, 400);

  const payload: ContentPayload = {
    external_room_type_code: mapping.external_room_type_code,
    display_name: content.display_name ?? "",
    short_description: content.short_description ?? undefined,
    long_description: content.long_description ?? undefined,
    max_occupancy: content.max_occupancy ?? undefined,
    amenities: content.amenities ?? {},
    policies: content.policies ?? {},
  };

  const t0 = Date.now();
  const adapter = channelAdapters[channel.channel_code as ChannelCode];
  const result = await adapter.pushContent({
    channel_code: channel.channel_code,
    hotel_id: channel.hotel_id,
    credentials_ref: channel.credentials_ref,
    mock_mode: channel.mock_mode,
  }, payload);

  await supabase.from("channel_content").update({
    last_pushed_at: new Date().toISOString(),
    push_status: result.ok ? "synced" : "error",
    last_error: result.ok ? null : result.detail ?? "push failed",
  }).eq("id", content.id);

  await supabase.from("channel_sync_log").insert({
    channel_id: channel.id,
    property_id: channel.property_id,
    direction: "outbound",
    action: "content_push",
    status: result.ok ? "success" : "error",
    http_status: result.http_status ?? null,
    duration_ms: Date.now() - t0,
    items_count: 1,
    request_summary: { site_type_id: parsed.data.site_type_id, mocked: result.mocked },
    error: result.ok ? null : result.detail ?? null,
  });

  return j({ ok: result.ok, mocked: result.mocked });
});

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
