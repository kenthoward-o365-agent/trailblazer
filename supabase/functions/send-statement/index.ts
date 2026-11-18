import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StatementRequest {
  cityLedgerAccountId: string;
  recipientEmail: string;
  statementHtml: string;
  propertyId: string;
  totalAmount: number;
  senderName: string;
  propertyName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const isMockMode = !resendApiKey;
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Require authenticated staff caller.
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);
    const supaAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: claimsRes, error: claimsErr } = await supaAuth.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { 
      cityLedgerAccountId, 
      recipientEmail, 
      statementHtml,
      propertyId,
      totalAmount,
      senderName,
      propertyName
    }: StatementRequest = await req.json();

    // Verify caller has access to this property.
    const userScoped = createClient(supabaseUrl, supabaseAnonKey, {
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

    // Verify the ledger account actually belongs to that property.
    const { data: ledgerCheck, error: ledgerErr } = await supabase
      .from("ledger_accounts")
      .select("id, property_id")
      .eq("id", cityLedgerAccountId)
      .maybeSingle();
    if (ledgerErr || !ledgerCheck || ledgerCheck.property_id !== propertyId) {
      return new Response(JSON.stringify({ error: "ledger account does not belong to property" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing statement send request for account: ${cityLedgerAccountId}`);


    // Get account details
    const { data: account, error: accountError } = await supabase
      .from("ledger_accounts")
      .select("company_name, contact_name, contact_email")
      .eq("id", cityLedgerAccountId)
      .single();

    if (accountError) {
      console.error("Error fetching account:", accountError);
      throw new Error("Failed to fetch account details");
    }

    const companyName = account?.company_name || account?.contact_name || "Customer";

    if (isMockMode) {
      // MOCK MODE: Log what would be sent
      console.log("=".repeat(50));
      console.log("MOCK EMAIL MODE - No RESEND_API_KEY configured");
      console.log("=".repeat(50));
      console.log(`To: ${recipientEmail}`);
      console.log(`Subject: Statement of Account - ${companyName}`);
      console.log(`From: ${propertyName || "Property"}`);
      console.log(`Amount Due: $${totalAmount.toFixed(2)}`);
      console.log(`Content length: ${statementHtml.length} characters`);
      console.log("=".repeat(50));
      console.log("To enable real email sending:");
      console.log("1. Sign up at https://resend.com");
      console.log("2. Verify your domain");
      console.log("3. Add RESEND_API_KEY secret in Lovable");
      console.log("=".repeat(50));

      // Record mock send in database
      const { error: insertError } = await supabase.from("statement_sends").insert({
        city_ledger_account_id: cityLedgerAccountId,
        sent_to_email: recipientEmail,
        statement_date: new Date().toISOString().split('T')[0],
        total_amount: totalAmount,
        sent_by_name: senderName,
        is_mock: true,
        property_id: propertyId,
      });

      if (insertError) {
        console.error("Error recording statement send:", insertError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          mock: true,
          message: "Statement logged in mock mode. Add RESEND_API_KEY to send real emails.",
          details: { 
            to: recipientEmail, 
            company: companyName,
            amount: totalAmount
          }
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // REAL MODE: Send via Resend
    console.log("Sending real email via Resend...");
    const resend = new Resend(resendApiKey);
    
    const emailResponse = await resend.emails.send({
      from: `${propertyName || "Statements"} <statements@${propertyName?.toLowerCase().replace(/\s+/g, '') || "property"}.com>`,
      to: [recipientEmail],
      subject: `Statement of Account - ${companyName}`,
      html: statementHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    // Record real send in database
    const { error: insertError } = await supabase.from("statement_sends").insert({
      city_ledger_account_id: cityLedgerAccountId,
      sent_to_email: recipientEmail,
      statement_date: new Date().toISOString().split('T')[0],
      total_amount: totalAmount,
      sent_by_name: senderName,
      is_mock: false,
      property_id: propertyId,
    });

    if (insertError) {
      console.error("Error recording statement send:", insertError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        mock: false, 
        emailId: emailResponse.data?.id,
        message: "Statement sent successfully"
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("Error in send-statement function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Failed to send statement"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
