// Guest Messaging AI Concierge Agent
// Reads guest context + property knowledge, drafts a reply, and proposes
// actions (POS/folio/work order/reservation changes) that require staff approval.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { thread_id, mode } = await req.json();
    if (!thread_id) throw new Error("thread_id required");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load thread
    const { data: thread, error: te } = await admin
      .from("messaging_threads")
      .select("*")
      .eq("id", thread_id)
      .maybeSingle();
    if (te || !thread) throw new Error("thread not found");

    // Load recent messages
    const { data: msgs } = await admin
      .from("messaging_messages")
      .select("direction, sender_type, body, created_at")
      .eq("thread_id", thread_id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Load guest + reservation
    let guest = null;
    if (thread.guest_id) {
      const { data } = await admin.from("guests").select("*").eq("id", thread.guest_id).maybeSingle();
      guest = data;
    }
    let reservation = null;
    if (thread.reservation_id) {
      const { data } = await admin
        .from("reservations")
        .select("id, confirmation_number, check_in_date, check_out_date, status, site_id, adults, children")
        .eq("id", thread.reservation_id)
        .maybeSingle();
      reservation = data;
    }

    // Load property + KB
    const { data: property } = await admin
      .from("properties")
      .select("name, check_in_time, check_out_time, timezone")
      .eq("id", thread.property_id)
      .maybeSingle();

    const { data: kb } = await admin
      .from("messaging_ai_knowledge")
      .select("category, title, body, tags")
      .eq("property_id", thread.property_id)
      .eq("is_active", true)
      .limit(80);

    // Load POS items that can be offered/delivered
    const { data: posItems } = await admin
      .from("pos_items")
      .select("id, name, price, description")
      .eq("property_id", thread.property_id)
      .limit(50);

    // Load rental items available for messaging
    const { data: rentalItems } = await admin
      .from("rental_items")
      .select("id, name, category, hourly_rate, daily_rate, stay_rate, deposit_amount, description")
      .eq("property_id", thread.property_id)
      .eq("is_active", true)
      .eq("messaging_offerable", true)
      .limit(50);

    const system = `You are the AI guest concierge for ${property?.name || "the campground"}, a campground property management system.

Your job:
1. Read the guest's most recent message and respond warmly and briefly (SMS-length when the channel is SMS).
2. If it's a purely informational question you can answer from Property Knowledge, answer directly.
3. If the guest is requesting something that requires action (order firewood/ice/rentals, late checkout, early check-in, site move, extended stay, maintenance issue, complaint), propose an action.
4. Never invent prices, policies, or availability that aren't in the knowledge or catalog below.
5. Address the guest by first name if known.

Property check-in: ${property?.check_in_time || "3:00 PM"}   Check-out: ${property?.check_out_time || "11:00 AM"}

Guest Context:
${guest ? `Name: ${guest.first_name} ${guest.last_name}\nEmail: ${guest.email || "n/a"}\nPhone: ${guest.phone || "n/a"}\nNotes: ${guest.likes_dislikes || "none"}` : "Unknown guest (contact not matched)"}

Reservation:
${reservation ? `Confirmation ${reservation.confirmation_number}, ${reservation.check_in_date} → ${reservation.check_out_date}, status ${reservation.status}` : "No linked reservation"}

Property Knowledge (${kb?.length || 0} entries):
${(kb || []).map((k) => `[${k.category}] ${k.title}\n${k.body}`).join("\n\n") || "(none configured yet)"}

Offerable POS items:
${(posItems || []).map((p) => `- ${p.name} ($${p.price})${p.description ? " — " + p.description : ""}`).join("\n") || "(none)"}

Offerable Rental items (charged per hour/day/stay + deposit):
${(rentalItems || []).map((r) => `- [${r.id}] ${r.name} (${r.category})${r.hourly_rate ? ` $${r.hourly_rate}/hr` : ""}${r.daily_rate ? ` $${r.daily_rate}/day` : ""}${r.stay_rate ? ` $${r.stay_rate}/stay` : ""}${r.deposit_amount ? ` deposit $${r.deposit_amount}` : ""}${r.description ? " — " + r.description : ""}`).join("\n") || "(none)"}

Respond with strict JSON only:
{
  "reply": "text to send to the guest",
  "category": "service|maintenance|billing|reservations|info|other",
  "confidence": "high|medium|low",
  "auto_send_ok": true|false,   // true only for confidence:high informational answers with no action needed
  "action": null | {
    "type": "propose_pos_charge_and_delivery" | "propose_rental_reservation" | "propose_late_checkout" | "propose_early_checkin" | "propose_site_move" | "propose_stayover_extension" | "propose_work_order" | "escalate_to_staff",
    "summary": "one-line human summary of what would happen",
    "payload": { ...specific fields for the action... }
  }
}

Action payload shapes:
- propose_pos_charge_and_delivery: { pos_item_id, item_name, quantity, unit_price, delivery_notes }
- propose_rental_reservation: { rental_item_id, item_name, quantity, pricing_mode: "hourly|daily|stay", start_at (ISO), end_at (ISO), rate_applied, total_charge, deposit_charged, notes }
- propose_late_checkout: { new_checkout_time }
- propose_early_checkin: { requested_time }
- propose_site_move: { requested_site_number, reason }
- propose_stayover_extension: { additional_nights, new_checkout_date }
- propose_work_order: { title, description, priority: "low|normal|high|urgent" }
- escalate_to_staff: { role: "front_desk|manager|maintenance", reason }`;

    const conversation = (msgs || [])
      .map((m) => `${m.direction === "in" ? "GUEST" : m.sender_type.toUpperCase()}: ${m.body}`)
      .join("\n");

    const userPrompt = `Recent conversation:\n${conversation}\n\nDraft a response and (if needed) propose an action.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI gateway ${aiResp.status}: ${t}`);
    }
    const aiJson = await aiResp.json();
    const raw = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { reply: raw, category: "other", confidence: "low", auto_send_ok: false, action: null };
    }

    // draft-only mode: just return the draft, don't create anything
    if (mode === "draft_only") {
      return new Response(JSON.stringify({ draft: parsed.reply || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update category on thread
    if (parsed.category) {
      await admin.from("messaging_threads").update({ category: parsed.category }).eq("id", thread_id);
    }

    // If action proposed, create pending action
    let actionId: string | null = null;
    if (parsed.action?.type) {
      const { data: act } = await admin
        .from("messaging_ai_actions")
        .insert({
          thread_id,
          property_id: thread.property_id,
          action_type: parsed.action.type,
          action_summary: parsed.action.summary || parsed.action.type,
          action_payload: parsed.action.payload || {},
          proposed_reply: parsed.reply || null,
          status: "pending",
        })
        .select("id")
        .single();
      actionId = act?.id || null;

      // Set thread to pending_staff since staff approval needed
      await admin.from("messaging_threads").update({ status: "pending_staff" }).eq("id", thread_id);
    } else if (parsed.auto_send_ok && parsed.confidence === "high" && parsed.reply && thread.ai_mode !== "off") {
      // Auto-send informational reply
      await fetch(`${SUPABASE_URL}/functions/v1/messaging-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          thread_id,
          body: parsed.reply,
          sender_type: "ai",
          ai_generated: true,
          skip_agent: true,
        }),
      });
    } else if (parsed.reply) {
      // Post as internal AI suggestion note (visible in thread as AI draft, staff can copy)
      await admin.from("messaging_messages").insert({
        thread_id,
        property_id: thread.property_id,
        direction: "out",
        sender_type: "ai",
        body: parsed.reply,
        ai_generated: true,
        delivery_status: "draft",
        metadata: { draft: true },
      });
    }

    return new Response(JSON.stringify({ ok: true, action_id: actionId, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("messaging-ai-agent error", e);
    return new Response(JSON.stringify({ error: e.message || "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
