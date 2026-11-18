import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProperties from "./tools/list-properties";
import listReservations from "./tools/list-reservations";
import getReservation from "./tools/get-reservation";
import searchGuests from "./tools/search-guests";

// Build issuer from the project ref (inlined by Vite at build time, so this
// stays import-safe — no runtime env read at module top level).
const projectRef =
  (import.meta as unknown as { env?: { VITE_SUPABASE_PROJECT_ID?: string } }).env
    ?.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "trailblazer-pms-mcp",
  title: "Trailblazer PMS",
  version: "0.1.0",
  instructions:
    "Tools for the Trailblazer campground PMS. Use list_properties first to discover the property_id, then pass it into other tools. All queries are scoped to properties the signed-in user has access to.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProperties, listReservations, getReservation, searchGuests],
});
