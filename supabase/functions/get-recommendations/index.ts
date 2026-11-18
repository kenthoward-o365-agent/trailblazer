import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reservationId } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Require an authenticated staff session.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);
    const supaAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: claimsRes, error: claimsErr } = await supaAuth.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get reservation details
    const { data: reservation } = await supabase
      .from("reservations")
      .select("*, sites(*, site_types(*)), guests(*)")
      .eq("id", reservationId)
      .single();

    if (!reservation) {
      return new Response(JSON.stringify({ error: "Reservation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller has access to this reservation's property.
    const userScoped = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: hasAccess } = await userScoped.rpc("user_can_access_property", {
      _property_id: reservation.property_id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Handle case where site is not assigned (type_floating hotels)
    const siteTypeId = reservation.sites?.site_type_id;
    const siteTypeName = reservation.sites?.site_types?.name || 'Room';
    
    // Get available sites of same type (only if we have a site type)
    let sites: any[] = [];
    if (siteTypeId) {
      const { data: sitesData } = await supabase
        .from("sites")
        .select("*")
        .eq("site_type_id", siteTypeId)
        .limit(10);
      sites = sitesData || [];
    }

    // Get add-ons
    const { data: addOns } = await supabase.from("add_ons").select("*").eq("is_active", true);

    // Call Lovable AI for recommendations
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an RV park recommendation assistant. Provide personalized site and add-on suggestions.",
          },
          {
            role: "user",
            content: `Guest ${reservation.guests?.first_name || 'Guest'} booked ${siteTypeName} for ${reservation.guests_count} people. Recommend 3 alternative sites and 1 add-on from: Sites: ${JSON.stringify(sites?.slice(0, 5))} Add-ons: ${JSON.stringify(addOns?.slice(0, 5))}. Return JSON with: {recommended_sites: [{site_number, reason}], recommended_add_on: {name, reason}}`,
          },
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    let recommendations;

    try {
      recommendations = JSON.parse(content);
    } catch {
      recommendations = {
        recommended_sites: [
          { site_number: "P1", reason: "Lake view with premium amenities" },
          { site_number: "A5", reason: "Quiet location with easy access" },
          { site_number: "T3", reason: "Perfect for outdoor enthusiasts" },
        ],
        recommended_add_on: { name: "Firewood Bundle", reason: "Enhance your camping experience" },
      };
    }

    // Save recommendations
    await supabase.from("reservation_recommendations").insert({
      reservation_id: reservationId,
      recommended_sites: recommendations.recommended_sites,
      recommended_add_on: recommendations.recommended_add_on,
    });

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
