// Outbound message sender for Guest Messaging
// Logs to messaging_messages and dispatches via the appropriate channel provider.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { thread_id, body: text, sender_type = "staff", ai_generated = false } = body;
    if (!thread_id || !text) throw new Error("thread_id and body required");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Require an authenticated staff or service caller.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);

    let userId: string | null = null;
    const isServiceCall = token === SERVICE_KEY;
    if (!isServiceCall) {
      const supaAuth = createClient(SUPABASE_URL, ANON_KEY);
      const { data: claimsRes, error: claimsErr } = await supaAuth.auth.getClaims(token);
      if (claimsErr || !claimsRes?.claims?.sub) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsRes.claims.sub;
    }


    // Load thread + channel
    const { data: thread, error: te } = await admin
      .from("messaging_threads")
      .select("*, channel_row:messaging_channels(*)")
      .eq("id", thread_id)
      .maybeSingle();
    if (te || !thread) throw new Error("thread not found");

    // Verify caller has access to this thread's property (skip for service-role internal calls).
    if (!isServiceCall) {
      const userScoped = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: hasAccess } = await userScoped.rpc("user_can_access_property", {
        _property_id: thread.property_id,
      });
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    // Dispatch by channel
    let providerMessageId: string | null = null;
    let deliveryStatus = "sent";
    let errorMsg: string | null = null;

    try {
      if (thread.channel === "sms") {
        if (TWILIO_API_KEY && LOVABLE_API_KEY) {
          const fromNumber = thread.channel_row?.identifier;
          if (!fromNumber) throw new Error("No SMS from-number configured for this thread");
          const resp = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TWILIO_API_KEY,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: thread.external_participant,
              From: fromNumber,
              Body: text,
            }),
          });
          if (!resp.ok) {
            const t = await resp.text();
            throw new Error(`Twilio ${resp.status}: ${t}`);
          }
          const j = await resp.json();
          providerMessageId = j.sid;
        } else {
          console.log("[MOCK SMS]", thread.external_participant, text.slice(0, 120));
          deliveryStatus = "mock";
        }
      } else if (thread.channel === "email") {
        // Delegate to existing send-communication function
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-communication`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            channel: "email",
            recipientEmail: thread.external_participant,
            subject: thread.subject || "Message from your host",
            html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
            text,
          }),
        });
        const j = await resp.json();
        providerMessageId = j.emailId || null;
        if (!resp.ok) throw new Error(j.error || "email send failed");
      } else {
        // Meta channels not yet wired
        deliveryStatus = "pending";
        console.log(`[${thread.channel} not configured]`, text.slice(0, 120));
      }
    } catch (e: any) {
      console.error("dispatch error", e);
      deliveryStatus = "failed";
      errorMsg = e.message;
    }

    // Log message
    const { data: msg, error: me } = await admin
      .from("messaging_messages")
      .insert({
        thread_id,
        property_id: thread.property_id,
        direction: "out",
        sender_type,
        sender_user_id: userId,
        body: text,
        ai_generated,
        provider_message_id: providerMessageId,
        delivery_status: deliveryStatus,
        metadata: errorMsg ? { error: errorMsg } : {},
      })
      .select()
      .single();
    if (me) throw me;

    // Update thread preview
    await admin
      .from("messaging_threads")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.slice(0, 140),
        status: thread.status === "resolved" ? "resolved" : "awaiting_guest",
      })
      .eq("id", thread_id);

    return new Response(JSON.stringify({ ok: true, message: msg, delivery_status: deliveryStatus, error: errorMsg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("messaging-send error", e);
    return new Response(JSON.stringify({ error: e.message || "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
