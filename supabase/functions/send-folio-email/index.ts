import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FolioEmailRequest {
  recipientEmail: string;
  subject: string;
  folioHtml: string;
  propertyName?: string;
  guestName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, subject, folioHtml, propertyName, guestName } =
      (await req.json()) as FolioEmailRequest;

    if (!recipientEmail || !folioHtml) {
      return new Response(
        JSON.stringify({ success: false, error: "recipientEmail and folioHtml are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.log("=".repeat(60));
      console.log("MOCK EMAIL MODE - No RESEND_API_KEY configured");
      console.log(`To: ${recipientEmail}`);
      console.log(`Subject: ${subject}`);
      console.log(`Guest: ${guestName}`);
      console.log(`Property: ${propertyName}`);
      console.log(`Content length: ${folioHtml.length} chars`);
      console.log("=".repeat(60));
      return new Response(
        JSON.stringify({
          success: true,
          mockMode: true,
          message: "Folio logged in mock mode. Add RESEND_API_KEY to send real emails.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resend = new Resend(resendApiKey);
    const fromLabel = propertyName ? propertyName.replace(/[^a-zA-Z0-9 ]/g, "") : "Folio";

    const emailResponse = await resend.emails.send({
      from: `${fromLabel} <folio@resend.dev>`,
      to: [recipientEmail],
      subject,
      html: folioHtml,
    });

    if ((emailResponse as any).error) {
      console.error("Resend error:", (emailResponse as any).error);
      return new Response(
        JSON.stringify({ success: false, error: (emailResponse as any).error.message || "Send failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("send-folio-email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
