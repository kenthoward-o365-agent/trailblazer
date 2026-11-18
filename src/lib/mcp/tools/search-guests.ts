import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient((globalThis as any).process.env.SUPABASE_URL!, (globalThis as any).process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_guests",
  title: "Search guests",
  description: "Search guest profiles by name or email within a property.",
  inputSchema: {
    property_id: z.string().uuid(),
    query: z.string().min(1).describe("Name or email fragment."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ property_id, query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const like = `%${query}%`;
    const { data, error } = await sb
      .from("guest_profiles")
      .select("id, first_name, last_name, email, phone, lifetime_stays, lifetime_revenue")
      .eq("property_id", property_id)
      .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`)
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { guests: data },
    };
  },
});
