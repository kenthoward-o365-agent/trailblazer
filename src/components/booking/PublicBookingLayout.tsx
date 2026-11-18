import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { Loader2, MapPin, Phone, Mail, Facebook, Instagram, Globe, HelpCircle } from "lucide-react";
import { bookingApi } from "@/lib/bookingEngineApi";
import { supabase } from "@/integrations/supabase/client";
import PublicBrandStyle from "@/components/public/PublicBrandStyle";


interface Ctx {
  slug: string;
  data: any;
}

// Convert hex color -> HSL numbers so we can drive CSS variables consistently
function hexToHsl(hex: string): string | null {
  const m = hex.replace("#", "").match(/^([\da-f]{6}|[\da-f]{3})$/i);
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%`;
}

export function PublicBookingLayout() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    bookingApi.getProperty(slug).then(setData).catch((e) => setErr(e.message));
  }, [slug]);

  // On the root search route the search page owns the full layout (persistent
  // booking bar + park story + results in a single centered card). Skip the
  // layout's own header/hero band on that route.
  const isSearchRoute = /^\/b\/[^/]+\/?$/.test(location.pathname);

  const primaryHex: string = data?.settings?.primary_color ?? "#064e3b";
  const primaryHsl = useMemo(() => hexToHsl(primaryHex) ?? "160 84% 16%", [primaryHex]);

  const logoUrl = useMemo(() => {
    if (data?.settings?.logo_url) return data.settings.logo_url as string;
    if (data?.settings?.logo_signed_url) return data.settings.logo_signed_url as string;
    if (!data?.settings?.logo_image_path) return null;
    return supabase.storage.from("booking-gallery").getPublicUrl(data.settings.logo_image_path).data.publicUrl;
  }, [data]);

  useEffect(() => {
    if (!data?.property?.name) return;
    document.title = `Book ${data.property.name}`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", data.settings?.tagline ?? `Reserve your stay at ${data.property.name}`);
    if (!data.settings?.allow_search_engine_indexing) {
      let robots = document.querySelector('meta[name="robots"]');
      if (!robots) { robots = document.createElement("meta"); robots.setAttribute("name", "robots"); document.head.appendChild(robots); }
      robots.setAttribute("content", "noindex, nofollow");
    }
  }, [data]);

  if (err) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Booking site unavailable</h1>
          <p className="text-muted-foreground">{err}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const s = data.settings ?? {};
  const backgroundUrl: string | null = s.background_signed_url ?? null;

  return (
    <div
      className={`booking-brand min-h-screen ${backgroundUrl ? "isolate" : "bg-background"} flex flex-col relative`}
      style={{
        ["--brand" as any]: primaryHex,
        ["--primary" as any]: primaryHsl,
        ["--ring" as any]: primaryHsl,
        // Emerald Prestige booking-engine tokens (locked palette from selected design direction)
        ["--be-emerald" as any]: "160 84% 16%",
        ["--be-gold" as any]: "43 51% 54%",
        ["--be-cream" as any]: "45 60% 92%",
        ["--be-canvas" as any]: "45 60% 96%",
      }}
    >
      {backgroundUrl && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-0 pointer-events-none"
            style={{
              backgroundImage: `url("${backgroundUrl}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div
            aria-hidden
            className="fixed inset-0 z-0 pointer-events-none"
            style={{ background: "hsl(var(--be-canvas) / 0.72)" }}
          />
        </>
      )}
      <div className="relative z-10 flex flex-col flex-1 min-h-screen">
      <PublicBrandStyle settings={s} />
      {!isSearchRoute && (
        <header className="border-b bg-card/95 backdrop-blur sticky top-0 z-40">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <Link to={`/b/${slug}`} className="flex items-center gap-3 min-w-0">
              {logoUrl ? (
                <img src={logoUrl} alt={data.property.name} className="h-9 md:h-11 w-auto object-contain" />
              ) : (
                <span className="font-bold text-lg md:text-xl truncate" style={{ color: primaryHex }}>
                  {data.property.name}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-3 md:gap-5 text-xs text-muted-foreground">
              {Array.isArray(s.header_links) && s.header_links.filter((l: any) => l?.label && l?.url).map((l: any, i: number) => (
                <a
                  key={i}
                  href={l.url}
                  target={l.open_in_new_tab ? "_blank" : undefined}
                  rel={l.open_in_new_tab ? "noreferrer" : undefined}
                  className="hidden md:inline-flex text-sm font-medium hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
              {s.contact_phone && <a href={`tel:${s.contact_phone}`} className="hidden sm:flex items-center gap-1 hover:text-foreground"><Phone className="h-3 w-3" />{s.contact_phone}</a>}
              {s.contact_email && <a href={`mailto:${s.contact_email}`} className="hidden md:flex items-center gap-1 hover:text-foreground"><Mail className="h-3 w-3" />{s.contact_email}</a>}
              <Link to={`/b/${slug}/login`} className="flex items-center gap-1 hover:text-foreground font-medium">
                <span className="hidden xs:inline">My trip</span><span className="xs:hidden">Trip</span>
              </Link>
              <Link to={`/b/${slug}/manage`} className="flex items-center gap-1 hover:text-foreground font-medium">
                <HelpCircle className="h-3 w-3" /> <span className="hidden xs:inline">Manage booking</span><span className="xs:hidden">Manage</span>
              </Link>
            </div>
          </div>
        </header>
      )}

      <main className={isSearchRoute ? "flex-1 w-full" : "container mx-auto px-4 py-6 md:py-10 flex-1 w-full"}>
        <Outlet context={{ slug: slug!, data } satisfies Ctx} />
      </main>


      <footer className="border-t mt-16 bg-card/50">
        <div className="container mx-auto px-4 py-8 grid gap-6 md:grid-cols-4 text-xs text-muted-foreground">
          <div>
            <div className="font-semibold text-foreground text-sm">{data.property.name}</div>
            {s.contact_email && <div className="mt-1">{s.contact_email}</div>}
            {s.contact_phone && <div>{s.contact_phone}</div>}
            <div className="mt-3 flex items-center gap-3">
              {s.social_facebook && <a href={s.social_facebook} target="_blank" rel="noreferrer" className="hover:text-foreground"><Facebook className="h-4 w-4" /></a>}
              {s.social_instagram && <a href={s.social_instagram} target="_blank" rel="noreferrer" className="hover:text-foreground"><Instagram className="h-4 w-4" /></a>}
              {s.social_website && <a href={s.social_website} target="_blank" rel="noreferrer" className="hover:text-foreground"><Globe className="h-4 w-4" /></a>}
            </div>
          </div>
          {Array.isArray(s.footer_columns) && s.footer_columns.slice(0, 3).map((col: any, i: number) => (
            <div key={i}>
              {col?.title && <div className="font-semibold text-foreground text-sm mb-2">{col.title}</div>}
              <ul className="space-y-1">
                {Array.isArray(col?.links) && col.links.filter((l: any) => l?.label && l?.url).map((l: any, j: number) => (
                  <li key={j}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="hover:text-foreground">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="md:col-span-4 pt-4 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <span>{s.footer_note ?? ""}</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />Powered by <span className="font-semibold ml-1">Trailblazer PMS</span></span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
