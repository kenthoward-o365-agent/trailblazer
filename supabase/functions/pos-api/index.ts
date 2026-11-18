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

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(keyId: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(keyId);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(keyId, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  if (entry.count >= limit) {
    return false;
  }
  
  entry.count++;
  return true;
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
      endpoint: `pos-api${params.endpoint}`,
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
  const path = url.pathname.split("/pos-api")[1] || "";
  const method = req.method;
  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip");
  const userAgent = req.headers.get("user-agent");

  let apiKeyRecord: ApiKey | null = null;
  let requestBody: unknown = null;

  try {
    // Get API key from header
    const apiKeyHeader = req.headers.get("x-api-key");
    
    if (!apiKeyHeader) {
      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: null, propertyId: null, endpoint: path, method,
        statusCode: 401, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: null, errorMessage: "Missing API key",
      });
      return new Response(JSON.stringify({ success: false, error: "Missing API key. Include x-api-key header." }), {
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
      return new Response(JSON.stringify({ success: false, error: "Invalid API key" }), {
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
      return new Response(JSON.stringify({ success: false, error: "API key is inactive" }), {
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
      return new Response(JSON.stringify({ success: false, error: "API key has expired" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check rate limit
    if (!checkRateLimit(apiKeyRecord.id, apiKeyRecord.rate_limit_per_minute)) {
      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId: apiKeyRecord.property_id, endpoint: path, method,
        statusCode: 429, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: null, errorMessage: "Rate limit exceeded",
      });
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded. Try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // Update last_used_at
    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKeyRecord.id);

    const propertyId = apiKeyRecord.property_id;
    const scopes = apiKeyRecord.scopes || [];

    // ==================== ROOM LOOKUP ====================
    // GET /pos-api/rooms/:room_number
    const roomMatch = path.match(/^\/rooms\/(.+)$/);
    if (roomMatch && method === "GET") {
      if (!hasScope(scopes, "pos:read")) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 403, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: null, errorMessage: "Missing scope: pos:read",
        });
        return new Response(JSON.stringify({ success: false, error: "Missing required scope: pos:read" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rawRoomNumber = decodeURIComponent(roomMatch[1]).trim();
      // Normalize room number: strip leading zeros for purely numeric values
      const roomNumber = /^\d+$/.test(rawRoomNumber) 
        ? String(parseInt(rawRoomNumber, 10)) 
        : rawRoomNumber;

      console.log(`Room lookup: raw="${rawRoomNumber}", normalized="${roomNumber}", propertyId="${propertyId}"`);

      // Step 1: Look up site by room number
      const { data: site, error: siteError } = await supabase
        .from("sites")
        .select("id, site_number, site_type_id, site_types(id, name)")
        .eq("property_id", propertyId)
        .eq("site_number", roomNumber)
        .single();

      if (siteError || !site) {
        console.log(`Site lookup failed: ${siteError?.message || "No site found"}`);
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 404, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: { room_number: roomNumber, raw_room_number: rawRoomNumber }, 
          errorMessage: `Room ${roomNumber} not found`,
        });
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Room ${roomNumber} not found` 
        }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Site found: id="${site.id}", site_number="${site.site_number}"`);

      // Step 2: Find checked-in reservation for this site
      // Use explicit FK relationship to avoid ambiguity with city_ledger_account_id
      // Use maybeSingle() to return a single object (or null) instead of an array
      const { data: reservation, error: resError } = await supabase
        .from("reservations")
        .select(`
          id,
          confirmation_number,
          check_in_date,
          check_out_date,
          guest_id,
          site_id,
          guests!inner (
            id,
            first_name,
            last_name
          ),
          ledger_accounts!ledger_accounts_reservation_id_fkey (
            id,
            balance,
            ledger_type,
            is_active
          )
        `)
        .eq("property_id", propertyId)
        .eq("site_id", site.id)
        .in("status", ["CHECKED_IN", "CHECK_IN_HOLD"])
        .order("check_in_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (resError) {
        console.log(`Reservation lookup error: ${resError.message}`);
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 404, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: { room_number: roomNumber, site_id: site.id }, 
          errorMessage: `Reservation lookup error: ${resError.message}`,
        });
        return new Response(JSON.stringify({ 
          success: false, 
          error: `No in-house guest found for room ${roomNumber}` 
        }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // deno-lint-ignore no-explicit-any
      const res = reservation as any;

      // Filter for active guest ledger accounts in application code
      // (since we removed the embedded filter to fix FK ambiguity)
      const guestLedgerAccounts = (res.ledger_accounts || []).filter(
        // deno-lint-ignore no-explicit-any
        (la: any) => la.ledger_type === "guest" && la.is_active === true
      );

      if (!reservation || guestLedgerAccounts.length === 0) {
        console.log(`No active guest ledger found for reservation ${res?.id || "none"}`);
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 404, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: { room_number: roomNumber, site_id: site.id }, 
          errorMessage: `No in-house guest found for room ${roomNumber}`,
        });
        return new Response(JSON.stringify({ 
          success: false, 
          error: `No in-house guest found for room ${roomNumber}` 
        }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Found reservation: id="${res.id}", guest="${res.guests.first_name} ${res.guests.last_name}"`);

      // deno-lint-ignore no-explicit-any
      const siteData = site as any;
      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
        statusCode: 200, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: { room_number: roomNumber }, errorMessage: null,
      });

      return new Response(JSON.stringify({
        success: true,
        room_number: siteData.site_number,
        guest_name: `${res.guests.first_name} ${res.guests.last_name}`,
        folio_id: guestLedgerAccounts[0]?.id || null,
        reservation_id: res.id,
        confirmation_number: res.confirmation_number,
        check_in_date: res.check_in_date,
        check_out_date: res.check_out_date,
        room_type: siteData.site_types?.name || null,
        folio_balance: guestLedgerAccounts[0]?.balance || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== LIST F&B ACCOUNTS ====================
    // GET /pos-api/accounts
    if (path === "/accounts" && method === "GET") {
      if (!hasScope(scopes, "pos:read")) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 403, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: null, errorMessage: "Missing scope: pos:read",
        });
        return new Response(JSON.stringify({ success: false, error: "Missing required scope: pos:read" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get revenue accounts that have an external_account set (for POS mapping)
      const { data: accounts, error: accountsError } = await supabase
        .from("accounts")
        .select(`
          id,
          code,
          name,
          external_account,
          account_groups!inner (
            account_type
          )
        `)
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .eq("account_groups.account_type", "revenue")
        .not("external_account", "is", null)
        .order("code");

      if (accountsError) {
        throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
      }

      // deno-lint-ignore no-explicit-any
      const formattedAccounts = (accounts || []).map((acc: any) => ({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        pos_code: acc.external_account,
      }));

      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
        statusCode: 200, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: null, errorMessage: null,
      });

      return new Response(JSON.stringify({
        success: true,
        accounts: formattedAccounts,
        count: formattedAccounts.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== POST CHARGE TO FOLIO ====================
    // POST /pos-api/postings
    if (path === "/postings" && method === "POST") {
      if (!hasScope(scopes, "pos:write")) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 403, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: null, errorMessage: "Missing scope: pos:write",
        });
        return new Response(JSON.stringify({ success: false, error: "Missing required scope: pos:write" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      assertNoCardData(body);
      requestBody = body;
      const { room_number, pos_code, amount, description, check_number, pos_transaction_id } = body;

      // Validate required fields
      if (!room_number) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 400, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: body, errorMessage: "Missing required field: room_number",
        });
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Missing required field: room_number" 
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!pos_code) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 400, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: body, errorMessage: "Missing required field: pos_code",
        });
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Missing required field: pos_code" 
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (typeof amount !== "number" || amount <= 0) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 400, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: body, errorMessage: "Amount must be a positive number",
        });
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Amount must be a positive number" 
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Normalize room number: strip leading zeros for purely numeric values
      const rawRoomNumber = String(room_number).trim();
      const normalizedRoomNumber = /^\d+$/.test(rawRoomNumber) 
        ? String(parseInt(rawRoomNumber, 10)) 
        : rawRoomNumber;

      console.log(`Posting: raw="${rawRoomNumber}", normalized="${normalizedRoomNumber}", propertyId="${propertyId}"`);

      // Step 1: Look up site by room number
      const { data: site, error: siteError } = await supabase
        .from("sites")
        .select("id, site_number")
        .eq("property_id", propertyId)
        .eq("site_number", normalizedRoomNumber)
        .single();

      if (siteError || !site) {
        console.log(`Site lookup failed for posting: ${siteError?.message || "No site found"}`);
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 404, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: body, errorMessage: `Room ${normalizedRoomNumber} not found`,
        });
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Room ${normalizedRoomNumber} not found` 
        }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 2: Find checked-in reservation for this site
      // Use explicit FK relationship to avoid ambiguity with city_ledger_account_id
      const { data: reservation, error: resError } = await supabase
        .from("reservations")
        .select(`
          id,
          confirmation_number,
          guest_id,
          guests!inner (
            first_name,
            last_name
          ),
          ledger_accounts!ledger_accounts_reservation_id_fkey (
            id,
            balance,
            ledger_type,
            is_active
          )
        `)
        .eq("property_id", propertyId)
        .eq("site_id", site.id)
        .eq("status", "CHECKED_IN")
        .single();

      if (resError) {
        console.log(`Reservation lookup error for posting: ${resError.message}`);
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 404, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: body, errorMessage: `Reservation lookup error: ${resError.message}`,
        });
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Room ${normalizedRoomNumber} not currently in-house` 
        }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // deno-lint-ignore no-explicit-any
      const res = reservation as any;

      // Filter for active guest ledger accounts in application code
      const guestLedgerAccounts = (res.ledger_accounts || []).filter(
        // deno-lint-ignore no-explicit-any
        (la: any) => la.ledger_type === "guest" && la.is_active === true
      );

      if (!reservation || guestLedgerAccounts.length === 0) {
        console.log(`No active guest ledger for posting to room ${normalizedRoomNumber}`);
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 404, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: body, errorMessage: `Room ${normalizedRoomNumber} not currently in-house`,
        });
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Room ${normalizedRoomNumber} not currently in-house` 
        }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Look up account by POS code (external_account)
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("id, code, name")
        .eq("property_id", propertyId)
        .eq("external_account", pos_code)
        .eq("is_active", true)
        .single();

      if (accountError || !account) {
        const responseTime = Date.now() - startTime;
        await logApiRequest(supabase, {
          apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
          statusCode: 400, responseTimeMs: responseTime, ipAddress, userAgent,
          requestBody: body, errorMessage: `Invalid POS code: ${pos_code}`,
        });
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Invalid POS code: ${pos_code}. Please check Integration Mappings.` 
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const folioId = guestLedgerAccounts[0]?.id;
      const currentBalance = guestLedgerAccounts[0]?.balance || 0;
      const guestName = `${res.guests.first_name} ${res.guests.last_name}`;

      // Build description
      let postingDescription = description || account.name;
      if (check_number) {
        postingDescription = `${check_number} - ${postingDescription}`;
      }

      // Create folio posting
      const { data: posting, error: postingError } = await supabase
        .from("folio_postings")
        .insert({
          ledger_account_id: folioId,
          account_id: account.id,
          posting_type: "charge",
          amount: amount,
          debit_amount: amount,
          credit_amount: 0,
          description: postingDescription,
          posting_date: new Date().toISOString().split("T")[0],
          posted_by_name: "POS System",
          running_balance: currentBalance + amount,
        })
        .select("id, created_at")
        .single();

      if (postingError) {
        throw new Error(`Failed to create posting: ${postingError.message}`);
      }

      // Update ledger account balance
      await supabase
        .from("ledger_accounts")
        .update({ balance: currentBalance + amount })
        .eq("id", folioId);

      const newBalance = currentBalance + amount;

      const responseTime = Date.now() - startTime;
      await logApiRequest(supabase, {
        apiKeyId: apiKeyRecord.id, propertyId, endpoint: path, method,
        statusCode: 201, responseTimeMs: responseTime, ipAddress, userAgent,
        requestBody: body, errorMessage: null,
      });

      console.log(`POS posting created: Room ${room_number}, Amount: $${amount}, Account: ${account.name}, TX: ${pos_transaction_id || "N/A"}`);

      return new Response(JSON.stringify({
        success: true,
        posting_id: posting.id,
        folio_id: folioId,
        reservation_id: res.id,
        confirmation_number: res.confirmation_number,
        guest_name: guestName,
        room_number: room_number,
        account_name: account.name,
        amount: amount,
        new_balance: newBalance,
        posted_at: posting.created_at,
      }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==================== 404 - ENDPOINT NOT FOUND ====================
    const responseTime = Date.now() - startTime;
    await logApiRequest(supabase, {
      apiKeyId: apiKeyRecord?.id || null, 
      propertyId: apiKeyRecord?.property_id || null, 
      endpoint: path, 
      method,
      statusCode: 404, 
      responseTimeMs: responseTime, 
      ipAddress, 
      userAgent,
      requestBody: null, 
      errorMessage: "Endpoint not found",
    });

    return new Response(JSON.stringify({ 
      success: false, 
      error: "Endpoint not found",
      available_endpoints: [
        "GET /pos-api/rooms/:room_number - Look up in-house guest by room",
        "GET /pos-api/accounts - List F&B accounts with POS codes",
        "POST /pos-api/postings - Post a charge to a guest folio",
      ]
    }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("POS API Error:", error);
    const responseTime = Date.now() - startTime;
    await logApiRequest(supabase, {
      apiKeyId: apiKeyRecord?.id || null, 
      propertyId: apiKeyRecord?.property_id || null, 
      endpoint: path, 
      method,
      statusCode: 500, 
      responseTimeMs: responseTime, 
      ipAddress, 
      userAgent,
      requestBody, 
      errorMessage: errorMessage,
    });

    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
