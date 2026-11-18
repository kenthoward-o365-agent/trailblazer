import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA_CONTEXT = `
You are a helpful data analyst assistant for an RV park property management system. You have access to these database tables:

TABLES:
- reservations: id, property_id, site_id, guest_id, check_in_date, check_out_date, status (PENDING/CONFIRMED/CHECKED_IN/CHECKED_OUT/CANCELLED), total_price, guests_count, adults_count, children_count, rate_id, source_of_business_id, created_at
- guests: id, email, first_name, last_name, phone, city, state, zipcode, created_at
- sites: id, property_id, site_type_id, site_number, max_occupancy, is_active, amenities
- site_types: id, property_id, name, base_price, description
- rates: id, property_id, rate_code, description, start_date, end_date, is_base_rate
- source_of_business: id, property_id, code, definition, is_default
- ledger_accounts: id, property_id, ledger_type (advance_deposit/guest/city), balance, guest_id, reservation_id
- ledger_transactions: id, ledger_account_id, transaction_type (payment/charge/transfer/refund/adjustment), debit_amount, credit_amount, description, transaction_date
- folio_postings: id, ledger_account_id, posting_type, amount, description, posting_date
- night_audits: id, property_id, audit_date, status, total_room_revenue, total_tax_revenue, total_payments
- dayend_closes: id, property_id, close_date, status, total_revenue, total_taxes, total_payments

When the user asks a question:
1. Determine if the question can be answered with a simple text response or requires data visualization
2. Generate a safe, read-only SQL query (SELECT only, no modifications)
3. Determine the response format: "text" for simple answers, "chart" for time-series or comparative data

Respond with JSON in this exact format:
{
  "sql": "SELECT ... FROM ... WHERE ...",
  "responseType": "text" | "chart",
  "chartConfig": {
    "type": "bar" | "line" | "pie",
    "xKey": "column_name_for_x_axis",
    "yKey": "column_name_for_y_axis", 
    "title": "Chart title"
  } | null,
  "explanation": "Brief explanation of what the query does"
}

Rules:
- Only generate SELECT queries, never INSERT/UPDATE/DELETE
- Use appropriate date filters when relevant
- For revenue questions, use total_price from reservations or amounts from ledger_transactions
- For occupancy, count reservations with status CHECKED_IN for a given date range
- Always include reasonable LIMIT clauses (max 1000 rows)
- For charts, ensure data is aggregated appropriately (GROUP BY for time series)
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, propertyId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) throw new Error("Supabase credentials not configured");

    // Require authenticated staff session.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);
    const supaAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: claimsRes, error: claimsErr } = await supaAuth.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require a propertyId and verify caller has access to it.
    if (!propertyId || typeof propertyId !== "string") {
      return new Response(JSON.stringify({ error: "propertyId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userScoped = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: hasAccess } = await userScoped.rpc("user_can_access_property", {
      _property_id: propertyId,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Get AI to generate SQL query
    const scopedSchemaContext = `${SCHEMA_CONTEXT}

CRITICAL SCOPING: You MUST include \`property_id = '${propertyId}'\` in the WHERE clause of every query (including subqueries that hit multi-tenant tables). Do not query rows from other properties.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: scopedSchemaContext },
          { role: "user", content: question },
        ],
      }),
    });


    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI request failed");
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;
    console.log("AI response:", aiContent);

    // Parse the AI response
    let queryPlan;
    try {
      // Extract JSON from the response (may be wrapped in markdown code blocks)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      queryPlan = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return new Response(JSON.stringify({
        answer: "I couldn't understand that question. Could you please rephrase it?",
        type: "text",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the SQL is read-only
    const sqlLower = queryPlan.sql.toLowerCase().trim();
    if (!sqlLower.startsWith("select") || 
        sqlLower.includes("insert") || 
        sqlLower.includes("update") || 
        sqlLower.includes("delete") ||
        sqlLower.includes("drop") ||
        sqlLower.includes("alter") ||
        sqlLower.includes("truncate")) {
      return new Response(JSON.stringify({
        answer: "I can only answer questions that read data. I cannot modify the database.",
        type: "text",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce tenant scoping: query must contain the caller's propertyId literal.
    if (!queryPlan.sql.includes(propertyId)) {
      return new Response(JSON.stringify({
        answer: "That query wasn't scoped to your property. Please try rephrasing your question.",
        type: "text",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Step 2: Execute the query
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("Executing SQL:", queryPlan.sql);
    const { data: queryData, error: queryError } = await supabase.rpc('execute_readonly_query', {
      query_text: queryPlan.sql
    });

    let resultData = queryData;
    if (queryError) {
      console.error("Query execution error:", queryError.message);
      return new Response(JSON.stringify({
        answer: `I understood your question but couldn't execute the query: ${queryError.message}`,
        type: "text",
        sql: queryPlan.sql,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Format response based on type
    if (queryPlan.responseType === "chart" && queryPlan.chartConfig && Array.isArray(resultData) && resultData.length > 0) {
      return new Response(JSON.stringify({
        type: "chart",
        data: resultData,
        chartConfig: queryPlan.chartConfig,
        explanation: queryPlan.explanation,
        sql: queryPlan.sql,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate natural language answer from the data
    const answerResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a helpful data analyst. Given the query results, provide a clear, concise natural language answer. Format numbers nicely (currency with $, percentages with %). Keep it brief but informative." },
          { role: "user", content: `Question: ${question}\n\nQuery: ${queryPlan.sql}\n\nResults: ${JSON.stringify(resultData)}\n\nProvide a natural language answer:` },
        ],
      }),
    });

    const answerData = await answerResponse.json();
    const answer = answerData.choices?.[0]?.message?.content || "I found the data but couldn't formulate a response.";

    return new Response(JSON.stringify({
      type: "text",
      answer,
      data: resultData,
      sql: queryPlan.sql,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in reports-chat:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "An unexpected error occurred" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
