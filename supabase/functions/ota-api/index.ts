import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { installConsoleRedaction } from "../_shared/pci.ts";
import { assertNoCardData } from "../_shared/pci.ts";
installConsoleRedaction();
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface ApiKey {
  id: string;
  property_id: string;
  key_name: string;
  scopes: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  expires_at: string | null;
}

// Database-backed rate limiting using api_logs (persistent across cold starts and instances)
// deno-lint-ignore no-explicit-any
async function checkRateLimit(supabase: any, keyId: string, limit: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabase
    .from("api_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", keyId)
    .gte("created_at", windowStart);

  if (error) {
    // Fail closed on rate-limit lookup errors to avoid bypass
    console.error("Rate limit lookup failed:", error);
    return false;
  }
  return (count ?? 0) < limit;
}

function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required) || scopes.includes("*");
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
async function logApiRequest(supabase: any, params: {
  apiKeyId: string | null;
  propertyId: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  ipAddress: string | null;
  userAgent: string | null;
  requestBody: unknown;
  errorMessage: string | null;
}) {
  try {
    await supabase.from("api_logs").insert({
      api_key_id: params.apiKeyId,
      property_id: params.propertyId,
      endpoint: params.endpoint,
      method: params.method,
      status_code: params.statusCode,
      response_time_ms: params.responseTimeMs,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      request_body: params.requestBody,
      error_message: params.errorMessage,
    });
  } catch (e) {
    console.error("Failed to log API request:", e);
  }
}

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const path = url.pathname.split("/ota-api")[1] || "";
  const method = req.method;
  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip");
  const userAgent = req.headers.get("user-agent");

  let apiKeyRecord: ApiKey | null = null;
  let requestBody: unknown = null;

  try {
    // Get API key from header (support both x-api-key and legacy x-ota-key)
    const apiKeyHeader = req.headers.get("x-api-key") || req.headers.get("x-ota-key");
    
    if (!apiKeyHeader) {
      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: null, propertyId: null, endpoint: path, method,
        statusCode: 401, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: null, errorMessage: "Missing API key",
      });
      return new Response(JSON.stringify({ error: "Missing API key. Include x-api-key header." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hash the provided key and look it up
    const keyHash = await hashApiKey(apiKeyHeader);
    const keyPrefix = apiKeyHeader.substring(0, 8);
    
    const { data: keyData, error: keyError } = await supabase
      .from("api_keys")
      .select("id, property_id, key_name, scopes, rate_limit_per_minute, is_active, expires_at")
      .eq("key_hash", keyHash)
      .eq("key_prefix", keyPrefix)
      .single();

    if (keyError || !keyData) {
      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: null, propertyId: null, endpoint: path, method,
        statusCode: 401, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: null, errorMessage: "Invalid API key",
      });
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    apiKeyRecord = keyData as ApiKey;

    // Check if key is active
    if (!apiKeyRecord.is_active) {
      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId: apiKeyRecord.property_id, endpoint: path, method,
        statusCode: 403, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: null, errorMessage: "API key is inactive",
      });
      return new Response(JSON.stringify({ error: "API key is inactive" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiration
    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId: apiKeyRecord.property_id, endpoint: path, method,
        statusCode: 403, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: null, errorMessage: "API key has expired",
      });
      return new Response(JSON.stringify({ error: "API key has expired" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check rate limit
    if (!(await checkRateLimit(supabase, apiKeyRecord.id, apiKeyRecord.rate_limit_per_minute))) {
      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId: apiKeyRecord.property_id, endpoint: path, method,
        statusCode: 429, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: null, errorMessage: "Rate limit exceeded",
      });
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // Update last_used_at
    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKeyRecord.id);

    const propertyId = apiKeyRecord.property_id;
    const scopes = apiKeyRecord.scopes || [];

    // ==================== AVAILABILITY ====================
    if (path === "/availability" && method === "GET") {
      if (!hasScope(scopes, "availability:read")) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 403, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: null, errorMessage: "Missing scope: availability:read",
        });
        return new Response(JSON.stringify({ error: "Missing required scope: availability:read" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const checkIn = url.searchParams.get("check_in");
      const checkOut = url.searchParams.get("check_out");
      const siteType = url.searchParams.get("site_type");

      if (!checkIn || !checkOut) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 400, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: null, errorMessage: "Missing check_in or check_out parameter",
        });
        return new Response(JSON.stringify({ error: "Missing required parameters: check_in, check_out" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let query = supabase.from("sites").select("*, site_types(*)").eq("property_id", propertyId).eq("is_active", true);
      if (siteType) query = query.eq("site_type_id", siteType);
      const { data: sites } = await query;

      const { data: bookedSites } = await supabase
        .from("reservations").select("site_id").eq("property_id", propertyId)
        .lte("check_in_date", checkOut).gte("check_out_date", checkIn)
        .in("status", ["CONFIRMED", "CHECKED_IN", "PENDING"]);

      const bookedSiteIds = new Set(bookedSites?.map((b: { site_id: string }) => b.site_id) || []);
      const available = sites?.filter((site: { id: string }) => !bookedSiteIds.has(site.id)) || [];

      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
        statusCode: 200, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: { check_in: checkIn, check_out: checkOut, site_type: siteType }, errorMessage: null,
      });

      return new Response(JSON.stringify({ 
        available: available.length, available_sites: available, total_sites: sites?.length || 0, property_id: propertyId
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== RATES ====================
    if (path === "/rates" && method === "GET") {
      if (!hasScope(scopes, "rates:read")) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 403, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: null, errorMessage: "Missing scope: rates:read",
        });
        return new Response(JSON.stringify({ error: "Missing required scope: rates:read" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: siteTypes } = await supabase.from("site_types").select("*").eq("property_id", propertyId);
      const { data: rates } = await supabase.from("rates").select("*, rate_site_type_prices(*), rate_seasons(*)").eq("property_id", propertyId);

      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
        statusCode: 200, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: null, errorMessage: null,
      });

      return new Response(JSON.stringify({ site_types: siteTypes, rates, property_id: propertyId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== CREATE RESERVATION ====================
    if (path === "/reservations" && method === "POST") {
      if (!hasScope(scopes, "reservations:write")) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 403, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: null, errorMessage: "Missing scope: reservations:write",
        });
        return new Response(JSON.stringify({ error: "Missing required scope: reservations:write" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      assertNoCardData(body);
      requestBody = body;
      const { guest, site_id, check_in_date, check_out_date, total_price, source } = body;

      if (!guest?.email || !guest?.first_name || !guest?.last_name || !site_id || !check_in_date || !check_out_date) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 400, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: body, errorMessage: "Missing required fields",
        });
        return new Response(JSON.stringify({ 
          error: "Missing required fields",
          required: ["guest.email", "guest.first_name", "guest.last_name", "site_id", "check_in_date", "check_out_date"]
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Verify site belongs to this property
      const { data: siteData } = await supabase.from("sites").select("id, property_id").eq("id", site_id).eq("property_id", propertyId).single();
      if (!siteData) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 400, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: body, errorMessage: "Site not found or does not belong to this property",
        });
        return new Response(JSON.stringify({ error: "Site not found or does not belong to this property" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get property's organization for guest
      const { data: propertyData } = await supabase.from("properties").select("organization_id").eq("id", propertyId).single();

      // Create or get guest
      let guestId;
      const { data: existingGuest } = await supabase.from("guests").select("id").eq("email", guest.email).eq("organization_id", propertyData?.organization_id).single();

      if (existingGuest) {
        guestId = existingGuest.id;
      } else {
        const { data: newGuest, error: guestError } = await supabase.from("guests").insert({
          email: guest.email, first_name: guest.first_name, last_name: guest.last_name,
          phone: guest.phone || null, organization_id: propertyData?.organization_id, origin_property_id: propertyId,
        }).select().single();
        if (guestError) throw new Error(`Failed to create guest: ${guestError.message}`);
        guestId = newGuest.id;
      }

      // Create reservation
      const { data: reservation, error: reservationError } = await supabase.from("reservations").insert({
        property_id: propertyId, site_id, guest_id: guestId, check_in_date, check_out_date,
        status: "CONFIRMED", total_price: total_price || 0, guests_count: guest.guests_count || 2,
        adults_count: guest.adults_count || 2, children_count: guest.children_count || 0, source: source || "ota",
      }).select("*, confirmation_number").single();

      if (reservationError) throw new Error(`Failed to create reservation: ${reservationError.message}`);

      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
        statusCode: 201, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: body, errorMessage: null,
      });

      return new Response(JSON.stringify({ 
        success: true, reservation_id: reservation.id, confirmation_number: reservation.confirmation_number, property_id: propertyId
      }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== LIST RESERVATIONS ====================
    if (path === "/reservations" && method === "GET") {
      if (!hasScope(scopes, "reservations:read")) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 403, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: null, errorMessage: "Missing scope: reservations:read",
        });
        return new Response(JSON.stringify({ error: "Missing required scope: reservations:read" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const confirmationNumber = url.searchParams.get("confirmation_number");
      const status = url.searchParams.get("status");
      const fromDate = url.searchParams.get("from_date");
      const toDate = url.searchParams.get("to_date");
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      let query = supabase.from("reservations").select("*, guests(*), sites(*, site_types(*))", { count: "exact" })
        .eq("property_id", propertyId).order("check_in_date", { ascending: false }).range(offset, offset + limit - 1);

      if (confirmationNumber) query = query.eq("confirmation_number", confirmationNumber);
      if (status) query = query.eq("status", status);
      if (fromDate) query = query.gte("check_in_date", fromDate);
      if (toDate) query = query.lte("check_in_date", toDate);

      const { data: reservations, count, error } = await query;
      if (error) throw new Error(`Failed to fetch reservations: ${error.message}`);

      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
        statusCode: 200, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: { confirmationNumber, status, fromDate, toDate, limit, offset }, errorMessage: null,
      });

      return new Response(JSON.stringify({ reservations, total: count, limit, offset, property_id: propertyId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== UPDATE RESERVATION ====================
    if (path.startsWith("/reservations/") && method === "PATCH") {
      if (!hasScope(scopes, "reservations:write")) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 403, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: null, errorMessage: "Missing scope: reservations:write",
        });
        return new Response(JSON.stringify({ error: "Missing required scope: reservations:write" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const reservationId = path.split("/")[2];
      const body = await req.json();
      assertNoCardData(body);
      requestBody = body;

      const { data: existingRes } = await supabase.from("reservations").select("id").eq("id", reservationId).eq("property_id", propertyId).single();
      if (!existingRes) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 404, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: body, errorMessage: "Reservation not found",
        });
        return new Response(JSON.stringify({ error: "Reservation not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allowedFields = ["check_in_date", "check_out_date", "status", "total_price", "guests_count", "adults_count", "children_count", "special_requests"];
      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }

      const { error } = await supabase.from("reservations").update(updateData).eq("id", reservationId).eq("property_id", propertyId);
      if (error) throw new Error(`Failed to update reservation: ${error.message}`);

      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
        statusCode: 200, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: body, errorMessage: null,
      });

      return new Response(JSON.stringify({ success: true, reservation_id: reservationId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== CANCEL RESERVATION ====================
    if (path.startsWith("/reservations/") && method === "DELETE") {
      if (!hasScope(scopes, "reservations:write")) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 403, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: null, errorMessage: "Missing scope: reservations:write",
        });
        return new Response(JSON.stringify({ error: "Missing required scope: reservations:write" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const reservationId = path.split("/")[2];

      const { data: existingRes } = await supabase.from("reservations").select("id").eq("id", reservationId).eq("property_id", propertyId).single();
      if (!existingRes) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 404, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: null, errorMessage: "Reservation not found",
        });
        return new Response(JSON.stringify({ error: "Reservation not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase.from("reservations").update({ status: "CANCELLED" }).eq("id", reservationId).eq("property_id", propertyId);
      if (error) throw new Error(`Failed to cancel reservation: ${error.message}`);

      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
        statusCode: 200, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: null, errorMessage: null,
      });

      return new Response(JSON.stringify({ success: true, reservation_id: reservationId, status: "CANCELLED" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== ENDPOINT NOT FOUND ====================
    const responseTime = Date.now() - startTime;
    await logApiRequest(supabase, {
      apiKeyId: apiKeyRecord?.id || null, propertyId: apiKeyRecord?.property_id || null, endpoint: path, method,
      statusCode: 404, responseTimeMs: responseTime, ipAddress, userAgent,
      requestBody: null, errorMessage: "Endpoint not found",
    });

    return new Response(JSON.stringify({ error: "Endpoint not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("OTA API Error:", error);
    
    const responseTime = Date.now() - startTime;
    await logApiRequest(supabase, {
      apiKeyId: apiKeyRecord?.id || null, propertyId: apiKeyRecord?.property_id || null, endpoint: path, method,
      statusCode: 500, responseTimeMs: responseTime, ipAddress, userAgent,
      requestBody, errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
