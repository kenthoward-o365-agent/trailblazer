// Public Booking Engine API — unauthenticated endpoints for the customer-facing
// booking site. Uses the service-role client internally; all access is gated by
// a property's public booking slug + booking_engine_enabled flag.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signGuestToken, verifyGuestToken, type GuestClaims } from "../_shared/guestJwt.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADYEN_API_KEY = Deno.env.get("ADYEN_API_KEY") ?? "";
const ADYEN_MERCHANT_ACCOUNT = Deno.env.get("ADYEN_MERCHANT_ACCOUNT") ?? "";
const ADYEN_ENVIRONMENT = (Deno.env.get("ADYEN_ENVIRONMENT") ?? "test").toLowerCase();
const ADYEN_IS_PLACEHOLDER = ADYEN_API_KEY.startsWith("PLACEHOLDER_") || !ADYEN_MERCHANT_ACCOUNT;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function j(body: unknown, status = 200, cacheControl?: string) {
  const headers: Record<string, string> = { ...cors, "Content-Type": "application/json" };
  if (cacheControl) headers["Cache-Control"] = cacheControl;
  return new Response(JSON.stringify(body), { status, headers });
}

// ---- Signed URL memoization (survives across warm invocations of this function instance) ----
// Storage API signing was the hot-path bottleneck on the public booking site.
// We cache URLs per path for slightly less than the sign TTL so repeat requests
// skip the storage round-trip.
const SIGN_TTL_SECONDS = 60 * 60 * 24; // 24h
const SIGN_CACHE_MS = (SIGN_TTL_SECONDS - 300) * 1000; // refresh 5 min before expiry
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const now = Date.now();
  const misses: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    const hit = signedUrlCache.get(p);
    if (hit && hit.expiresAt > now) out.set(p, hit.url);
    else misses.push(p);
  }
  if (misses.length > 0) {
    const { data } = await supabase.storage.from("booking-gallery").createSignedUrls(misses, SIGN_TTL_SECONDS);
    (data ?? []).forEach((s: any) => {
      if (s.path && s.signedUrl) {
        signedUrlCache.set(s.path, { url: s.signedUrl, expiresAt: now + SIGN_CACHE_MS });
        out.set(s.path, s.signedUrl);
      }
    });
  }
  return out;
}

async function signOne(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const m = await signPaths([path]);
  return m.get(path) ?? null;
}

// The campground-maps bucket is private; exchange stored public URLs for signed URLs.
const MAP_BUCKET = "campground-maps";
async function signMapUrl(storedUrl: string | null | undefined): Promise<string | null> {
  if (!storedUrl) return null;
  const marker = `/${MAP_BUCKET}/`;
  const idx = storedUrl.indexOf(marker);
  if (idx === -1) return storedUrl;
  const path = decodeURIComponent(storedUrl.slice(idx + marker.length).split("?")[0]);
  const { data } = await supabase.storage.from(MAP_BUCKET).createSignedUrl(path, SIGN_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

async function resolveProperty(slug: string) {
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, timezone, booking_engine_enabled, map_image_url, map_width, map_height, default_online_buffer")
    .or(`booking_public_slug.eq.${slug},booking_custom_slug.eq.${slug}`)
    .maybeSingle();
  if (error || !data) return null;
  if (!data.booking_engine_enabled) return null;
  return data;
}


function nightsBetween(inISO: string, outISO: string) {
  const a = new Date(inISO + "T00:00:00Z").getTime();
  const b = new Date(outISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

async function getPropertyInfo(slug: string) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);

  const [settings, siteTypes, cfg, deposits, gallery, addOns, packages, packageItems, losRules] = await Promise.all([
    supabase.from("booking_engine_settings").select("*").eq("property_id", prop.id).maybeSingle(),
    supabase.from("site_types").select("id, name, description, base_price, featured_amenities, max_adults, max_children, image_path, auto_description, use_auto_description").eq("property_id", prop.id),
    supabase.from("site_type_booking_config").select("*").eq("property_id", prop.id).eq("is_bookable_online", true),
    supabase.from("deposit_policies").select("id, name, description, deposit_type, deposit_value, payment_mode, is_default, cancellation_tiers").eq("property_id", prop.id).eq("is_active", true),
    supabase.from("gallery_assets").select("*").eq("property_id", prop.id).order("sort_order", { ascending: true }),
    supabase.from("add_ons").select("id, name, description, price, category, charge_type").eq("property_id", prop.id).eq("is_active", true),
    supabase.from("packages").select("id, name, description, price, charge_type, sort_order").eq("property_id", prop.id).eq("is_active", true).order("sort_order"),
    supabase.from("package_items").select("package_id, add_on_id, quantity"),
    supabase.from("los_discount_rules").select("*").eq("property_id", prop.id).eq("is_active", true).order("min_nights"),
  ]);

  const cfgByType = new Map((cfg.data ?? []).map((c) => [c.site_type_id, c]));
  const bookableTypesRaw = (siteTypes.data ?? [])
    .filter((st) => cfgByType.has(st.id))
    .map((st) => ({ ...st, booking_config: cfgByType.get(st.id) }));

  const packageIds = new Set((packages.data ?? []).map((p) => p.id));
  const itemsByPkg = new Map<string, any[]>();
  (packageItems.data ?? []).filter((i) => packageIds.has(i.package_id)).forEach((i) => {
    if (!itemsByPkg.has(i.package_id)) itemsByPkg.set(i.package_id, []);
    itemsByPkg.get(i.package_id)!.push(i);
  });
  const packagesWithItems = (packages.data ?? []).map((p) => ({ ...p, items: itemsByPkg.get(p.id) ?? [] }));

  // Sign gallery paths using in-memory cache (booking-gallery is a private bucket).
  const galleryPaths = (gallery.data ?? []).map((g: any) => g.storage_path).filter(Boolean);
  const signedByPath = await signPaths(galleryPaths);
  const gallerySigned = (gallery.data ?? []).map((g: any) => ({
    ...g,
    signed_url: signedByPath.get(g.storage_path) ?? null,
  }));

  let settingsOut: any = settings.data ?? null;
  if (settingsOut?.logo_image_path) {
    settingsOut = { ...settingsOut, logo_signed_url: await signOne(settingsOut.logo_image_path) };
  }
  if (settingsOut?.hero_image_path) {
    settingsOut = { ...settingsOut, hero_signed_url: await signOne(settingsOut.hero_image_path) };
  }
  if (settingsOut?.background_image_path) {
    settingsOut = { ...settingsOut, background_signed_url: await signOne(settingsOut.background_image_path) };
  }

  // Sign site type images
  const stPaths = bookableTypesRaw.map((st: any) => st.image_path).filter(Boolean);
  const stSignedMap = await signPaths(stPaths);
  const bookableTypes = bookableTypesRaw.map((st: any) => ({
    ...st,
    image_url: st.image_path ? (stSignedMap.get(st.image_path) ?? null) : null,
  }));

  return j({
    property: { id: prop.id, name: prop.name, currency: "USD", timezone: prop.timezone ?? "UTC", map_image_url: await signMapUrl(prop.map_image_url), map_width: prop.map_width ?? null, map_height: prop.map_height ?? null },
    settings: settingsOut,
    site_types: bookableTypes,
    deposit_policies: deposits.data ?? [],
    gallery: gallerySigned,
    add_ons: addOns.data ?? [],
    packages: packagesWithItems,
    los_discount_rules: losRules.data ?? [],
  }, 200, "public, s-maxage=60, stale-while-revalidate=300");
}

// Hard-block requirement filters. Returns true if the site meets all provided requirements.
function siteMeetsRequirements(site: any, req: any): boolean {
  if (!req) return true;
  if (req.min_length && Number(site.max_vehicle_length ?? 0) < Number(req.min_length)) return false;
  if (req.needs_pull_through && site.site_access_type !== "pull_through") return false;
  if (req.needs_50amp && !site.has_50amp) return false;
  if (req.needs_30amp && !site.has_30amp) return false;
  if (req.needs_bump_outs && !site.allows_bump_outs) return false;
  if (req.needs_shade && !site.is_shaded) return false;
  if (req.needs_fire_pit && !site.has_fire_pit) return false;
  if (req.needs_picnic_table && !site.has_picnic_table) return false;
  return true;
}

async function searchAvailability(slug: string, checkIn: string, checkOut: string, guests: number, filters: any = null) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);

  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) return j({ error: "invalid_dates" }, 400);

  const { data: allSites } = await supabase
    .from("sites")
    .select("id, site_number, site_type_id, max_occupancy, max_vehicle_length, site_access_type, is_shaded, has_fire_pit, has_picnic_table, allows_bump_outs, has_50amp, has_30amp, is_active, is_ada_accessible, map_x, map_y")
    .eq("property_id", prop.id)
    .eq("is_active", true);

  // Look-ahead window for alt-date suggestions: up to 30 days out
  const LOOKAHEAD_DAYS = 30;
  const windowEnd = new Date(checkIn + "T00:00:00Z");
  windowEnd.setUTCDate(windowEnd.getUTCDate() + LOOKAHEAD_DAYS + nights);
  const windowEndISO = windowEnd.toISOString().split("T")[0];

  const { data: winReservations } = await supabase
    .from("reservations")
    .select("site_id, check_in_date, check_out_date")
    .eq("property_id", prop.id)
    .lt("check_in_date", windowEndISO)
    .gt("check_out_date", checkIn)
    .in("status", ["reserved", "checked_in", "confirmed"]);

  const { data: winHolds } = await supabase
    .from("booking_holds")
    .select("site_id, check_in, check_out")
    .eq("property_id", prop.id)
    .lt("check_in", windowEndISO)
    .gt("check_out", checkIn)
    .gt("expires_at", new Date().toISOString());

  const intervalsBySite = new Map<string, Array<{ start: string; end: string }>>();
  const pushInt = (siteId: string | null, start: string, end: string) => {
    if (!siteId) return;
    if (!intervalsBySite.has(siteId)) intervalsBySite.set(siteId, []);
    intervalsBySite.get(siteId)!.push({ start, end });
  };
  (winReservations ?? []).forEach((r: any) => pushInt(r.site_id, r.check_in_date, r.check_out_date));
  (winHolds ?? []).forEach((h: any) => pushInt(h.site_id, h.check_in, h.check_out));

  const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart < bEnd && aEnd > bStart;
  const siteFreeFor = (siteId: string, s: string, e: string) => {
    const ints = intervalsBySite.get(siteId) ?? [];
    return !ints.some((i) => rangesOverlap(s, e, i.start, i.end));
  };

  const eligibleSites = (allSites ?? []).filter(
    (s) => s.max_occupancy >= guests && siteMeetsRequirements(s, filters),
  );

  const { data: cfg } = await supabase
    .from("site_type_booking_config")
    .select("*")
    .eq("property_id", prop.id)
    .eq("is_bookable_online", true);

  const cfgByType = new Map((cfg ?? []).map((c) => [c.site_type_id, c]));
  const { data: siteTypes } = await supabase
    .from("site_types")
    .select("id, name, description, base_price, featured_amenities, max_adults, max_children, image_path")
    .eq("property_id", prop.id);

  // Sign site type images via in-memory cache
  const stPaths = (siteTypes ?? []).map((st: any) => st.image_path).filter(Boolean);
  const stSignedMap = await signPaths(stPaths);
  const signST = (st: any) => ({ ...st, image_url: st.image_path ? (stSignedMap.get(st.image_path) ?? null) : null });

  const { data: losRules } = await supabase
    .from("los_discount_rules")
    .select("min_nights, discount_type, discount_value")
    .eq("property_id", prop.id)
    .eq("is_active", true)
    .lte("min_nights", nights)
    .order("min_nights", { ascending: false });
  const bestLos = losRules?.[0];

  // Pick the rate to display on the booking engine.
  // Priority: a rate flagged "show_on_booking_engine" (prefer default if multiple),
  // otherwise fall back to base_price only (no rate override, no bundled add-ons).
  const { data: engineRates } = await supabase
    .from("rates")
    .select("id, is_default")
    .eq("property_id", prop.id)
    .eq("show_on_booking_engine", true)
    .lte("start_date", checkIn)
    .gte("end_date", checkOut);

  const engineRate = (engineRates ?? []).find((r: any) => r.is_default) ?? (engineRates ?? [])[0] ?? null;

  const rateSiteTypePrice = new Map<string, number>();
  let bundledAddOnTotal = 0;
  if (engineRate?.id) {
    const [{ data: rsp }, { data: rao }] = await Promise.all([
      supabase.from("rate_site_type_prices").select("site_type_id, price").eq("rate_id", engineRate.id),
      supabase.from("rate_add_ons").select("add_ons(price)").eq("rate_id", engineRate.id),
    ]);
    (rsp ?? []).forEach((r: any) => rateSiteTypePrice.set(r.site_type_id, Number(r.price)));
    bundledAddOnTotal = (rao ?? []).reduce((s: number, r: any) => s + Number(r.add_ons?.price || 0), 0);
  }



  const addDaysISO = (iso: string, days: number) => {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split("T")[0];
  };

  const results: any[] = [];
  const unavailable: any[] = [];

  const propertyBuffer = Math.max(0, Number(prop.default_online_buffer ?? 0) || 0);

  for (const st of siteTypes ?? []) {
    if (!cfgByType.has(st.id)) continue;
    const cfgRow = cfgByType.get(st.id)!;
    const overridePrice = rateSiteTypePrice.get(st.id);
    const perNight = (overridePrice != null ? overridePrice : Number(st.base_price)) + bundledAddOnTotal;
    const subtotal = perNight * nights;

    let losDiscount = 0;
    if (bestLos) {
      losDiscount = bestLos.discount_type === "percent"
        ? +(subtotal * Number(bestLos.discount_value) / 100).toFixed(2)
        : Number(bestLos.discount_value);
    }

    const sitesOfType = eligibleSites.filter((s) => s.site_type_id === st.id);
    const availNow = sitesOfType.filter((s) => siteFreeFor(s.id, checkIn, checkOut));

    // Overbooking buffer: hold back the last N sites of this type from online shoppers.
    // Per-type override wins; otherwise fall back to the property default.
    const effectiveBuffer = cfgRow.online_buffer == null
      ? propertyBuffer
      : Math.max(0, Number(cfgRow.online_buffer) || 0);
    const visibleCount = Math.max(0, availNow.length - effectiveBuffer);
    const visibleSites = availNow.slice(0, visibleCount);

    if (visibleCount > 0) {
      results.push({
        site_type: signST(st),
        booking_config: cfgRow,
        available_count: visibleCount,
        buffered_out: availNow.length - visibleCount,
        available_site_ids: cfgRow.allow_specific_site_pick ? visibleSites.map((s) => s.id) : [],
        available_sites: cfgRow.allow_specific_site_pick ? visibleSites : [],
        rate_per_night: perNight,
        subtotal,
        los_discount: losDiscount,
        total: Math.max(0, subtotal - losDiscount),
        nights,
      });
      continue;
    }

    // Scan +1..+LOOKAHEAD_DAYS for the earliest window where visible inventory (post-buffer) exists
    let nextIn: string | null = null;
    let nextOut: string | null = null;
    for (let d = 1; d <= LOOKAHEAD_DAYS && !nextIn; d++) {
      const s = addDaysISO(checkIn, d);
      const e = addDaysISO(s, nights);
      const freeCount = sitesOfType.filter((site) => siteFreeFor(site.id, s, e)).length;
      if (freeCount - effectiveBuffer > 0) {
        nextIn = s;
        nextOut = e;
      }
    }

    unavailable.push({
      site_type: signST(st),
      booking_config: cfgRow,
      rate_per_night: perNight,
      next_available: nextIn ? { check_in: nextIn, check_out: nextOut, nights } : null,
    });
  }

  return j({
    nights,
    results,
    unavailable,
    los_applied: bestLos ?? null,
    map: prop.map_image_url ? { image_url: await signMapUrl(prop.map_image_url), width: prop.map_width, height: prop.map_height } : null,
  }, 200, "public, s-maxage=15, stale-while-revalidate=60");
}


async function createHold(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);

  const { site_type_id, site_id, check_in, check_out, guests, session_id, filters } = payload;
  if (!check_in || !check_out || !site_type_id) return j({ error: "missing_fields" }, 400);

  // If specific site chosen, re-validate against filters
  if (site_id && filters) {
    const { data: siteRow } = await supabase
      .from("sites")
      .select("id, max_occupancy, max_vehicle_length, site_access_type, is_shaded, has_fire_pit, has_picnic_table, allows_bump_outs, has_50amp, has_30amp")
      .eq("id", site_id)
      .eq("property_id", prop.id)
      .maybeSingle();
    if (!siteRow || !siteMeetsRequirements(siteRow, filters)) {
      return j({ error: "site_requirements_not_met" }, 400);
    }
  }

  await supabase.from("booking_holds").delete().lt("expires_at", new Date().toISOString());

  const { data, error } = await supabase
    .from("booking_holds")
    .insert({
      property_id: prop.id,
      site_type_id,
      site_id: site_id ?? null,
      check_in, check_out,
      guests: guests ?? 1,
      session_id: session_id ?? crypto.randomUUID(),
    })
    .select()
    .single();

  if (error) return j({ error: "hold_failed", detail: error.message }, 400);
  return j({ hold: data });
}

// Compute a full quote server-side (LOS discount + add-ons + packages + promo)
async function computeQuote(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);

  const { hold_id, add_ons = [], packages = [], promo_code = null, deposit_policy_id = null } = payload;
  const { data: hold } = await supabase.from("booking_holds").select("*").eq("id", hold_id).eq("property_id", prop.id).maybeSingle();
  if (!hold) return j({ error: "hold_expired" }, 410);

  const nights = nightsBetween(hold.check_in, hold.check_out);
  const { data: st } = await supabase.from("site_types").select("base_price").eq("id", hold.site_type_id).maybeSingle();
  const perNight = Number(st?.base_price ?? 0);
  const roomSubtotal = perNight * nights;

  // LOS discount
  const { data: los } = await supabase.from("los_discount_rules")
    .select("min_nights, discount_type, discount_value, name")
    .eq("property_id", prop.id).eq("is_active", true)
    .lte("min_nights", nights).order("min_nights", { ascending: false }).limit(1).maybeSingle();
  let losDiscount = 0;
  if (los) {
    losDiscount = los.discount_type === "percent"
      ? +(roomSubtotal * Number(los.discount_value) / 100).toFixed(2)
      : Math.min(roomSubtotal, Number(los.discount_value));
  }

  // Add-ons
  let addOnTotal = 0;
  const addOnLines: any[] = [];
  if (add_ons.length) {
    const ids = add_ons.map((a: any) => a.id);
    const { data: rows } = await supabase.from("add_ons").select("id, name, price, charge_type").in("id", ids).eq("property_id", prop.id).eq("is_active", true);
    for (const req of add_ons) {
      const row = rows?.find((r) => r.id === req.id);
      if (!row) continue;
      const qty = Math.max(1, Number(req.quantity ?? 1));
      const mult = (row.charge_type === "per_night" || row.charge_type === "nightly") ? nights : 1;
      const line = Number(row.price) * qty * mult;
      addOnTotal += line;
      addOnLines.push({ id: row.id, name: row.name, quantity: qty, unit_price: Number(row.price), charge_type: row.charge_type, total: line });
    }
  }

  // Packages
  let packageTotal = 0;
  const packageLines: any[] = [];
  if (packages.length) {
    const ids = packages.map((p: any) => p.id);
    const { data: rows } = await supabase.from("packages").select("id, name, price, charge_type").in("id", ids).eq("property_id", prop.id).eq("is_active", true);
    for (const req of packages) {
      const row = rows?.find((r) => r.id === req.id);
      if (!row) continue;
      const qty = Math.max(1, Number(req.quantity ?? 1));
      const mult = row.charge_type === "per_night" ? nights : 1;
      const line = Number(row.price) * qty * mult;
      packageTotal += line;
      packageLines.push({ id: row.id, name: row.name, quantity: qty, unit_price: Number(row.price), charge_type: row.charge_type, total: line });
    }
  }

  // Promo
  let promoDiscount = 0;
  let promoApplied: any = null;
  let promoError: string | null = null;
  if (promo_code) {
    const { data: promo } = await supabase.from("promo_codes")
      .select("*").eq("property_id", prop.id).ilike("code", promo_code).maybeSingle();
    const today = new Date().toISOString().split("T")[0];
    if (!promo || !promo.is_active) promoError = "Invalid promo code";
    else if (promo.valid_from && today < promo.valid_from) promoError = "Promo not yet active";
    else if (promo.valid_to && today > promo.valid_to) promoError = "Promo expired";
    else if (promo.max_uses && promo.uses_count >= promo.max_uses) promoError = "Promo usage limit reached";
    else {
      const eligible = roomSubtotal - losDiscount + addOnTotal + packageTotal;
      promoDiscount = promo.discount_type === "percent"
        ? +(eligible * Number(promo.discount_value) / 100).toFixed(2)
        : Math.min(eligible, Number(promo.discount_value));
      promoApplied = { code: promo.code, description: promo.description, discount_type: promo.discount_type, discount_value: promo.discount_value };
    }
  }

  const total = Math.max(0, roomSubtotal - losDiscount + addOnTotal + packageTotal - promoDiscount);

  // Deposit
  let deposit: any = null;
  const depositId = deposit_policy_id;
  if (depositId) {
    const { data: policy } = await supabase.from("deposit_policies").select("*").eq("id", depositId).eq("property_id", prop.id).maybeSingle();
    if (policy) {
      let due = 0;
      if (policy.payment_mode === "full") due = total;
      else if (policy.payment_mode === "guarantee") due = 0;
      else if (policy.deposit_type === "percent") due = +(total * Number(policy.deposit_value) / 100).toFixed(2);
      else if (policy.deposit_type === "fixed") due = Number(policy.deposit_value);
      else if (policy.deposit_type === "first_night") due = perNight;
      deposit = { policy_id: policy.id, name: policy.name, payment_mode: policy.payment_mode, amount_due_today: due, balance_due: Math.max(0, total - due) };
    }
  }

  return j({
    nights, per_night: perNight,
    room_subtotal: roomSubtotal,
    los_discount: losDiscount, los_rule: los ?? null,
    add_on_lines: addOnLines, add_on_total: addOnTotal,
    package_lines: packageLines, package_total: packageTotal,
    promo_discount: promoDiscount, promo_applied: promoApplied, promo_error: promoError,
    total, deposit,
  });
}

async function createAdyenSession(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);
  if (ADYEN_IS_PLACEHOLDER) return j({ error: "adyen_not_configured" }, 503);

  const { hold_id, amount, currency, return_url, mode = "sale" } = payload;
  if (!hold_id || amount === undefined) return j({ error: "missing_fields" }, 400);

  const { data: hold } = await supabase.from("booking_holds").select("*").eq("id", hold_id).eq("property_id", prop.id).maybeSingle();
  if (!hold) return j({ error: "hold_expired" }, 410);

  const base = ADYEN_ENVIRONMENT === "live" ? "https://checkout-live.adyen.com/v71" : "https://checkout-test.adyen.com/v71";
  const resp = await fetch(`${base}/sessions`, {
    method: "POST",
    headers: { "x-API-key": ADYEN_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      merchantAccount: ADYEN_MERCHANT_ACCOUNT,
      reference: `booking-${hold_id}`,
      amount: { currency: currency ?? "USD", value: Math.round(Number(amount) * 100) },
      returnUrl: return_url,
      countryCode: "US",
      shopperReference: `booking-${prop.id}`,
      metadata: { propertyId: prop.id, holdId: hold_id, mode },
      storePaymentMethodMode: "askForConsent",
      recurringProcessingModel: "CardOnFile",
    }),
  });
  const raw = await resp.text();
  if (!resp.ok) return j({ error: "adyen_error", status: resp.status, detail: raw }, 502);
  const session = JSON.parse(raw);
  return j({
    id: session.id, sessionData: session.sessionData, clientKey: session.clientKey,
    environment: ADYEN_ENVIRONMENT === "live" ? "live" : "test",
  });
}

async function confirmBooking(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);

  const { hold_id, guest, deposit_policy_id, adyen_result_code, add_ons = [], packages = [], promo_code = null, special_requests } = payload;

  const { data: hold } = await supabase.from("booking_holds").select("*").eq("id", hold_id).eq("property_id", prop.id).maybeSingle();
  if (!hold) return j({ error: "hold_expired" }, 410);

  // Recompute quote server-side (never trust client totals)
  const quoteResp = await computeQuote(slug, { hold_id, add_ons, packages, promo_code, deposit_policy_id });
  const quote = await quoteResp.json();
  if (quote.error) return j(quote, 400);

  // Find or create guest
  let guestId: string | null = null;
  if (guest?.email) {
    const { data: existing } = await supabase.from("guests").select("id").eq("property_id", prop.id).eq("email", guest.email).maybeSingle();
    guestId = existing?.id ?? null;
  }
  if (!guestId) {
    const { data: newGuest, error: gErr } = await supabase.from("guests").insert({
      property_id: prop.id,
      first_name: guest?.first_name ?? "Guest",
      last_name: guest?.last_name ?? "",
      email: guest?.email ?? null,
      phone: guest?.phone ?? null,
      street_address: guest?.street_address ?? null,
      city: guest?.city ?? null,
      state: guest?.state ?? null,
      zipcode: guest?.zipcode ?? null,
      country: guest?.country ?? null,
      origin_property_id: prop.id,
    }).select("id").single();
    if (gErr) return j({ error: "guest_create_failed", detail: gErr.message }, 400);
    guestId = newGuest.id;
  }

  const notesParts: string[] = [];
  if (special_requests) notesParts.push(special_requests);
  if (quote.promo_applied) notesParts.push(`Promo: ${quote.promo_applied.code} (-$${quote.promo_discount.toFixed(2)})`);
  if (quote.los_discount > 0) notesParts.push(`LOS discount: -$${quote.los_discount.toFixed(2)}`);

  const { data: reservation, error: rErr } = await supabase.from("reservations").insert({
    property_id: prop.id,
    guest_id: guestId!,
    check_in_date: hold.check_in,
    check_out_date: hold.check_out,
    guests_count: hold.guests,
    site_type_id: hold.site_type_id,
    site_id: hold.site_id,
    total_price: quote.total,
    status: "reserved",
    special_requests: notesParts.join(" · ") || null,
  }).select("id, confirmation_number, check_in_date, check_out_date, total_price, guests_count").single();

  if (rErr) return j({ error: "reservation_failed", detail: rErr.message }, 400);

  // Persist add-ons
  if (quote.add_on_lines.length) {
    await supabase.from("reservation_add_ons").insert(
      quote.add_on_lines.map((l: any) => ({
        reservation_id: reservation.id,
        add_on_id: l.id,
        quantity: l.quantity,
        price: l.unit_price,
      })),
    );
  }

  // Increment promo uses
  if (quote.promo_applied) {
    const { data: promo } = await supabase.from("promo_codes").select("id, uses_count").eq("property_id", prop.id).ilike("code", quote.promo_applied.code).maybeSingle();
    if (promo) await supabase.from("promo_codes").update({ uses_count: (promo.uses_count ?? 0) + 1 }).eq("id", promo.id);
  }

  await supabase.from("booking_holds").delete().eq("id", hold_id);

  return j({ reservation, guest_id: guestId, quote });
}

// Guest self-service: look up by confirmation# + email
async function lookupReservation(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);

  const { confirmation_number, email } = payload;
  if (!confirmation_number || !email) return j({ error: "missing_fields" }, 400);

  const { data: res } = await supabase.from("reservations")
    .select("id, confirmation_number, check_in_date, check_out_date, total_price, guests_count, status, site_id, site_type_id, special_requests, guest_id, guests!inner(id, first_name, last_name, email, phone)")
    .eq("property_id", prop.id)
    .eq("confirmation_number", confirmation_number)
    .maybeSingle();

  if (!res || (res as any).guests?.email?.toLowerCase() !== String(email).toLowerCase()) {
    return j({ error: "not_found" }, 404);
  }

  const [siteType, site, addOns] = await Promise.all([
    res.site_type_id ? supabase.from("site_types").select("name").eq("id", res.site_type_id).maybeSingle() : Promise.resolve({ data: null }),
    res.site_id ? supabase.from("sites").select("site_number").eq("id", res.site_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("reservation_add_ons").select("quantity, price, add_ons(name)").eq("reservation_id", res.id),
  ]);

  return j({
    reservation: {
      ...res,
      site_type_name: (siteType as any).data?.name ?? null,
      site_number: (site as any).data?.site_number ?? null,
      add_ons: (addOns as any).data ?? [],
    },
  });
}

async function cancelReservation(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);

  const { confirmation_number, email } = payload;
  const lookupResp = await lookupReservation(slug, { confirmation_number, email });
  const lookup = await lookupResp.json();
  if (lookup.error) return j(lookup, 404);

  const res = lookup.reservation;
  if (["cancelled", "checked_out", "no_show"].includes(res.status)) {
    return j({ error: "cannot_cancel", detail: `Reservation is ${res.status}` }, 400);
  }

  const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", res.id).eq("property_id", prop.id);
  if (error) return j({ error: "cancel_failed", detail: error.message }, 400);

  return j({ ok: true, reservation_id: res.id });
}

// ============================================================================
// GUEST SELF-SERVICE: login + online check-in
// ============================================================================

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

async function guestLogin(slug: string, payload: any, req: Request) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);

  const { confirmation_number, last_name, zipcode } = payload ?? {};
  if (!confirmation_number || !last_name || !zipcode) {
    return j({ error: "missing_fields" }, 400);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const conf = String(confirmation_number).trim();

  // Rate limit: 5 attempts / 15 min per property+confirmation
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("guest_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("property_id", prop.id)
    .eq("confirmation_number", conf)
    .eq("succeeded", false)
    .gte("attempted_at", since);
  if ((count ?? 0) >= 5) {
    await supabase.from("guest_login_attempts").insert({
      property_id: prop.id, confirmation_number: conf, ip_address: ip, succeeded: false,
    });
    return j({ error: "rate_limited", detail: "Too many attempts. Try again in 15 minutes." }, 429);
  }

  const { data: res } = await supabase.from("reservations")
    .select("id, confirmation_number, check_in_date, check_out_date, status, guest_id, guests!inner(id, last_name, zipcode)")
    .eq("property_id", prop.id)
    .eq("confirmation_number", conf)
    .maybeSingle();

  const g = (res as any)?.guests;
  const ok = res && g
    && norm(g.last_name) === norm(last_name)
    && norm(g.zipcode) === norm(zipcode);

  await supabase.from("guest_login_attempts").insert({
    property_id: prop.id, confirmation_number: conf, ip_address: ip, succeeded: !!ok,
  });

  if (!ok) return j({ error: "invalid_credentials" }, 401);

  const token = await signGuestToken({
    reservation_id: res!.id,
    property_id: prop.id,
    guest_id: (res as any).guest_id,
  });

  return j({ token, reservation_id: res!.id, expires_in: 60 * 60 * 2 });
}

async function requireGuestClaims(payload: any): Promise<GuestClaims | Response> {
  const token = payload?.guest_token;
  if (!token) return j({ error: "unauthorized" }, 401);
  const claims = await verifyGuestToken(String(token));
  if (!claims) return j({ error: "session_expired" }, 401);
  return claims;
}

async function myReservations(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);
  const c = await requireGuestClaims(payload);
  if (c instanceof Response) return c;
  if (c.property_id !== prop.id) return j({ error: "unauthorized" }, 401);

  const todayISO = new Date().toISOString().slice(0, 10);
  const { data: reservations } = await supabase.from("reservations")
    .select("id, confirmation_number, check_in_date, check_out_date, total_price, guests_count, status, site_id, site_type_id, needs_staff_review, checkin_hold_reason, sites(site_number), site_types(name)")
    .eq("property_id", prop.id)
    .eq("guest_id", c.guest_id)
    .gte("check_out_date", todayISO)
    .order("check_in_date", { ascending: true });

  return j({ reservations: reservations ?? [] });
}

async function checkinPrefetch(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);
  const c = await requireGuestClaims(payload);
  if (c instanceof Response) return c;
  if (c.property_id !== prop.id) return j({ error: "unauthorized" }, 401);

  const { data: res } = await supabase.from("reservations")
    .select("*, guests(*), sites(id, site_number, maintenance_status), site_types(name, base_price)")
    .eq("id", c.reservation_id).eq("property_id", prop.id).maybeSingle();
  if (!res) return j({ error: "not_found" }, 404);

  const { data: existingAuths } = await supabase.from("payment_authorizations")
    .select("id, current_amount, captured_amount, status")
    .eq("property_id", prop.id)
    .in("status", ["active", "partially_captured"]);

  const hasActiveAuth = (existingAuths ?? []).some((a: any) =>
    Number(a.current_amount) > 0 && a.status !== "expired" && a.status !== "cancelled"
  );

  const { data: propRow } = await supabase.from("properties")
    .select("name, currency, timezone").eq("id", prop.id).maybeSingle();

  return j({ reservation: res, property: propRow, has_active_auth: hasActiveAuth });
}

async function checkinUpdateGuest(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);
  const c = await requireGuestClaims(payload);
  if (c instanceof Response) return c;
  if (c.property_id !== prop.id) return j({ error: "unauthorized" }, 401);

  const { guest = {}, adults_count, children_count, special_requests } = payload;
  const allowed = ["first_name", "last_name", "email", "phone", "street_address", "city", "state", "zipcode", "country"];
  const guestPatch: Record<string, any> = {};
  for (const k of allowed) if (guest[k] !== undefined) guestPatch[k] = guest[k];

  if (Object.keys(guestPatch).length > 0) {
    await supabase.from("guests").update(guestPatch).eq("id", c.guest_id);
  }

  const resPatch: Record<string, any> = {};
  if (adults_count !== undefined) resPatch.adults_count = Number(adults_count);
  if (children_count !== undefined) resPatch.children_count = Number(children_count);
  if (special_requests !== undefined) resPatch.special_requests = special_requests;
  if (Object.keys(resPatch).length > 0) {
    await supabase.from("reservations").update(resPatch).eq("id", c.reservation_id);
  }

  return j({ ok: true });
}

async function checkinAdyenSession(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);
  const c = await requireGuestClaims(payload);
  if (c instanceof Response) return c;
  if (c.property_id !== prop.id) return j({ error: "unauthorized" }, 401);
  if (ADYEN_IS_PLACEHOLDER) return j({ error: "adyen_not_configured" }, 503);

  const { amount, currency = "USD", return_url } = payload;
  if (amount === undefined) return j({ error: "missing_fields" }, 400);

  const base = ADYEN_ENVIRONMENT === "live" ? "https://checkout-live.adyen.com/v71" : "https://checkout-test.adyen.com/v71";
  const resp = await fetch(`${base}/sessions`, {
    method: "POST",
    headers: { "x-API-key": ADYEN_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      merchantAccount: ADYEN_MERCHANT_ACCOUNT,
      reference: `checkin-${c.reservation_id}-${Date.now()}`,
      amount: { currency, value: Math.round(Number(amount) * 100) },
      returnUrl: return_url ?? "https://example.com/return",
      countryCode: "US",
      shopperReference: `guest-${c.guest_id}`,
      metadata: { propertyId: prop.id, reservationId: c.reservation_id, mode: "authorize", initiatedBy: "guest_online_checkin" },
      storePaymentMethodMode: "askForConsent",
      recurringProcessingModel: "CardOnFile",
    }),
  });
  const raw = await resp.text();
  if (!resp.ok) return j({ error: "adyen_error", detail: raw }, 502);
  const session = JSON.parse(raw);
  return j({
    id: session.id, sessionData: session.sessionData, clientKey: session.clientKey,
    environment: ADYEN_ENVIRONMENT === "live" ? "live" : "test",
  });
}

async function checkinUploadSignature(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);
  const c = await requireGuestClaims(payload);
  if (c instanceof Response) return c;
  if (c.property_id !== prop.id) return j({ error: "unauthorized" }, 401);

  const { signature_data_url, signed_name } = payload;
  if (!signature_data_url || typeof signature_data_url !== "string") {
    return j({ error: "missing_signature" }, 400);
  }
  const m = signature_data_url.match(/^data:image\/png;base64,(.+)$/);
  if (!m) return j({ error: "invalid_signature_format" }, 400);
  const bin = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
  if (bin.length > 500_000) return j({ error: "signature_too_large" }, 400);

  const path = `${prop.id}/${c.reservation_id}.png`;
  const { error } = await supabase.storage.from("guest-signatures").upload(path, bin, {
    contentType: "image/png", upsert: true,
  });
  if (error) return j({ error: "upload_failed", detail: error.message }, 500);

  await supabase.from("reservations").update({
    signature_path: path,
    signature_captured_at: new Date().toISOString(),
    registration_signed_at: new Date().toISOString(),
    registration_signed_name: signed_name ?? null,
  }).eq("id", c.reservation_id);

  return j({ ok: true, signature_path: path });
}

async function checkinComplete(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);
  const c = await requireGuestClaims(payload);
  if (c instanceof Response) return c;
  if (c.property_id !== prop.id) return j({ error: "unauthorized" }, 401);

  const { data: res } = await supabase.from("reservations")
    .select("id, status, site_id, signature_path, guest_id, confirmation_number")
    .eq("id", c.reservation_id).eq("property_id", prop.id).maybeSingle();
  if (!res) return j({ error: "not_found" }, 404);
  if (["CHECKED_IN", "CHECK_IN_HOLD", "CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(res.status)) {
    return j({ error: "not_eligible", detail: `Reservation is ${res.status}` }, 400);
  }
  if (!res.signature_path) return j({ error: "signature_required" }, 400);

  const finalStatus = await decideCheckinStatus(prop.id, res.site_id);
  const updates: any = {
    status: finalStatus.status,
    checkin_source: "online",
    checked_in_at: new Date().toISOString(),
    needs_staff_review: finalStatus.status === "CHECK_IN_HOLD",
    checkin_hold_reason: finalStatus.reason,
    checkin_hold_at: finalStatus.status === "CHECK_IN_HOLD" ? new Date().toISOString() : null,
  };
  const { error } = await supabase.from("reservations").update(updates).eq("id", res.id);
  if (error) return j({ error: "checkin_failed", detail: error.message }, 500);

  // Create guest folio if not already present
  const { data: existingLedger } = await supabase.from("ledger_accounts")
    .select("id").eq("reservation_id", res.id).eq("ledger_type", "guest").eq("is_active", true).maybeSingle();
  if (!existingLedger) {
    await supabase.from("ledger_accounts").insert({
      property_id: prop.id, ledger_type: "guest",
      reservation_id: res.id, guest_id: res.guest_id, balance: 0,
    });
  }

  return j({ ok: true, status: updates.status, hold_reason: updates.checkin_hold_reason });
}

async function decideCheckinStatus(propertyId: string, siteId: string | null): Promise<{ status: string; reason: string | null }> {
  if (!siteId) return { status: "CHECK_IN_HOLD", reason: "no_site_assigned" };
  const { data: site } = await supabase.from("sites")
    .select("maintenance_status").eq("id", siteId).eq("property_id", propertyId).maybeSingle();
  if (!site) return { status: "CHECK_IN_HOLD", reason: "site_not_found" };
  if (site.maintenance_status !== "available") return { status: "CHECK_IN_HOLD", reason: `site_${site.maintenance_status}` };
  return { status: "CHECKED_IN", reason: null };
}

async function guestRegistrationCard(slug: string, payload: any) {
  const prop = await resolveProperty(slug);
  if (!prop) return j({ error: "not_found" }, 404);
  const c = await requireGuestClaims(payload);
  if (c instanceof Response) return c;
  if (c.property_id !== prop.id) return j({ error: "unauthorized" }, 401);

  const path = `${prop.id}/${c.reservation_id}.png`;
  const { data: signed } = await supabase.storage.from("guest-signatures")
    .createSignedUrl(path, 60 * 60);
  return j({ signed_url: signed?.signedUrl ?? null });
}

// ---- Per-instance rate limiter (sliding-window, best-effort) ----
// Not distributed across warm instances, but blocks the vast majority of
// scripted abuse on any single edge worker. Tune per-action.
const RL_LIMITS: Record<string, { windowMs: number; max: number }> = {
  search: { windowMs: 60_000, max: 60 },
  hold: { windowMs: 60_000, max: 20 },
  quote: { windowMs: 60_000, max: 120 },
  adyen_session: { windowMs: 60_000, max: 30 },
  confirm: { windowMs: 60_000, max: 20 },
  lookup: { windowMs: 60_000, max: 30 },
  cancel: { windowMs: 60_000, max: 20 },
  guest_login: { windowMs: 60_000, max: 10 },
  checkin_adyen_session: { windowMs: 60_000, max: 20 },
  checkin_complete: { windowMs: 60_000, max: 10 },
  _default: { windowMs: 60_000, max: 120 },
};
const rlBuckets = new Map<string, number[]>();
function rateLimit(key: string, action: string): boolean {
  const cfg = RL_LIMITS[action] ?? RL_LIMITS._default;
  const now = Date.now();
  const cutoff = now - cfg.windowMs;
  const arr = (rlBuckets.get(key) ?? []).filter((t) => t > cutoff);
  if (arr.length >= cfg.max) {
    rlBuckets.set(key, arr);
    return false;
  }
  arr.push(now);
  rlBuckets.set(key, arr);
  // Occasional GC to prevent unbounded growth
  if (rlBuckets.size > 5000 && Math.random() < 0.01) {
    for (const [k, v] of rlBuckets) {
      const kept = v.filter((t) => t > cutoff);
      if (kept.length === 0) rlBuckets.delete(k);
      else rlBuckets.set(k, kept);
    }
  }
  return true;
}

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip")
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);

  try {
    const { action, slug, ...rest } = await req.json();
    if (!slug) return j({ error: "slug_required" }, 400);

    const ip = clientIp(req);
    const rlKey = `${ip}:${slug}:${action}`;
    if (!rateLimit(rlKey, action)) {
      return new Response(
        JSON.stringify({ error: "rate_limited" }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": "60" } },
      );
    }

    switch (action) {
      case "get_property": return await getPropertyInfo(slug);
      case "search": return await searchAvailability(slug, rest.check_in, rest.check_out, rest.guests ?? 1, rest.filters ?? null);
      case "hold": return await createHold(slug, rest);
      case "quote": return await computeQuote(slug, rest);
      case "adyen_session": return await createAdyenSession(slug, rest);
      case "confirm": return await confirmBooking(slug, rest);
      case "lookup": return await lookupReservation(slug, rest);
      case "cancel": return await cancelReservation(slug, rest);

      // Guest self-service
      case "guest_login": return await guestLogin(slug, rest, req);
      case "my_reservations": return await myReservations(slug, rest);
      case "checkin_prefetch": return await checkinPrefetch(slug, rest);
      case "checkin_update_guest": return await checkinUpdateGuest(slug, rest);
      case "checkin_adyen_session": return await checkinAdyenSession(slug, rest);
      case "checkin_upload_signature": return await checkinUploadSignature(slug, rest);
      case "checkin_complete": return await checkinComplete(slug, rest);
      case "guest_signature_url": return await guestRegistrationCard(slug, rest);

      default: return j({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return j({ error: "internal_error", detail: (e as Error).message }, 500);
  }
});

