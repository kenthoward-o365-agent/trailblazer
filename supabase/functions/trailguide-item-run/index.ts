// Executes a TrailGuide Item: calls the trailguide-chat agent with the item's
// prompt, records a run row, and fans out the result via SMS/email/in-app.
// If the agent proposes write actions AND item.requires_approval=true, the run
// is left in `awaiting_approval` and the creator is notified.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  item_id: string;
  triggered_by?: "manual" | "scheduled" | "test";
  triggered_by_user_id?: string | null;
  /** When true, don't persist a run row — used by the "Test now" preview. */
  dry_run?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Body;
    if (!body.item_id) return json({ error: "item_id required" }, 400);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Require an authenticated staff (or internal service-role) caller.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const token = authHeader.slice(7);
    const isServiceCall = token === SERVICE_KEY;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!isServiceCall) {
      const supaAuth = createClient(SUPABASE_URL, ANON_KEY);
      const { data: claimsRes, error: claimsErr } = await supaAuth.auth.getClaims(token);
      if (claimsErr || !claimsRes?.claims?.sub) return json({ error: "unauthorized" }, 401);
    }

    const { data: item, error: iErr } = await admin
      .from("trailguide_items")
      .select("*")
      .eq("id", body.item_id)
      .maybeSingle();
    if (iErr || !item) return json({ error: "item not found" }, 404);

    // Verify property access for non-service callers.
    if (!isServiceCall) {
      const userScoped = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: hasAccess } = await userScoped.rpc("user_can_access_property", {
        _property_id: item.property_id,
      });
      if (!hasAccess) return json({ error: "forbidden" }, 403);
    }


    const auditDate = new Date().toISOString().slice(0, 10);

    // Call trailguide-chat with service auth so RLS-scoped read tools return data.
    const chatResp = await fetch(`${SUPABASE_URL}/functions/v1/trailguide-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: item.prompt }],
        propertyId: item.property_id,
        auditDate,
      }),
    });
    const chatJson = await chatResp.json().catch(() => ({}));
    if (!chatResp.ok) {
      const err = chatJson?.error || `chat ${chatResp.status}`;
      if (!body.dry_run) {
        await admin.from("trailguide_item_runs").insert({
          item_id: item.id,
          property_id: item.property_id,
          status: "failed",
          triggered_by: body.triggered_by || "manual",
          triggered_by_user_id: body.triggered_by_user_id ?? null,
          input_prompt: item.prompt,
          error: String(err).slice(0, 4000),
          completed_at: new Date().toISOString(),
        });
        await admin.from("trailguide_items").update({
          last_run_at: new Date().toISOString(),
          last_status: "failed",
        }).eq("id", item.id);
      }
      return json({ error: err }, 500);
    }

    const output: string = chatJson.reply || "";
    const proposed: any[] = chatJson.proposed_actions || [];

    if (body.dry_run) {
      return json({ ok: true, output, proposed_actions: proposed, dry_run: true });
    }

    const needsApproval = item.requires_approval && proposed.length > 0;
    const status = needsApproval ? "awaiting_approval" : "succeeded";

    const { data: run } = await admin
      .from("trailguide_item_runs")
      .insert({
        item_id: item.id,
        property_id: item.property_id,
        status,
        triggered_by: body.triggered_by || "manual",
        triggered_by_user_id: body.triggered_by_user_id ?? null,
        input_prompt: item.prompt,
        output_text: output,
        proposed_actions: proposed,
        completed_at: needsApproval ? null : new Date().toISOString(),
      })
      .select()
      .single();

    await admin.from("trailguide_items").update({
      last_run_at: new Date().toISOString(),
      last_status: status,
    }).eq("id", item.id);

    if (needsApproval) {
      // Notify creator (in-app) so they can approve.
      await admin.from("trailguide_notifications").insert({
        user_id: item.created_by_user_id,
        property_id: item.property_id,
        item_id: item.id,
        run_id: run?.id ?? null,
        kind: "approval_required",
        title: `Approval needed: ${item.name}`,
        body: `TrailGuide has ${proposed.length} action(s) waiting for your approval.`,
      });
      return json({ ok: true, status, run_id: run?.id, requires_approval: true });
    }

    // Deliver to recipients on all selected channels.
    const results = await deliver(admin, item, run?.id ?? null, output);
    if (run?.id) {
      await admin.from("trailguide_item_runs")
        .update({ delivery_results: results })
        .eq("id", run.id);
    }

    return json({ ok: true, status, run_id: run?.id, delivery: results });
  } catch (e: any) {
    console.error("trailguide-item-run", e);
    return json({ error: e?.message || "error" }, 500);
  }
});

async function deliver(admin: any, item: any, runId: string | null, output: string) {
  const channels: string[] = item.delivery_channels || [];
  const results: Record<string, any> = {};

  // Resolve recipients (creator + explicit recipients, deduped).
  const { data: recs } = await admin
    .from("trailguide_item_recipients")
    .select("user_id")
    .eq("item_id", item.id);
  const ids = new Set<string>([item.created_by_user_id, ...(recs || []).map((r: any) => r.user_id)]);
  const userIds = Array.from(ids);

  // Fetch contact info from staff_profiles + auth email via admin API.
  const { data: profiles } = await admin
    .from("staff_profiles")
    .select("user_id, first_name, last_name, phone")
    .in("user_id", userIds);
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  // Emails from auth.users via admin listing (one lookup per user).
  const emailMap = new Map<string, string | null>();
  for (const uid of userIds) {
    try {
      const { data } = await admin.auth.admin.getUserById(uid);
      emailMap.set(uid, data?.user?.email ?? null);
    } catch { emailMap.set(uid, null); }
  }

  const title = `TrailGuide: ${item.name}`;

  // In-app
  if (channels.includes("in_app")) {
    const rows = userIds.map((uid) => ({
      user_id: uid,
      property_id: item.property_id,
      item_id: item.id,
      run_id: runId,
      kind: "run_result",
      title,
      body: output.slice(0, 4000),
    }));
    const { error } = await admin.from("trailguide_notifications").insert(rows);
    results.in_app = { sent: rows.length, error: error?.message };
  }

  // Email
  if (channels.includes("email")) {
    const sent: any[] = [];
    for (const uid of userIds) {
      const email = emailMap.get(uid);
      if (!email) { sent.push({ user_id: uid, skipped: "no email" }); continue; }
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-communication`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            channel: "email",
            recipientEmail: email,
            subject: title,
            html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(output)}</pre>`,
          }),
        });
        sent.push({ user_id: uid, ok: resp.ok });
      } catch (e: any) { sent.push({ user_id: uid, error: e?.message }); }
    }
    results.email = sent;
  }

  // SMS
  if (channels.includes("sms")) {
    const sent: any[] = [];
    for (const uid of userIds) {
      const phone = (profileMap.get(uid) as any)?.phone;
      if (!phone) { sent.push({ user_id: uid, skipped: "no phone" }); continue; }
      const text = `${title}\n\n${stripMd(output)}`.slice(0, 1500);
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-communication`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ channel: "sms", recipientPhone: phone, text }),
        });
        sent.push({ user_id: uid, ok: resp.ok });
      } catch (e: any) { sent.push({ user_id: uid, error: e?.message }); }
    }
    results.sms = sent;
  }

  return results;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function stripMd(s: string) {
  return s.replace(/[*_`#>]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1");
}
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
