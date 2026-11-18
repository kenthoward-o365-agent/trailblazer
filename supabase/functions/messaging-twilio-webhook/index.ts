// Twilio inbound SMS webhook.
// Twilio POSTs application/x-www-form-urlencoded with From, To, Body, MessageSid.
// We match the From number to a guest, create/append to a thread, and kick the AI agent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";

function normalizePhone(p: string): string {
  return p.replace(/[^\d+]/g, "");
}

async function verifyTwilioSignature(
  authToken: string,
  signatureHeader: string,
  url: string,
  params: Record<string, string>,
): Promise<boolean> {
  if (!authToken || !signatureHeader) return false;
  // Twilio: base64(HMAC-SHA1(authToken, url + concat(sortedKey + value)))
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + params[k];
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return b64 === signatureHeader;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};
    let rawBody = "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      rawBody = await req.text();
      params = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      params = await req.json();
    }

    // Verify Twilio request signature. Reject if TWILIO_AUTH_TOKEN not configured.
    if (!TWILIO_AUTH_TOKEN) {
      console.error("TWILIO_AUTH_TOKEN not configured; rejecting webhook");
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }
    const signature = req.headers.get("x-twilio-signature") || "";
    // Twilio signs the full public URL of the request (as configured in Twilio Console).
    const url = req.url;
    const valid = await verifyTwilioSignature(TWILIO_AUTH_TOKEN, signature, url, params);
    if (!valid) {
      console.warn("Invalid Twilio signature");
      return new Response("forbidden", { status: 403, headers: corsHeaders });
    }


    const from = normalizePhone(params.From || params.from || "");
    const to = normalizePhone(params.To || params.to || "");
    const body = params.Body || params.body || "";
    const messageSid = params.MessageSid || params.messageSid || null;

    if (!from || !to || !body) {
      return new Response("<Response></Response>", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Find channel by To number
    const { data: channel } = await admin
      .from("messaging_channels")
      .select("*")
      .eq("channel", "sms")
      .eq("identifier", to)
      .eq("is_active", true)
      .maybeSingle();

    if (!channel) {
      console.warn("No active SMS channel for", to);
      return new Response("<Response></Response>", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/xml" },
      });
    }

    const propertyId = channel.property_id;

    // Match guest by phone
    let guestId: string | null = null;
    let displayName: string | null = null;
    let reservationId: string | null = null;

    const { data: guest } = await admin
      .from("guests")
      .select("id, first_name, last_name")
      .or(`phone.eq.${from},phone2.eq.${from}`)
      .limit(1)
      .maybeSingle();
    if (guest) {
      guestId = guest.id;
      displayName = `${guest.first_name} ${guest.last_name}`.trim();

      // Best current reservation: in-park > arriving today > most recent
      const today = new Date().toISOString().slice(0, 10);
      const { data: activeRes } = await admin
        .from("reservations")
        .select("id, check_in_date, check_out_date, status")
        .eq("guest_id", guestId)
        .eq("property_id", propertyId)
        .in("status", ["CHECKED_IN", "CONFIRMED"])
        .lte("check_in_date", today)
        .gte("check_out_date", today)
        .limit(1)
        .maybeSingle();
      if (activeRes) reservationId = activeRes.id;
      else {
        const { data: upcoming } = await admin
          .from("reservations")
          .select("id")
          .eq("guest_id", guestId)
          .eq("property_id", propertyId)
          .gte("check_in_date", today)
          .order("check_in_date", { ascending: true })
          .limit(1)
          .maybeSingle();
        reservationId = upcoming?.id || null;
      }
    }

    // Find or create thread
    let { data: thread } = await admin
      .from("messaging_threads")
      .select("*")
      .eq("property_id", propertyId)
      .eq("channel", "sms")
      .eq("external_participant", from)
      .not("status", "eq", "resolved")
      .maybeSingle();

    if (!thread) {
      const { data: newThread, error } = await admin
        .from("messaging_threads")
        .insert({
          property_id: propertyId,
          channel_id: channel.id,
          channel: "sms",
          guest_id: guestId,
          reservation_id: reservationId,
          external_participant: from,
          display_name: displayName || from,
          status: "open",
          ai_mode: "suggest",
          unread_count: 0,
        })
        .select()
        .single();
      if (error) throw error;
      thread = newThread;
    } else {
      // Backfill guest/reservation if newly matched
      const updates: any = {};
      if (!thread.guest_id && guestId) updates.guest_id = guestId;
      if (!thread.reservation_id && reservationId) updates.reservation_id = reservationId;
      if (!thread.display_name && displayName) updates.display_name = displayName;
      if (Object.keys(updates).length > 0) {
        await admin.from("messaging_threads").update(updates).eq("id", thread.id);
      }
    }

    // Insert inbound message
    await admin.from("messaging_messages").insert({
      thread_id: thread!.id,
      property_id: propertyId,
      direction: "in",
      sender_type: "guest",
      body,
      provider_message_id: messageSid,
      delivery_status: "received",
    });

    // Bump thread
    await admin
      .from("messaging_threads")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.slice(0, 140),
        unread_count: (thread!.unread_count || 0) + 1,
        status: thread!.status === "resolved" ? "open" : "open",
      })
      .eq("id", thread!.id);

    // Fire and forget: kick AI agent
    fetch(`${SUPABASE_URL}/functions/v1/messaging-ai-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ thread_id: thread!.id }),
    }).catch((e) => console.error("agent trigger failed", e));

    // Twilio expects TwiML back
    return new Response("<Response></Response>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  } catch (e: any) {
    console.error("twilio-webhook error", e);
    return new Response("<Response></Response>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});
