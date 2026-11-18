import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolvePendingArrivals,
  resolvePendingDueOuts,
  recordExceptions,
  type ArrivalAction,
  type DepartureAction,
  type DepositAction,
} from "../_shared/dayendExceptions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARRIVAL_ACTIONS: ArrivalAction[] = ["auto_cancel", "move_next_day", "auto_no_show", "stop"];
const DEPARTURE_ACTIONS: DepartureAction[] = ["extend_stay", "checkout_hold", "stop"];
const DEPOSIT_ACTIONS: DepositAction[] = ["forfeit", "hold_review", "stop"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "unauthorized" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid body" }, 400);
  }

  const propertyId = String(body?.propertyId ?? "");
  const auditDate = String(body?.auditDate ?? "");
  const arrivalsAction = body?.arrivalsAction as ArrivalAction | undefined;
  const departuresAction = body?.departuresAction as DepartureAction | undefined;
  const depositActionInput = body?.depositAction as DepositAction | undefined;

  if (!/^[0-9a-f-]{36}$/i.test(propertyId) || !/^\d{4}-\d{2}-\d{2}$/.test(auditDate)) {
    return json({ error: "propertyId (uuid) and auditDate (YYYY-MM-DD) are required" }, 400);
  }
  if (arrivalsAction && !ARRIVAL_ACTIONS.includes(arrivalsAction)) return json({ error: "invalid arrivalsAction" }, 400);
  if (departuresAction && !DEPARTURE_ACTIONS.includes(departuresAction)) return json({ error: "invalid departuresAction" }, 400);
  if (depositActionInput && !DEPOSIT_ACTIONS.includes(depositActionInput)) return json({ error: "invalid depositAction" }, 400);

  const { data: allowed, error: accessError } = await userClient.rpc("user_can_access_property", {
    _property_id: propertyId,
  });
  if (accessError || !allowed) return json({ error: "forbidden" }, 403);

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { data: settings } = await admin
      .from("night_audit_settings")
      .select("pending_arrivals_action, inhouse_departure_action, deposit_action")
      .eq("property_id", propertyId)
      .maybeSingle();

    const arrAction = (arrivalsAction ?? settings?.pending_arrivals_action ?? "stop") as ArrivalAction;
    const depAction = (departuresAction ?? settings?.inhouse_departure_action ?? "stop") as DepartureAction;
    const depositAction = (depositActionInput ?? settings?.deposit_action ?? "hold_review") as DepositAction;

    const { data: audit } = await admin
      .from("night_audits")
      .select("id")
      .eq("property_id", propertyId)
      .eq("audit_date", auditDate)
      .maybeSingle();

    const user = userData.user;
    const performedByName =
      [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(" ") ||
      user.email ||
      "Staff";

    const arrivals = await resolvePendingArrivals(admin, {
      propertyId,
      auditDate,
      action: arrAction,
      depositAction,
      nightAuditId: audit?.id ?? null,
    });
    const departures = await resolvePendingDueOuts(admin, {
      propertyId,
      auditDate,
      action: depAction,
    });

    const records = [...arrivals.handled, ...departures.handled];
    await recordExceptions(admin, {
      propertyId,
      closeDate: auditDate,
      nightAuditId: audit?.id ?? null,
      resolution: "manual",
      performedByName,
      records,
    });

    return json({
      success: true,
      handled: records.length,
      arrivals: { handled: arrivals.handled.length, blocked: arrivals.blocked, message: arrivals.blockedMessage },
      departures: { handled: departures.handled.length, blocked: departures.blocked, message: departures.blockedMessage },
      records,
    });
  } catch (e) {
    console.error("dayend-resolve-exceptions error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
