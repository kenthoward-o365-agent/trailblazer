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
  name: "list_reservations",
  title: "List reservations",
  description:
    "List reservations for a property, optionally filtered by arrival date range and status. Enforces property_id isolation.",
  inputSchema: {
    property_id: z.string().uuid().describe("Property UUID (required for tenant isolation)."),
    from: z.string().optional().describe("Arrival on or after this ISO date (YYYY-MM-DD)."),
    to: z.string().optional().describe("Arrival on or before this ISO date (YYYY-MM-DD)."),
    status: z.string().optional().describe("Reservation status filter (e.g. confirmed, checked_in)."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ property_id, from, to, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("reservations")
      .select("id, confirmation_number, guest_name, arrival_date, departure_date, status, site_id, adults, children, total_amount")
      .eq("property_id", property_id)
      .order("arrival_date", { ascending: true })
      .limit(limit);
    if (from) q = q.gte("arrival_date", from);
    if (to) q = q.lte("arrival_date", to);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { reservations: data },
    };
  },
});
