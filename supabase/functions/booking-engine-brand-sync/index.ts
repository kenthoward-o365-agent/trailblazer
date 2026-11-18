// Sync a customer's website brand into their booking engine settings.
// Uses Firecrawl's `branding` extraction to pull colors, fonts, and logo,
// then upserts them onto booking_engine_settings for the given property.
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

function normalizeUrl(input: string): string | null {
  try {
    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const u = new URL(withProto);
    return u.toString();
  } catch {
    return null;
  }
}

function pickHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s.length === 4
    ? "#" + s.slice(1).split("").map((c) => c + c).join("")
    : s.slice(0, 7);
  return null;
}

function pickFont(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/["']/g, "");
  if (!s || s.length > 60) return null;
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_KEY) return json({ error: "Brand sync is not configured" }, 500);

  // Authenticate the caller and require property access
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
  const rawUrl: string | undefined = body?.url;
  if (!propertyId || !rawUrl) return json({ error: "property_id and url are required" }, 400);
  const url = normalizeUrl(rawUrl);
  if (!url) return json({ error: "Invalid URL" }, 400);

  // Verify caller can access this property
  const { data: access } = await userClient.rpc("user_can_access_property", {
    _property_id: propertyId,
  });
  if (!access) return json({ error: "Forbidden" }, 403);

  // Call Firecrawl
  const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["branding"],
      onlyMainContent: false,
    }),
  });
  const fcJson: any = await fcRes.json().catch(() => ({}));
  if (!fcRes.ok) {
    if (fcRes.status === 402) return json({ error: "Brand sync credits exhausted" }, 402);
    return json({ error: fcJson?.error ?? "Failed to read website" }, 502);
  }

  const branding = fcJson?.data?.branding ?? fcJson?.branding ?? null;
  if (!branding) return json({ error: "Could not detect brand on that page" }, 422);

  const colors = branding.colors ?? {};
  const typography = branding.typography?.fontFamilies ?? {};
  const fonts = branding.fonts ?? [];
  const logo = branding.images?.logo ?? branding.logo ?? null;

  const primary = pickHex(colors.primary) ?? pickHex(colors.accent);
  const accent = pickHex(colors.accent) ?? pickHex(colors.secondary);
  const background = pickHex(colors.background);
  const text = pickHex(colors.textPrimary) ?? pickHex(colors.text);
  const heading = pickFont(typography.heading) ?? pickFont(typography.primary) ?? pickFont(fonts?.[0]?.family);
  const buttonRadius = typeof branding.components?.buttonPrimary?.borderRadius === "string"
    ? branding.components.buttonPrimary.borderRadius
    : typeof branding.spacing?.borderRadius === "string" ? branding.spacing.borderRadius : null;
  const bodyFont = pickFont(typography.primary) ?? pickFont(fonts?.[1]?.family) ?? heading;

  const patch: Record<string, unknown> = {
    property_id: propertyId,
    brand_source_url: url,
    brand_synced_at: new Date().toISOString(),
  };
  if (primary) patch.primary_color = primary;
  if (accent) patch.accent_color = accent;
  if (background) patch.background_color = background;
  if (text) patch.text_color = text;
  if (heading) patch.heading_font = heading;
  if (bodyFont) patch.body_font = bodyFont;
  if (buttonRadius) patch.button_radius = buttonRadius;
  if (typeof logo === "string" && logo.startsWith("http")) patch.logo_url = logo;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { error: upErr } = await admin
    .from("booking_engine_settings")
    .upsert(patch, { onConflict: "property_id" });
  if (upErr) return json({ error: upErr.message }, 500);

  return json({ ok: true, applied: patch });
});
