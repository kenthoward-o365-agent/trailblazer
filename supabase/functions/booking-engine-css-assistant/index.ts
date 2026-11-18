// AI-powered CSS assistant for the booking engine CMS.
// Takes a plain-English instruction plus the current custom CSS and returns
// updated CSS scoped under `.booking-brand`. Uses Lovable AI Gateway.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Strip anything that could escape scoping or execute JS.
function sanitizeCss(css: string): string {
  let out = css.replace(/<\/?\s*(script|style|iframe)[^>]*>/gi, "");
  out = out.replace(/expression\s*\(/gi, "");
  out = out.replace(/javascript\s*:/gi, "");
  out = out.replace(/@import[^;]*;/gi, "");
  return out.slice(0, 20000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_KEY) return json({ error: "AI is not configured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const propertyId: string | undefined = body?.property_id;
  const instruction: string | undefined = body?.instruction;
  const currentCss: string = typeof body?.current_css === "string" ? body.current_css : "";
  if (!propertyId || !instruction || instruction.length > 2000) {
    return json({ error: "property_id and instruction (<=2000 chars) required" }, 400);
  }

  const { data: access } = await userClient.rpc("user_can_access_property", {
    _property_id: propertyId,
  });
  if (!access) return json({ error: "Forbidden" }, 403);

  const system = [
    "You are a CSS assistant for a public campground booking site.",
    "Return ONLY valid CSS — no explanations, no markdown fences, no <style> tags.",
    "ALL selectors MUST be scoped under `.booking-brand` (e.g. `.booking-brand h1 { ... }`).",
    "Never use @import, javascript: URLs, expression(), or reference external hosts other than Google Fonts.",
    "Prefer CSS variables and simple, readable rules. Preserve unrelated existing rules.",
  ].join(" ");

  const user = [
    `Current custom CSS (may be empty):\n\`\`\`\n${sanitizeCss(currentCss)}\n\`\`\``,
    `Instruction: ${instruction}`,
    "Return the full updated CSS.",
  ].join("\n\n");

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_KEY,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (aiRes.status === 429) return json({ error: "Rate limit exceeded, please try again shortly." }, 429);
  if (aiRes.status === 402) return json({ error: "AI credits exhausted. Add credits to continue." }, 402);
  if (!aiRes.ok) {
    const txt = await aiRes.text();
    return json({ error: `AI error: ${txt.slice(0, 200)}` }, 502);
  }

  const aiJson: any = await aiRes.json();
  const raw: string = aiJson?.choices?.[0]?.message?.content ?? "";
  const cleaned = sanitizeCss(raw.replace(/^```(?:css)?/i, "").replace(/```$/i, "").trim());
  if (!cleaned) return json({ error: "AI returned empty CSS" }, 502);

  return json({ ok: true, css: cleaned });
});
