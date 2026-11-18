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
  name: "list_properties",
  title: "List properties",
  description: "List properties the signed-in user has access to.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: access, error: accessError } = await sb
      .from("user_property_access")
      .select("property_id")
      .eq("user_id", ctx.getUserId());
    if (accessError) {
      return { content: [{ type: "text", text: accessError.message }], isError: true };
    }
    const ids = (access ?? []).map((a: { property_id: string }) => a.property_id);
    if (ids.length === 0) {
      return { content: [{ type: "text", text: "No properties" }], structuredContent: { properties: [] } };
    }
    const { data, error } = await sb
      .from("properties")
      .select("id, name, code, timezone, audit_date")
      .in("id", ids)
      .order("name");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { properties: data },
    };
  },
});
