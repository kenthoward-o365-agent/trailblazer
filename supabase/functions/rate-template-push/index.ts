import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { template_id, property_ids, start_date, end_date } = body ?? {};
    if (!template_id || !Array.isArray(property_ids) || property_ids.length === 0
        || !start_date || !end_date) {
      return json({ error: "template_id, property_ids[], start_date, end_date required" }, 400);
    }

    // Load template + children (RLS enforced through user client)
    const { data: tpl, error: tplErr } = await userClient
      .from("rate_templates").select("*").eq("id", template_id).maybeSingle();
    if (tplErr || !tpl) return json({ error: "Template not found or not permitted" }, 404);

    const { data: prices } = await userClient
      .from("rate_template_site_type_prices").select("*").eq("template_id", template_id);
    const { data: restrictions } = await userClient
      .from("rate_template_restrictions").select("*").eq("template_id", template_id);

    // Insert push audit row
    const { data: pushRow } = await supabase.from("rate_template_pushes").insert({
      template_id, pushed_by: user.id, target_property_ids: property_ids, status: "running",
    }).select().single();

    const results: Record<string, unknown>[] = [];
    for (const propertyId of property_ids) {
      try {
        // Upsert rate by (property_id, rate_code)
        const { data: existing } = await supabase.from("rates")
          .select("id").eq("property_id", propertyId).eq("rate_code", tpl.template_code).maybeSingle();

        const ratePayload = {
          property_id: propertyId,
          rate_code: tpl.template_code,
          description: tpl.name,
          start_date, end_date,
          deposit_requirement: tpl.deposit_requirement ?? "none",
          adjustment_type: tpl.adjustment_type,
          adjustment_value: tpl.adjustment_value,
          is_default: false,
          is_base_rate: true,
        };

        let rateId: string;
        if (existing) {
          rateId = existing.id;
          await supabase.from("rates").update(ratePayload).eq("id", rateId);
        } else {
          const { data: inserted, error: insErr } = await supabase.from("rates")
            .insert(ratePayload).select("id").single();
          if (insErr) throw insErr;
          rateId = inserted.id;
        }

        // Map site type codes → this property's site_type ids
        let priceRows = 0;
        if (prices && prices.length > 0) {
          const codes = prices.map((p) => p.site_type_code);
          const { data: siteTypes } = await supabase.from("site_types")
            .select("id, code").eq("property_id", propertyId).in("code", codes);
          const codeToId = new Map((siteTypes ?? []).map((s: any) => [s.code, s.id]));

          for (const p of prices) {
            const siteTypeId = codeToId.get(p.site_type_code);
            if (!siteTypeId) continue;
            const { data: existingPrice } = await supabase.from("rate_site_type_prices")
              .select("id").eq("rate_id", rateId).eq("site_type_id", siteTypeId).maybeSingle();
            const payload = {
              rate_id: rateId, site_type_id: siteTypeId, property_id: propertyId,
              price: p.price, adjustment_type: p.adjustment_type, adjustment_value: p.adjustment_value,
            };
            if (existingPrice) {
              await supabase.from("rate_site_type_prices").update(payload).eq("id", existingPrice.id);
            } else {
              await supabase.from("rate_site_type_prices").insert(payload);
            }
            priceRows++;
          }
        }

        // Restrictions → rate_rules (stop_sell / CTA / CTD / MinLOS)
        let ruleRows = 0;
        if (restrictions && restrictions.length > 0) {
          for (const r of restrictions) {
            await supabase.from("rate_rules").insert({
              property_id: propertyId,
              name: `${tpl.template_code}-restr-${r.start_date}`,
              rule_type: "restriction",
              conditions: {
                rate_id: rateId,
                start_date: r.start_date,
                end_date: r.end_date,
                min_los: r.min_los,
                max_los: r.max_los,
                cta: r.cta,
                ctd: r.ctd,
                stop_sell: r.stop_sell,
              },
            });
            ruleRows++;
          }
        }

        results.push({ property_id: propertyId, ok: true, rate_id: rateId, priceRows, ruleRows });
      } catch (e) {
        results.push({ property_id: propertyId, ok: false, error: String((e as Error).message ?? e) });
      }
    }

    const anyFail = results.some((r) => r.ok === false);
    await supabase.from("rate_template_pushes").update({
      status: anyFail ? "partial" : "success",
      result_summary: { results },
    }).eq("id", pushRow!.id);

    return json({ push_id: pushRow!.id, results });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
