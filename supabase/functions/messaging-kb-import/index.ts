// Import Guest AI Knowledge entries from a website URL, an AI prompt, or extracted document text.
// Returns an array of proposed entries { category, title, body, tags } for staff review.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

const CATEGORIES = ["policy", "amenity", "faq", "rental_catalog", "hours", "rules", "other"];

async function scrapeUrl(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) throw new Error("Firecrawl not configured - connect the Firecrawl connector.");
  const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!resp.ok) throw new Error(`Firecrawl ${resp.status}: ${await resp.text()}`);
  const j = await resp.json();
  return j?.data?.markdown || j?.markdown || "";
}

async function extractEntries(sourceText: string, sourceLabel: string, propertyName: string) {
  const system = `You extract campground property knowledge from source material into structured entries for an AI guest concierge.

Rules:
- Only include facts explicitly stated in the source. Do NOT invent hours, prices, policies, amenities, or contact info.
- Split content into focused entries. Each entry answers ONE topic (e.g., "Pool Hours", "Pet Policy", "WiFi Password", "Firewood Rentals").
- Keep entries short and factual. Prefer bullet-style sentences the AI can quote back to guests.
- Use category from: ${CATEGORIES.join(", ")}. Choose the best fit.
- Tag with 2-5 lowercase keywords a guest might use.
- Skip navigation, marketing fluff, cookie banners, and duplicate content.
- If the source has no useful campground info, return an empty entries array.

Return strict JSON:
{ "entries": [ { "category": "...", "title": "...", "body": "...", "tags": ["..."] } ] }`;

  const user = `Property: ${propertyName}
Source: ${sourceLabel}

SOURCE CONTENT:
${sourceText.slice(0, 80_000)}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) throw new Error(`AI gateway ${resp.status}: ${await resp.text()}`);
  const j = await resp.json();
  const raw = j.choices?.[0]?.message?.content || "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(raw); } catch { parsed = { entries: [] }; }
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  return entries
    .filter((e: any) => e?.title && e?.body)
    .map((e: any) => ({
      category: CATEGORIES.includes(e.category) ? e.category : "other",
      title: String(e.title).slice(0, 200),
      body: String(e.body).slice(0, 4000),
      tags: Array.isArray(e.tags) ? e.tags.slice(0, 8).map((t: any) => String(t).toLowerCase()) : [],
    }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const supabase = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) throw new Error("Unauthorized");

    const body = await req.json();
    const { property_id, source, url, prompt, text, file_name } = body;
    if (!property_id) throw new Error("property_id required");

    const { data: prop } = await supabase.from("properties").select("name").eq("id", property_id).maybeSingle();
    if (!prop) throw new Error("Property not accessible");

    let sourceText = "";
    let sourceLabel = "";

    if (source === "url") {
      if (!url) throw new Error("url required");
      sourceLabel = url;
      sourceText = await scrapeUrl(url);
      if (!sourceText) throw new Error("No content scraped from URL");
    } else if (source === "prompt") {
      if (!prompt) throw new Error("prompt required");
      sourceLabel = "AI-generated draft";
      // Ask AI to draft raw content first (from its own knowledge / prompt), then extract entries
      const draftResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You draft a plain-text list of factual knowledge sections about a campground property for its AI concierge. Write clear headings and short factual paragraphs. Only include what the user asks for; do not invent specific hours, prices, or amenities they didn't mention. Mark placeholders like [add pool hours] when specifics are unknown.",
            },
            { role: "user", content: `Property: ${prop.name}\n\nInstructions: ${prompt}` },
          ],
        }),
      });
      if (!draftResp.ok) throw new Error(`AI draft ${draftResp.status}: ${await draftResp.text()}`);
      const dj = await draftResp.json();
      sourceText = dj.choices?.[0]?.message?.content || "";
    } else if (source === "text") {
      if (!text) throw new Error("text required");
      sourceLabel = file_name || "Uploaded document";
      sourceText = String(text);
    } else {
      throw new Error("source must be url|prompt|text");
    }

    const entries = await extractEntries(sourceText, sourceLabel, prop.name || "the campground");

    return new Response(JSON.stringify({ ok: true, entries, source_label: sourceLabel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("messaging-kb-import error", e);
    return new Response(JSON.stringify({ error: e.message || "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
