// Free zipcode → city/state lookup using Zippopotam.us (no key required).
// Supports many countries; defaults to US.

export interface ZipLookupResult {
  city: string;
  state: string; // state abbreviation when available
  country: string;
}

const cache = new Map<string, ZipLookupResult | null>();

export async function lookupZip(
  zip: string,
  country: string = "US"
): Promise<ZipLookupResult | null> {
  const cleanZip = (zip || "").trim();
  const cc = (country || "US").trim().toLowerCase();
  if (!cleanZip) return null;

  // Basic sanity: US zip must be 5 digits; other countries ≥3 chars
  if (cc === "us" && !/^\d{5}$/.test(cleanZip)) return null;
  if (cleanZip.length < 3) return null;

  const key = `${cc}:${cleanZip}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const res = await fetch(`https://api.zippopotam.us/${cc}/${encodeURIComponent(cleanZip)}`);
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) {
      cache.set(key, null);
      return null;
    }
    const result: ZipLookupResult = {
      city: place["place name"] ?? "",
      state: place["state abbreviation"] ?? place["state"] ?? "",
      country: data["country abbreviation"] ?? country,
    };
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}
