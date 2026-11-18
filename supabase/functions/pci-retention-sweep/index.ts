// PCI SAQ A data-retention sweep.
// Deletes stale card authorizations, transactions, API logs, and purges
// long-idle card metadata. Invoke on a schedule (recommended: daily 03:00 UTC)
// via pg_cron -> net.http_post, or manually with a service-role JWT.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { installConsoleRedaction, safeError, safeLog } from "../_shared/pci.ts";
installConsoleRedaction();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Require the caller to present the service-role key. This function must
    // never be reachable by anon or authenticated end-users.
    const auth = req.headers.get("authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
    );
    const { data, error } = await supabase.rpc("pci_retention_sweep");
    if (error) throw error;
    safeLog("pci_retention_sweep result", data);
    return new Response(JSON.stringify({ ok: true, result: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    safeError("pci_retention_sweep failed", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
