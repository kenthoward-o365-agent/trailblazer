import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommunicationRequest {
  channel: "email" | "sms";
  recipientEmail?: string;
  recipientPhone?: string;
  subject?: string;
  html?: string;
  text?: string;
  propertyName?: string;
  guestName?: string;
}

async function sendEmail(body: CommunicationRequest) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    console.log("[MOCK EMAIL]", body.recipientEmail, body.subject);
    return { mockMode: true };
  }
  const resend = new Resend(key);
  const fromLabel = (body.propertyName || "Guest Services").replace(/[^a-zA-Z0-9 ]/g, "");
  const res: any = await resend.emails.send({
    from: `${fromLabel} <notify@resend.dev>`,
    to: [body.recipientEmail!],
    subject: body.subject || "Message",
    html: body.html || `<p>${body.text || ""}</p>`,
  });
  if (res.error) throw new Error(res.error.message || "Email send failed");
  return { emailId: res.data?.id };
}

async function sendSms(body: CommunicationRequest) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  const gwKey = Deno.env.get("TWILIO_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  const message = (body.text || body.html || "").replace(/<[^>]+>/g, "").trim();

  // Prefer connector gateway if linked
  if (gwKey && lovableKey && from) {
    const url = "https://connector-gateway.lovable.dev/twilio/Messages.json";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gwKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: body.recipientPhone!, From: from, Body: message }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Twilio gateway ${resp.status}: ${t}`);
    }
    const j = await resp.json();
    return { sid: j.sid };
  }

  // Direct Twilio REST fallback
  if (sid && token && from) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: body.recipientPhone!, From: from, Body: message }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Twilio ${resp.status}: ${t}`);
    }
    const j = await resp.json();
    return { sid: j.sid };
  }

  console.log("[MOCK SMS]", body.recipientPhone, message.slice(0, 120));
  return { mockMode: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = (await req.json()) as CommunicationRequest;
    if (body.channel === "email") {
      if (!body.recipientEmail) throw new Error("recipientEmail required");
      const r = await sendEmail(body);
      return new Response(JSON.stringify({ success: true, ...r }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.channel === "sms") {
      if (!body.recipientPhone) throw new Error("recipientPhone required");
      const r = await sendSms(body);
      return new Response(JSON.stringify({ success: true, ...r }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error("Unsupported channel");
  } catch (e: any) {
    console.error("send-communication error", e);
    return new Response(JSON.stringify({ success: false, error: e?.message || "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
