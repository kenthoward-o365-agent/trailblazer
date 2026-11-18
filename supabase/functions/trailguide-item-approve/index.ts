// Approve or reject an awaiting_approval TrailGuide run.
// On approve: executes each proposed_action via trailguide-action using the
// approver's JWT (so RLS/role checks apply), then delivers the run output.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth) return json({ error: "Not authenticated" }, 401);
    const { run_id, decision } = await req.json();
    if (!run_id || !["approve", "reject"].includes(decision)) {
      return json({ error: "run_id and decision (approve|reject) required" }, 400);
    }

    const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData } = await user.auth.getUser();
    if (!userData?.user) return json({ error: "Not authenticated" }, 401);

    const { data: run } = await admin
      .from("trailguide_item_runs")
      .select("*, item:trailguide_items(*)")
      .eq("id", run_id)
      .maybeSingle();
    if (!run) return json({ error: "run not found" }, 404);
    if (run.status !== "awaiting_approval") return json({ error: "run is not awaiting approval" }, 400);

    if (decision === "reject") {
      await admin.from("trailguide_item_runs").update({
        status: "rejected", completed_at: new Date().toISOString(),
      }).eq("id", run_id);
      return json({ ok: true, status: "rejected" });
    }

    // Approve: execute each proposed action with the approver's JWT.
    const results: any[] = [];
    for (const a of (run.proposed_actions as any[]) || []) {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/trailguide-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: auth },
          body: JSON.stringify({ propertyId: run.property_id, tool: a.tool, args: a.args }),
        });
        const j = await resp.json().catch(() => ({}));
        results.push({ tool: a.tool, ok: resp.ok, result: j });
      } catch (e: any) {
        results.push({ tool: a.tool, ok: false, error: e?.message });
      }
    }

    await admin.from("trailguide_item_runs").update({
      status: "succeeded",
      completed_at: new Date().toISOString(),
      tool_calls: results,
    }).eq("id", run_id);

    // Deliver via internal fetch path — reuse the run function's deliver by
    // calling a small helper here (duplicate small deliver logic to keep functions independent).
    const item = run.item;
    const output = run.output_text || "";
    const { data: recs } = await admin
      .from("trailguide_item_recipients").select("user_id").eq("item_id", item.id);
    const userIds = Array.from(new Set<string>([item.created_by_user_id, ...(recs || []).map((r: any) => r.user_id)]));

    if ((item.delivery_channels || []).includes("in_app")) {
      await admin.from("trailguide_notifications").insert(userIds.map((uid) => ({
        user_id: uid, property_id: item.property_id, item_id: item.id, run_id,
        kind: "run_result", title: `TrailGuide: ${item.name}`, body: output.slice(0, 4000),
      })));
    }

    return json({ ok: true, status: "succeeded", results });
  } catch (e: any) {
    console.error("trailguide-item-approve", e);
    return json({ error: e?.message || "error" }, 500);
  }
});

function json(b: any, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
