import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Campaign {
  id: string;
  name: string;
  subject: string | null;
  content: string | null;
  channel: string;
  trigger_type: string;
  trigger_days: number | null;
  segment_filters: Record<string, any> | null;
  property_id: string;
}

interface Reservation {
  id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  guest: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    city: string | null;
    state: string | null;
    birthday: string | null;
    anniversary: string | null;
  };
  source_of_business_id: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Restrict to internal scheduler (service-role bearer) — mirrors pci-retention-sweep.
  const auth = req.headers.get("authorization") ?? "";
  if (!supabaseServiceKey || auth !== `Bearer ${supabaseServiceKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);


  try {
    console.log("Starting campaign processing...");

    // Get all active automated campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("status", "active")
      .neq("trigger_type", "manual");

    if (campaignsError) {
      console.error("Error fetching campaigns:", campaignsError);
      throw campaignsError;
    }

    console.log(`Found ${campaigns?.length || 0} active automated campaigns`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];

    let totalSent = 0;
    const results: { campaign: string; sent: number; errors: string[] }[] = [];

    for (const campaign of campaigns || []) {
      console.log(`Processing campaign: ${campaign.name} (${campaign.trigger_type})`);
      
      const campaignResult = { campaign: campaign.name, sent: 0, errors: [] as string[] };
      
      try {
        let targetReservations: Reservation[] = [];

        if (campaign.trigger_type === "pre_arrival") {
          // Find reservations X days before check-in
          const targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() + (campaign.trigger_days || 1));
          const targetDateStr = targetDate.toISOString().split("T")[0];

          console.log(`Looking for pre-arrival reservations checking in on: ${targetDateStr}`);

          const { data, error } = await supabase
            .from("reservations")
            .select(`
              id, guest_id, check_in_date, check_out_date, status, source_of_business_id,
              guest:guests(id, first_name, last_name, email, phone, city, state, birthday, anniversary)
            `)
            .eq("check_in_date", targetDateStr)
            .in("status", ["CONFIRMED", "PENDING"])
            .eq("property_id", campaign.property_id);

          if (error) throw error;
          targetReservations = (data as unknown as Reservation[]) || [];
          
        } else if (campaign.trigger_type === "post_departure") {
          // Find reservations X days after check-out
          const targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() - (campaign.trigger_days || 1));
          const targetDateStr = targetDate.toISOString().split("T")[0];

          console.log(`Looking for post-departure reservations checked out on: ${targetDateStr}`);

          const { data, error } = await supabase
            .from("reservations")
            .select(`
              id, guest_id, check_in_date, check_out_date, status, source_of_business_id,
              guest:guests(id, first_name, last_name, email, phone, city, state, birthday, anniversary)
            `)
            .eq("check_out_date", targetDateStr)
            .eq("status", "CHECKED_OUT")
            .eq("property_id", campaign.property_id);

          if (error) throw error;
          targetReservations = (data as unknown as Reservation[]) || [];
          
        } else if (campaign.trigger_type === "in_house") {
          // Find currently checked-in guests
          console.log("Looking for in-house guests (CHECKED_IN status)");

          const { data, error } = await supabase
            .from("reservations")
            .select(`
              id, guest_id, check_in_date, check_out_date, status, source_of_business_id,
              guest:guests(id, first_name, last_name, email, phone, city, state, birthday, anniversary)
            `)
            .eq("status", "CHECKED_IN")
            .eq("property_id", campaign.property_id);

          if (error) throw error;
          targetReservations = (data as unknown as Reservation[]) || [];
        }

        console.log(`Found ${targetReservations.length} matching reservations`);

        // Apply segment filters
        const filters = campaign.segment_filters || {};
        let filteredReservations = targetReservations;

        if (filters.city) {
          filteredReservations = filteredReservations.filter(r => 
            r.guest?.city?.toLowerCase().includes(filters.city.toLowerCase())
          );
        }
        if (filters.state) {
          filteredReservations = filteredReservations.filter(r => 
            r.guest?.state?.toLowerCase().includes(filters.state.toLowerCase())
          );
        }
        if (filters.source_of_business_id) {
          filteredReservations = filteredReservations.filter(r => 
            r.source_of_business_id === filters.source_of_business_id
          );
        }
        if (filters.birthday_month) {
          filteredReservations = filteredReservations.filter(r => {
            if (!r.guest?.birthday) return false;
            const month = new Date(r.guest.birthday).getMonth() + 1;
            return month === filters.birthday_month;
          });
        }
        if (filters.anniversary_month) {
          filteredReservations = filteredReservations.filter(r => {
            if (!r.guest?.anniversary) return false;
            const month = new Date(r.guest.anniversary).getMonth() + 1;
            return month === filters.anniversary_month;
          });
        }

        console.log(`After filtering: ${filteredReservations.length} reservations`);

        // Check for already sent campaigns to avoid duplicates
        const { data: existingSends } = await supabase
          .from("campaign_sends")
          .select("reservation_id")
          .eq("campaign_id", campaign.id);

        const sentReservationIds = new Set(existingSends?.map(s => s.reservation_id) || []);
        const newReservations = filteredReservations.filter(r => !sentReservationIds.has(r.id));

        console.log(`New reservations to send to: ${newReservations.length}`);

        // Send to each guest (mocked)
        for (const reservation of newReservations) {
          const guest = reservation.guest;
          if (!guest?.email && campaign.channel === "email") {
            console.log(`Skipping guest ${guest?.first_name} - no email`);
            continue;
          }
          if (!guest?.phone && campaign.channel === "sms") {
            console.log(`Skipping guest ${guest?.first_name} - no phone`);
            continue;
          }

          // Replace template variables in content
          let content = campaign.content || "";
          content = content.replace(/\{\{first_name\}\}/g, guest?.first_name || "Guest");
          content = content.replace(/\{\{last_name\}\}/g, guest?.last_name || "");
          content = content.replace(/\{\{check_in_date\}\}/g, reservation.check_in_date);
          content = content.replace(/\{\{check_out_date\}\}/g, reservation.check_out_date);

          // MOCKED: Log instead of sending
          console.log(`[MOCKED] Sending ${campaign.channel} to ${guest?.email || guest?.phone}:`);
          console.log(`  Subject: ${campaign.subject}`);
          console.log(`  Content preview: ${content.substring(0, 100)}...`);

          // Record the send
          const { error: sendError } = await supabase
            .from("campaign_sends")
            .insert({
              campaign_id: campaign.id,
              guest_id: guest.id,
              reservation_id: reservation.id,
              status: "sent",
            });

          if (sendError) {
            console.error(`Error recording send:`, sendError);
            campaignResult.errors.push(`Failed to record send for ${guest?.email}`);
          } else {
            campaignResult.sent++;
            totalSent++;
          }
        }

        // Update campaign sent_count
        if (campaignResult.sent > 0) {
          await supabase
            .from("campaigns")
            .update({ 
              sent_count: (campaign.sent_count || 0) + campaignResult.sent,
              updated_at: new Date().toISOString()
            })
            .eq("id", campaign.id);
        }

      } catch (err: any) {
        console.error(`Error processing campaign ${campaign.name}:`, err);
        campaignResult.errors.push(err.message);
      }

      results.push(campaignResult);
    }

    console.log(`Campaign processing complete. Total sent: ${totalSent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        totalSent,
        results,
        processedAt: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in process-campaigns function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
