// Executes an AI-proposed action after staff approval.
// Reuses the trailguide-action handlers for shared logic where possible.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action_id, decision, override_reply } = await req.json();
    if (!action_id || !decision) throw new Error("action_id and decision required");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Require an authenticated staff session.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);
    const supaAuth = createClient(SUPABASE_URL, ANON_KEY);
    const { data: claimsRes, error: claimsErr } = await supaAuth.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId: string = claimsRes.claims.sub;

    const { data: action, error: ae } = await admin
      .from("messaging_ai_actions")
      .select("*")
      .eq("id", action_id)
      .maybeSingle();
    if (ae || !action) throw new Error("action not found");
    if (action.status !== "pending") throw new Error(`action already ${action.status}`);

    // Verify caller has access to the action's property.
    const userScoped = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: hasAccess } = await userScoped.rpc("user_can_access_property", {
      _property_id: action.property_id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (decision === "reject") {
      await admin
        .from("messaging_ai_actions")
        .update({ status: "rejected", approved_by_user_id: userId })
        .eq("id", action_id);
      return new Response(JSON.stringify({ ok: true, status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Approve → execute
    const reply = override_reply || action.proposed_reply;
    let result: any = { skipped: "action executor not fully wired" };
    let executionError: string | null = null;

    try {
      const { data: thread } = await admin
        .from("messaging_threads")
        .select("*")
        .eq("id", action.thread_id)
        .maybeSingle();
      const p = action.action_payload || {};

      switch (action.action_type) {
        case "propose_work_order": {
          const { data: wo, error } = await admin
            .from("work_orders")
            .insert({
              property_id: action.property_id,
              title: p.title || "Guest request from messaging",
              description: p.description || action.action_summary,
              priority: p.priority || "normal",
              status: "open",
              site_id: thread?.reservation_id ? null : null,
            })
            .select()
            .single();
          if (error) throw error;
          result = { work_order_id: wo.id, wo_number: wo.wo_number };
          break;
        }
        case "propose_late_checkout":
        case "propose_early_checkin":
        case "propose_stayover_extension": {
          if (!thread?.reservation_id) throw new Error("No reservation linked to thread");
          const updates: any = {};
          if (p.new_checkout_date) updates.check_out_date = p.new_checkout_date;
          if (Object.keys(updates).length > 0) {
            const { error } = await admin.from("reservations").update(updates).eq("id", thread.reservation_id);
            if (error) throw error;
          }
          result = { reservation_id: thread.reservation_id, updates, note: "Time-of-day changes tracked in special_requests" };
          if (p.new_checkout_time || p.requested_time) {
            await admin.from("reservations").update({
              special_requests: `[messaging] ${action.action_summary}`,
            }).eq("id", thread.reservation_id);
          }
          break;
        }
        case "propose_pos_charge_and_delivery": {
          // Create work order for delivery, and note the charge to be posted at POS
          const { data: wo, error } = await admin
            .from("work_orders")
            .insert({
              property_id: action.property_id,
              title: `Deliver: ${p.item_name || "item"} × ${p.quantity || 1}`,
              description: `Guest requested via messaging.\n${p.delivery_notes || ""}\n\nCharge $${p.unit_price || "?"} × ${p.quantity || 1} to guest folio.`,
              priority: "normal",
              status: "open",
            })
            .select()
            .single();
          if (error) throw error;
          result = { work_order_id: wo.id, note: "POS charge posting must be completed via POS terminal or folio charge action" };
          break;
        }
        case "propose_rental_reservation": {
          const { data: rr, error } = await admin
            .from("rental_reservations")
            .insert({
              property_id: action.property_id,
              rental_item_id: p.rental_item_id,
              reservation_id: thread?.reservation_id || null,
              guest_id: thread?.guest_id || null,
              quantity: p.quantity || 1,
              start_at: p.start_at,
              end_at: p.end_at,
              pricing_mode: p.pricing_mode || "daily",
              rate_applied: p.rate_applied || 0,
              total_charge: p.total_charge || 0,
              deposit_charged: p.deposit_charged || 0,
              source: "messaging_ai",
              status: "reserved",
              notes: p.notes || action.action_summary,
            })
            .select()
            .single();
          if (error) throw error;
          result = { rental_reservation_id: rr.id, note: "Charge posting must be completed via folio if needed" };
          break;
        }
        case "escalate_to_staff": {
          await admin
            .from("messaging_threads")
            .update({ status: "pending_staff", assigned_role: p.role || "front_desk" })
            .eq("id", action.thread_id);
          result = { escalated_to: p.role };
          break;
        }
        default:
          result = { note: `Action type ${action.action_type} recognized but no executor implemented yet — reply will still be sent` };
      }
    } catch (e: any) {
      executionError = e.message;
      console.error("action execution error", e);
    }

    // Update action row
    await admin
      .from("messaging_ai_actions")
      .update({
        status: executionError ? "failed" : "executed",
        approved_by_user_id: userId,
        executed_at: new Date().toISOString(),
        result,
        error_message: executionError,
      })
      .eq("id", action_id);

    // Send reply to guest if provided
    if (reply && !executionError) {
      await fetch(`${SUPABASE_URL}/functions/v1/messaging-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader || `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          thread_id: action.thread_id,
          body: reply,
          sender_type: "ai",
          ai_generated: true,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: !executionError, result, error: executionError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("messaging-execute-action error", e);
    return new Response(JSON.stringify({ error: e.message || "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
