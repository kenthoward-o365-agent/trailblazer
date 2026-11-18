import { supabase } from "@/integrations/supabase/client";

const BUCKET = "campground-maps";

/**
 * The campground-maps bucket is private, so stored public URLs no longer load.
 * Extract the object path and exchange it for a short-lived signed URL.
 */
export async function resolveMapImageUrl(storedUrl: string | null | undefined): Promise<string | null> {
  if (!storedUrl) return null;

  const marker = `/${BUCKET}/`;
  const idx = storedUrl.indexOf(marker);
  if (idx === -1) return storedUrl; // not a storage URL (e.g. external image)

  const path = decodeURIComponent(storedUrl.slice(idx + marker.length).split("?")[0]);

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    console.error("Failed to sign campground map URL", error);
    return null;
  }
  return data.signedUrl;
}
