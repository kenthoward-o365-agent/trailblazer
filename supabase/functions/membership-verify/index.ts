// Verify a membership number + last name and return active discount info.
// Called from the public booking engine ("Both" identity mode) and by front-desk staff.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  member_number: z.string().trim().min(3).max(40),
  last_name: z.string().trim().min(1).max(100),
  property_id: z.string().uuid().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { member_number, last_name, property_id } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: member } = await admin
      .from("member_accounts")
      .select("id, program_id, tier_id, status, expires_at, guest_id, member_number, points_balance, organization_id")
      .eq("member_number", member_number.toUpperCase())
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ verified: false, reason: "not_found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Match last name against guest record
    let nameOk = false;
    if (member.guest_id) {
      const { data: g } = await admin.from("guests").select("last_name").eq("id", member.guest_id).maybeSingle();
      nameOk = !!g && g.last_name?.trim().toLowerCase() === last_name.trim().toLowerCase();
    }
    if (!nameOk) {
      return new Response(JSON.stringify({ verified: false, reason: "name_mismatch" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (member.status !== "active" || (member.expires_at && new Date(member.expires_at) < new Date())) {
      return new Response(JSON.stringify({ verified: false, reason: "inactive" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Property eligibility check + resolve tier discount
    if (property_id) {
      const { data: eligible } = await admin
        .from("membership_program_properties")
        .select("id")
        .eq("program_id", member.program_id)
        .eq("property_id", property_id)
        .limit(1);
      if (!eligible?.length) {
        return new Response(JSON.stringify({ verified: false, reason: "not_eligible_at_property" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const [{ data: program }, { data: tier }] = await Promise.all([
      admin.from("membership_programs").select("name, code, currency").eq("id", member.program_id).maybeSingle(),
      member.tier_id
        ? admin.from("membership_tiers").select("name, discount_percent, free_nights_per_year, points_multiplier, priority").eq("id", member.tier_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return new Response(JSON.stringify({
      verified: true,
      member_account_id: member.id,
      member_number: member.member_number,
      program: program ?? null,
      tier: tier ?? null,
      discount_percent: tier ? Number((tier as any).discount_percent ?? 0) : 0,
      points_balance: Number(member.points_balance ?? 0),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("membership-verify", e);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
