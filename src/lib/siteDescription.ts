// Auto-description helper for site types on the booking engine.
// Given a set of sites of one type + custom attribute definitions,
// build a short human-readable summary of common amenities.

export interface SiteAttributeRow {
  max_vehicle_length: number | null;
  site_access_type: string | null;
  is_shaded: boolean | null;
  has_fire_pit: boolean | null;
  has_picnic_table: boolean | null;
  allows_bump_outs: boolean | null;
  has_50amp: boolean | null;
  has_30amp: boolean | null;
  custom_attributes?: Record<string, any> | null;
}

export interface CustomAttrDef {
  id: string;
  name: string;
  code: string;
  data_type: "boolean" | "number" | "text";
}

const q = (n: number, total: number) => {
  if (total === 0) return "none";
  if (n === total) return "all";
  if (n >= total * 0.7) return "most";
  if (n >= total * 0.3) return "some";
  return "a few";
};

export function buildSiteTypeDescription(
  sites: SiteAttributeRow[],
  customDefs: CustomAttrDef[] = [],
): string {
  if (sites.length === 0) return "";
  const total = sites.length;
  const count = (fn: (s: SiteAttributeRow) => boolean) => sites.filter(fn).length;

  const parts: string[] = [];

  const pullThrough = count((s) => s.site_access_type === "pull_through");
  if (pullThrough > 0) {
    parts.push(
      pullThrough === total
        ? "Pull-through access"
        : `${q(pullThrough, total)} sites are pull-through`,
    );
  }

  const lengths = sites.map((s) => s.max_vehicle_length).filter((n): n is number => !!n && n > 0);
  if (lengths.length) {
    const max = Math.max(...lengths);
    parts.push(`accommodates rigs up to ${max} ft`);
  }

  const amps: string[] = [];
  const a50 = count((s) => !!s.has_50amp);
  const a30 = count((s) => !!s.has_30amp);
  if (a50 === total && total > 0) amps.push("50-amp");
  else if (a50 > 0) amps.push(`50-amp on ${q(a50, total)} sites`);
  if (a30 === total && total > 0) amps.push("30-amp");
  else if (a30 > 0) amps.push(`30-amp on ${q(a30, total)} sites`);
  if (amps.length) parts.push(amps.join(" & ") + " power");

  const feats: string[] = [];
  const shaded = count((s) => !!s.is_shaded);
  const fire = count((s) => !!s.has_fire_pit);
  const picnic = count((s) => !!s.has_picnic_table);
  const bump = count((s) => !!s.allows_bump_outs);
  if (shaded > 0) feats.push(`${q(shaded, total)} shaded`);
  if (fire === total && total > 0) feats.push("fire pit");
  else if (fire > 0) feats.push(`fire pit on ${q(fire, total)} sites`);
  if (picnic === total && total > 0) feats.push("picnic table");
  else if (picnic > 0) feats.push(`picnic table on ${q(picnic, total)} sites`);
  if (bump === total && total > 0) feats.push("bump-outs allowed");
  else if (bump > 0) feats.push(`bump-outs allowed on ${q(bump, total)} sites`);
  if (feats.length) parts.push(feats.join(", "));

  for (const def of customDefs) {
    if (def.data_type !== "boolean") continue;
    const c = count((s) => !!s.custom_attributes?.[def.code]);
    if (c === total && total > 0) parts.push(def.name.toLowerCase());
    else if (c > 0) parts.push(`${def.name.toLowerCase()} on ${q(c, total)} sites`);
  }

  if (parts.length === 0) return "";
  const sentence = parts.join(", ").replace(/, ([^,]*)$/, ", and $1");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

export function resolveSiteTypeDescription(
  siteType: { use_auto_description?: boolean | null; auto_description?: string | null; description?: string | null },
  cfgPublicDescription?: string | null,
): string {
  const useAuto = siteType.use_auto_description ?? true;
  if (!useAuto && (cfgPublicDescription || "").trim()) return cfgPublicDescription!.trim();
  if (siteType.auto_description) return siteType.auto_description;
  return cfgPublicDescription || siteType.description || "";
}
