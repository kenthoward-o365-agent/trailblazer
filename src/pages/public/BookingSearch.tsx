import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { bookingApi } from "@/lib/bookingEngineApi";
import {
  Loader2,
  Users,
  Calendar as CalendarIcon,
  Sparkles,
  X,
  Map as MapIcon,
  ImageIcon,
  Star,
  Wifi,
  Waves,
  Flame,
  TreePine,
  Bath,
  Utensils,
  Bike,
  Check,
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Ctx = { slug: string; data: any };

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

function galleryUrl(asset: any): string | null {
  if (!asset) return null;
  if (asset.signed_url) return asset.signed_url;
  if (asset.storage_path)
    return supabase.storage.from("booking-gallery").getPublicUrl(asset.storage_path).data.publicUrl;
  return null;
}

function fmtChip(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Match amenity strings to a lucide icon
function amenityIcon(name: string) {
  const s = name.toLowerCase();
  if (s.includes("wifi") || s.includes("wi-fi") || s.includes("internet")) return Wifi;
  if (s.includes("pool") || s.includes("swim")) return Waves;
  if (s.includes("fire") || s.includes("bbq") || s.includes("grill")) return Flame;
  if (s.includes("bath") || s.includes("shower")) return Bath;
  if (s.includes("kitchen") || s.includes("dining") || s.includes("cafe")) return Utensils;
  if (s.includes("bike") || s.includes("trail")) return Bike;
  return TreePine;
}

export default function BookingSearch() {
  const { slug, data } = useOutletContext<Ctx>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialCheckIn = searchParams.get("checkin") || todayISO(1);
  const initialCheckOut = searchParams.get("checkout") || todayISO(3);
  const initialGuests = Number(searchParams.get("guests")) || 2;
  const initialSiteType = searchParams.get("site_type_id");
  const shouldAutoRun = searchParams.get("auto") === "1" || !!searchParams.get("checkin");

  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [unavailable, setUnavailable] = useState<any[]>([]);
  const [mapData, setMapData] = useState<{ image_url: string; width: number; height: number } | null>(null);
  const [losApplied, setLosApplied] = useState<any>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [mapPicker, setMapPicker] = useState<any | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [pickRange, setPickRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [filters, setFilters] = useState<{
    min_length: string;
    needs_pull_through: boolean;
    needs_50amp: boolean;
    needs_30amp: boolean;
    needs_shade: boolean;
    needs_fire_pit: boolean;
    needs_picnic_table: boolean;
    needs_bump_outs: boolean;
  }>({
    min_length: "",
    needs_pull_through: false,
    needs_50amp: false,
    needs_30amp: false,
    needs_shade: false,
    needs_fire_pit: false,
    needs_picnic_table: false,
    needs_bump_outs: false,
  });
  const autoRanRef = useRef(false);

  const activeFilters = () => {
    const f: any = {};
    if (filters.min_length && Number(filters.min_length) > 0) f.min_length = Number(filters.min_length);
    for (const k of ["needs_pull_through","needs_50amp","needs_30amp","needs_shade","needs_fire_pit","needs_picnic_table","needs_bump_outs"] as const) {
      if (filters[k]) f[k] = true;
    }
    return Object.keys(f).length ? f : null;
  };

  const toISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseISO = (s: string) => (s ? new Date(s + "T00:00:00") : undefined);



  const propertyGallery = useMemo(
    () => (data.gallery ?? []).filter((g: any) => g.scope === "property"),
    [data.gallery],
  );
  const heroImage = useMemo(() => {
    if (data.settings?.hero_signed_url) return data.settings.hero_signed_url as string;
    const hero = propertyGallery.find((g: any) => g.is_hero) ?? propertyGallery[0];
    return hero ? galleryUrl(hero) : null;
  }, [propertyGallery, data.settings]);

  // Featured amenity strings pulled from settings or aggregated from site types
  const parkFeatures: string[] = useMemo(() => {
    const raw = (data.settings?.park_features ?? []) as string[];
    if (raw.length) return raw.slice(0, 6);
    const agg = new Set<string>();
    (data.site_types ?? []).forEach((st: any) =>
      (st.featured_amenities ?? []).forEach((a: string) => agg.add(a)),
    );
    return Array.from(agg).slice(0, 6);
  }, [data]);

  async function search() {
    setLoading(true);
    setResults(null);
    setUnavailable([]);
    try {
      const r = await bookingApi.search(slug, checkIn, checkOut, guests, activeFilters());
      setResults(r.results);
      setUnavailable(r.unavailable ?? []);
      setLosApplied(r.los_applied);
      setMapData(r.map ?? null);
      setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoRanRef.current) return;
    if (!shouldAutoRun) return;
    autoRanRef.current = true;
    search();
    if (initialSiteType) {
      setTimeout(() => {
        document
          .getElementById(`site-type-${initialSiteType}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectSiteType(item: any, siteId?: string) {
    setSelecting(item.site_type.id);
    try {
      const { hold } = await bookingApi.hold(slug, {
        site_type_id: item.site_type.id,
        site_id: siteId ?? null,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        filters: activeFilters(),
      });
      navigate(`/b/${slug}/checkout/${hold.id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSelecting(null);
    }
  }

  function applyAltDates(nextIn: string, nextOut: string) {
    setCheckIn(nextIn);
    setCheckOut(nextOut);
    // give React a tick, then re-run
    setTimeout(() => search(), 0);
  }

  function quickSearchSiteType(st: any) {
    const nextIn = todayISO(1);
    const nextOut = todayISO(3);
    setCheckIn(nextIn);
    setCheckOut(nextOut);
    if (st?.max_adults && guests < st.max_adults) setGuests(Math.min(2, st.max_adults));
    setTimeout(() => {
      search();
      setTimeout(() => document.getElementById(`site-type-${st.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 900);
    }, 0);
  }


  const s = data.settings ?? {};
  const hasBackgroundImage = Boolean(s.background_signed_url);
  const nights = useMemo(() => {
    const a = new Date(checkIn).getTime();
    const b = new Date(checkOut).getTime();
    return Math.max(0, Math.round((b - a) / 86400000));
  }, [checkIn, checkOut]);

  return (
    <div className={`w-full flex items-start justify-center py-4 md:py-8 px-3 md:px-6 min-h-screen ${hasBackgroundImage ? "bg-transparent" : "bg-[hsl(var(--be-canvas))]"}`}>
      <div className="max-w-7xl w-full bg-card rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border border-[hsl(var(--be-emerald))]/10 flex flex-col animate-in fade-in duration-500">
        {/* Persistent booking bar */}
        <div className="bg-[hsl(var(--be-emerald))] p-4 lg:px-8 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 lg:gap-4 border-b border-[hsl(var(--be-gold))]/25">
          <div className="flex-shrink-0 flex items-center justify-between lg:justify-start">
            <div className="text-[hsl(var(--be-gold))] font-serif text-xl md:text-2xl font-bold tracking-tight uppercase leading-none">
              {data.property.name}
            </div>
            {s.contact_phone && (
              <a
                href={`tel:${s.contact_phone}`}
                className="lg:hidden text-xs text-white/70 underline underline-offset-2"
              >
                {s.contact_phone}
              </a>
            )}
          </div>

          <div className="flex-grow grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 w-full">
            <Popover
              open={dateOpen}
              onOpenChange={(o) => {
                setDateOpen(o);
                if (o) setPickRange(undefined);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="col-span-2 grid grid-cols-2 gap-2 lg:gap-3 text-left"
                >
                  <div className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg px-3 py-2 flex flex-col cursor-pointer transition-colors">
                    <span className="text-[10px] uppercase font-bold text-[hsl(var(--be-gold))] tracking-widest flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" /> Check In
                    </span>
                    <span className="text-sm font-medium text-white">
                      {pickRange?.from ? fmtChip(toISO(pickRange.from)) : checkIn ? fmtChip(checkIn) : "Select date"}
                    </span>
                  </div>
                  <div className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg px-3 py-2 flex flex-col cursor-pointer transition-colors">
                    <span className="text-[10px] uppercase font-bold text-[hsl(var(--be-gold))] tracking-widest flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" /> Check Out
                    </span>
                    <span className="text-sm font-medium text-white">
                      {pickRange?.to ? fmtChip(toISO(pickRange.to)) : !pickRange?.from && checkOut ? fmtChip(checkOut) : "Select date"}
                    </span>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto z-[100]" align="start">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  defaultMonth={parseISO(checkIn) ?? new Date()}
                  selected={pickRange as any}
                  onSelect={(r: any) => {
                    // Force a fresh two-click flow: first click sets from, second sets to.
                    if (!r) {
                      setPickRange(undefined);
                      return;
                    }
                    if (pickRange?.from && !pickRange?.to) {
                      // Second click — commit the range
                      const first = pickRange.from;
                      const clicked = r.to ?? r.from;
                      const from = clicked < first ? clicked : first;
                      const to = clicked < first ? first : clicked;
                      setPickRange({ from, to });
                      setCheckIn(toISO(from));
                      setCheckOut(toISO(to));
                      setDateOpen(false);
                    } else {
                      // First click — start a new range
                      const start = r.from ?? r.to;
                      setPickRange({ from: start, to: undefined });
                    }
                  }}
                  disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                  initialFocus
                  className="p-3"
                />
              </PopoverContent>
            </Popover>


            <label className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg px-3 py-2 flex flex-col cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-[hsl(var(--be-gold))]">
              <span className="text-[10px] uppercase font-bold text-[hsl(var(--be-gold))] tracking-widest flex items-center gap-1">
                <Users className="h-3 w-3" /> Guests
              </span>
              <input
                type="number"
                min={1}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="bg-transparent text-sm font-medium text-white outline-none w-full"
              />
            </label>
            <button
              onClick={search}
              disabled={loading || nights < 1}
              className="rounded-lg px-6 bg-[hsl(var(--be-gold))] text-[hsl(var(--be-emerald))] text-sm font-bold uppercase tracking-widest hover:brightness-110 active:brightness-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md h-full py-3"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Check availability</>}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Park story */}
          <div className="lg:col-span-5 p-6 lg:p-10 lg:border-r border-border/60 flex flex-col gap-8">
            <div className="relative rounded-2xl overflow-hidden shadow-lg bg-muted">
              {heroImage ? (
                <button
                  onClick={() => setLightbox(heroImage)}
                  className="block w-full aspect-[4/3] group"
                  aria-label="View header image"
                >
                  <img
                    src={heroImage}
                    alt={data.property.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </button>
              ) : (
                <div
                  className="aspect-[4/3] w-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, hsl(var(--be-emerald)), hsl(var(--be-emerald))/0.7)" }}
                >
                  <ImageIcon className="h-12 w-12 text-white/40" />
                </div>
              )}
              <div className="absolute top-4 right-4 bg-white/95 backdrop-blur px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <Star className="h-3.5 w-3.5 fill-[hsl(var(--be-gold))] text-[hsl(var(--be-gold))]" />
                <span className="text-[hsl(var(--be-emerald))] text-[10px] font-bold uppercase tracking-tighter">
                  {s.rating_label ?? "Trailblazer Verified"}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-[hsl(var(--be-emerald))] leading-tight">
                {data.property.name}
              </h1>
              {s.tagline && <p className="text-[hsl(var(--be-gold))] text-sm font-semibold uppercase tracking-widest">{s.tagline}</p>}
              {s.about_markdown && (
                <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap line-clamp-6">
                  {s.about_markdown}
                </p>
              )}

              {parkFeatures.length > 0 && (
                <div className="grid grid-cols-2 gap-4 pt-4">
                  {parkFeatures.map((f) => {
                    const Icon = amenityIcon(f);
                    return (
                      <div key={f} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[hsl(var(--be-cream))] flex items-center justify-center text-[hsl(var(--be-emerald))] shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-medium text-foreground/80 uppercase tracking-wide">{f}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {propertyGallery.length > 1 && (
              <div className="pt-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">Gallery</div>
                <div className="grid grid-cols-4 gap-2">
                  {propertyGallery.slice(0, 8).map((g: any) => (
                    <button
                      key={g.id}
                      onClick={() => setLightbox(galleryUrl(g))}
                      className="aspect-square rounded-md overflow-hidden group relative bg-muted"
                    >
                      <img
                        src={galleryUrl(g) ?? undefined}
                        alt={g.alt_text ?? ""}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          <div
            id="results"
            className="lg:col-span-7 bg-[hsl(var(--be-canvas))]/40 p-6 lg:p-10 space-y-6 lg:max-h-[1200px] lg:overflow-y-auto"
          >
            {(loading || results) && (
              <div className="flex items-baseline justify-between">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {loading ? "Searching…" : results && results.length > 0 ? "Available Stays" : "Suggested Stays"}
                </h2>
                {results && results.length > 0 && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--be-emerald))] bg-[hsl(var(--be-emerald))]/10 px-2.5 py-1 rounded-full">
                    {nights} {nights === 1 ? "night" : "nights"}
                  </span>
                )}
              </div>
            )}

            {/* Site requirement filters */}
            <div className="rounded-xl border border-border/60 bg-card p-3 md:p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Filter by site needs</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Rig length</span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={filters.min_length}
                    onChange={(e) => setFilters((f) => ({ ...f, min_length: e.target.value }))}
                    placeholder="ft"
                    className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
                  />
                </label>
                {([
                  ["needs_50amp", "50A"],
                  ["needs_30amp", "30A"],
                  ["needs_pull_through", "Pull-thru"],
                  ["needs_shade", "Shade"],
                  ["needs_fire_pit", "Fire pit"],
                  ["needs_picnic_table", "Picnic table"],
                  ["needs_bump_outs", "Bump-outs"],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, [k]: !f[k] }))}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      filters[k]
                        ? "bg-[hsl(var(--be-emerald))] text-white border-[hsl(var(--be-emerald))]"
                        : "bg-background text-foreground/70 border-border hover:border-[hsl(var(--be-emerald))]/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {(filters.min_length || filters.needs_50amp || filters.needs_30amp ||
                  filters.needs_pull_through || filters.needs_shade || filters.needs_fire_pit ||
                  filters.needs_picnic_table || filters.needs_bump_outs) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({
                        min_length: "", needs_pull_through: false, needs_50amp: false,
                        needs_30amp: false, needs_shade: false, needs_fire_pit: false,
                        needs_picnic_table: false, needs_bump_outs: false,
                      });
                      if (results) setTimeout(() => search(), 0);
                    }}
                    className="text-[11px] text-muted-foreground underline hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
                {results && (
                  <button
                    type="button"
                    onClick={search}
                    className="ml-auto px-3 py-1 rounded-full text-[11px] font-bold bg-[hsl(var(--be-gold))] text-[hsl(var(--be-emerald))] uppercase tracking-widest"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>

            {!loading && !results && (
              <WelcomePanel
                data={data}
                onSiteTypeClick={quickSearchSiteType}
                onOpenLightbox={setLightbox}
              />
            )}


            {losApplied && results && results.length > 0 && (
              <div
                className="rounded-lg border p-3 text-sm flex items-center gap-2 bg-[hsl(var(--be-cream))] border-[hsl(var(--be-gold))]/40 text-[hsl(var(--be-emerald))]"
              >
                <Sparkles className="h-4 w-4 text-[hsl(var(--be-gold))]" />
                <span>
                  <strong>Length-of-stay discount applied:</strong>{" "}
                  {losApplied.discount_type === "percent"
                    ? `${losApplied.discount_value}% off`
                    : `$${losApplied.discount_value} off`}{" "}
                  for stays of {losApplied.min_nights}+ nights
                </span>
              </div>
            )}

            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-card rounded-2xl border border-border/60 overflow-hidden animate-pulse flex flex-col md:flex-row">
                    <div className="w-full md:w-56 h-40 md:h-auto bg-muted" />
                    <div className="flex-grow p-6 space-y-3">
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-5 w-2/3 bg-muted rounded" />
                      <div className="h-3 w-1/2 bg-muted rounded" />
                      <div className="h-9 w-32 bg-muted rounded mt-4" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && results && results.length === 0 && unavailable.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
                No bookable site types are configured yet for this park. Please check back soon.
              </div>
            )}

            {!loading && results && results.length === 0 && unavailable.length > 0 && (
              <div className="bg-card border-l-4 border-[hsl(var(--be-gold))] p-4 rounded-r-lg shadow-sm flex items-start gap-3">
                <span className="text-[hsl(var(--be-gold))] font-bold text-lg leading-none mt-0.5">!</span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[hsl(var(--be-emerald))]">No results for your selected dates</p>
                  <p className="text-xs text-muted-foreground">
                    We've suggested the next available stays for each site type below. Tap a date chip to re-check.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {/* Available results */}
              {!loading && (results ?? []).map((item, idx) => (
                <ResultCard
                  key={item.site_type.id}
                  item={item}
                  onSelect={() => selectSiteType(item)}
                  onPickSite={(siteId) => selectSiteType(item, siteId)}
                  onOpenMap={mapData ? () => setMapPicker(item) : null}
                  isSelecting={selecting === item.site_type.id}
                  delayMs={idx * 60}
                />
              ))}

              {/* Unavailable — alt dates */}
              {!loading && unavailable.map((u, idx) => (
                <UnavailableCard
                  key={u.site_type.id}
                  item={u}
                  onApplyDates={applyAltDates}
                  delayMs={((results?.length ?? 0) + idx) * 60}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-5xl p-0 bg-black border-0">
          {(() => {
            const urls = propertyGallery
              .map((g: any) => galleryUrl(g))
              .filter((u: string | null): u is string => !!u);
            const idx = lightbox ? urls.indexOf(lightbox) : -1;
            const hasNav = idx >= 0 && urls.length > 1;
            const go = (delta: number) => {
              if (idx < 0) return;
              const next = (idx + delta + urls.length) % urls.length;
              setLightbox(urls[next]);
            };
            return (
              <>
                {lightbox && (
                  <img src={lightbox} alt="" className="w-full h-auto max-h-[85vh] object-contain" />
                )}
                {hasNav && (
                  <>
                    <button
                      onClick={() => go(-1)}
                      aria-label="Previous image"
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white p-2 hover:bg-black/80"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                      onClick={() => go(1)}
                      aria-label="Next image"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white p-2 hover:bg-black/80"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 text-white text-xs px-3 py-1">
                      {idx + 1} / {urls.length}
                    </div>
                  </>
                )}
                <button
                  onClick={() => setLightbox(null)}
                  aria-label="Close"
                  className="absolute top-2 right-2 rounded-full bg-black/50 text-white p-2 hover:bg-black/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>


      {/* Map picker */}
      <Dialog open={!!mapPicker} onOpenChange={(o) => !o && setMapPicker(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          {mapPicker && mapData && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div>
                  <div className="font-semibold">Pick your site — {mapPicker.site_type.name}</div>
                  <div className="text-xs text-muted-foreground">Tap an available site to reserve it</div>
                </div>
                <button onClick={() => setMapPicker(null)} className="rounded-full p-1.5 hover:bg-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div
                className="relative bg-muted/30"
                style={{ paddingBottom: `${(mapData.height / mapData.width) * 100}%` }}
              >
                <div className="absolute inset-0">
                  <img src={mapData.image_url} alt="Campground map" className="w-full h-full object-contain" />
                  {mapPicker.available_sites
                    .filter((s: any) => s.map_x != null && s.map_y != null)
                    .map((s: any) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setMapPicker(null);
                          selectSiteType(mapPicker, s.id);
                        }}
                        disabled={selecting === mapPicker.site_type.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg text-white text-[10px] font-bold flex items-center justify-center hover:scale-125 active:scale-110 transition-transform min-w-7 h-7 px-1.5 bg-[hsl(var(--be-emerald))]"
                        style={{ left: `${s.map_x}%`, top: `${s.map_y}%` }}
                        title={`Site ${s.site_number}`}
                      >
                        {s.site_number}
                      </button>
                    ))}
                </div>
              </div>
              <div className="px-4 py-2 text-xs text-muted-foreground border-t">
                {mapPicker.available_sites.length} available · $
                {(mapPicker.total / mapPicker.nights).toFixed(0)}/night
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------- sub-components --------------------- */

function ResultCard({
  item,
  onSelect,
  onPickSite,
  onOpenMap,
  isSelecting,
  delayMs,
}: {
  item: any;
  onSelect: () => void;
  onPickSite: (siteId: string) => void;
  onOpenMap: null | (() => void);
  isSelecting: boolean;
  delayMs: number;
}) {
  const perNight = item.total / item.nights;
  const pickable = item.booking_config?.allow_specific_site_pick && item.available_sites?.length > 0;
  const desc = item.booking_config?.public_description ?? item.site_type.description;

  return (
    <div
      id={`site-type-${item.site_type.id}`}
      className="group bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-border/60 flex flex-col md:flex-row animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "backwards" }}
    >
      <div className="w-full md:w-56 md:shrink-0 bg-muted relative overflow-hidden">
        {item.site_type.image_url ? (
          <img
            src={item.site_type.image_url}
            alt={item.site_type.name}
            className="w-full h-48 md:h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-48 md:h-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, hsl(var(--be-cream)), hsl(var(--be-emerald))/0.15)" }}
          >
            <TreePine className="h-10 w-10 text-[hsl(var(--be-emerald))]/40" />
          </div>
        )}
        <span className="absolute top-3 left-3 bg-white/95 backdrop-blur text-[hsl(var(--be-emerald))] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
          {item.available_count} available
        </span>
      </div>

      <div className="flex-grow p-5 md:p-6 flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-[hsl(var(--be-gold))] uppercase tracking-widest">
                Site Type
              </span>
              <h3 className="text-xl font-bold text-[hsl(var(--be-emerald))] mt-1 leading-snug">
                {item.site_type.name}
              </h3>
            </div>
          </div>

          {desc && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{desc}</p>}

          <div className="flex items-center flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
            {item.site_type.max_adults != null && (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Sleeps {item.site_type.max_adults + (item.site_type.max_children ?? 0)}
              </span>
            )}
            {(item.site_type.featured_amenities ?? []).slice(0, 3).map((a: string) => {
              const Icon = amenityIcon(a);
              return (
                <span key={a} className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" /> {a}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex items-end justify-between border-t border-border/50 pt-4 gap-3 flex-wrap">
          <div>
            {item.los_discount > 0 && (
              <div className="text-[11px] line-through text-muted-foreground">${item.subtotal.toFixed(0)}</div>
            )}
            <div className="text-2xl font-bold text-[hsl(var(--be-emerald))] leading-none">
              ${perNight.toFixed(0)}
              <span className="text-xs font-normal text-muted-foreground ml-1">/night</span>
            </div>
            <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-1">
              ${item.total.toFixed(2)} total · {item.nights}n
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {pickable && onOpenMap && (
              <button
                onClick={onOpenMap}
                className="text-[10px] font-bold text-[hsl(var(--be-emerald))] uppercase tracking-widest hover:underline flex items-center gap-1"
              >
                <MapIcon className="h-3 w-3" /> Pick on map
              </button>
            )}
            <button
              onClick={onSelect}
              disabled={isSelecting}
              className="px-6 py-2.5 bg-[hsl(var(--be-emerald))] text-white text-xs font-bold rounded-lg uppercase tracking-widest shadow-lg shadow-[hsl(var(--be-emerald))]/20 hover:brightness-110 active:brightness-95 transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {isSelecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Book now
            </button>
          </div>
        </div>

        {pickable && (
          <div className="pt-3 border-t border-border/40 -mt-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Or pick a specific site
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.available_sites.slice(0, 20).map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => onPickSite(s.id)}
                  disabled={isSelecting}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded border border-[hsl(var(--be-emerald))]/25 text-[hsl(var(--be-emerald))] hover:bg-[hsl(var(--be-emerald))] hover:text-white transition-colors disabled:opacity-50"
                >
                  {s.site_number}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UnavailableCard({
  item,
  onApplyDates,
  delayMs,
}: {
  item: any;
  onApplyDates: (nextIn: string, nextOut: string) => void;
  delayMs: number;
}) {
  const na = item.next_available;

  return (
    <div
      className="bg-card rounded-2xl overflow-hidden border border-border/60 flex flex-col md:flex-row opacity-90 animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: "backwards" }}
    >
      <div className="w-full md:w-56 md:shrink-0 bg-muted relative overflow-hidden grayscale">
        <div
          className="w-full h-40 md:h-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, hsl(var(--muted)), hsl(var(--muted)))" }}
        >
          <TreePine className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <span className="absolute top-3 left-3 bg-white/95 backdrop-blur text-muted-foreground text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
          Unavailable
        </span>
      </div>
      <div className="flex-grow p-5 md:p-6 flex flex-col justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Site Type</span>
          <h3 className="text-lg font-bold text-foreground/70 mt-1">{item.site_type.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">${Number(item.rate_per_night).toFixed(0)}/night · not available for your selected dates</p>
        </div>

        {na ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-[hsl(var(--be-cream))]/60 border border-[hsl(var(--be-gold))]/30 px-3 py-2 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-[hsl(var(--be-gold))]" />
              <span className="text-xs text-[hsl(var(--be-emerald))]">
                Next available:{" "}
                <strong>
                  {fmtChip(na.check_in)} – {fmtChip(na.check_out)}
                </strong>
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => onApplyDates(na.check_in, na.check_out)}
              className="bg-[hsl(var(--be-emerald))] hover:bg-[hsl(var(--be-emerald))]/90 text-white text-[11px] font-bold uppercase tracking-widest h-8"
            >
              Try these dates
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic">No availability in the next 30 days for this site type.</div>
        )}
      </div>
    </div>
  );
}

/* --------------------- Welcome panel (pre-search) --------------------- */

function WelcomePanel({
  data,
  onSiteTypeClick,
  onOpenLightbox,
}: {
  data: any;
  onSiteTypeClick: (st: any) => void;
  onOpenLightbox: (url: string) => void;
}) {
  const s = data.settings ?? {};
  const property = data.property ?? {};
  const siteTypes: any[] = data.site_types ?? [];
  const mapUrl: string | null = property.map_image_url ?? null;

  const allAmenities: string[] = (() => {
    const raw = (s.park_features ?? []) as string[];
    if (raw.length) return raw;
    const agg = new Set<string>();
    siteTypes.forEach((st: any) => (st.featured_amenities ?? []).forEach((a: string) => agg.add(a)));
    return Array.from(agg);
  })();

  const infoRows: { icon: any; label: string; value: string }[] = [];
  if (property.address) infoRows.push({ icon: MapPin, label: "Address", value: property.address });
  if (s.check_in_time || s.check_out_time)
    infoRows.push({
      icon: Clock,
      label: "Check-in / out",
      value: [s.check_in_time && `In ${s.check_in_time}`, s.check_out_time && `Out ${s.check_out_time}`]
        .filter(Boolean)
        .join(" · "),
    });
  if (s.pet_policy) infoRows.push({ icon: ShieldCheck, label: "Pet policy", value: s.pet_policy });
  if (s.cancellation_summary)
    infoRows.push({ icon: ShieldCheck, label: "Cancellation", value: s.cancellation_summary });
  if (s.contact_phone) infoRows.push({ icon: Phone, label: "Phone", value: s.contact_phone });
  if (s.contact_email) infoRows.push({ icon: Mail, label: "Email", value: s.contact_email });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Resort map */}
      {mapUrl && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Resort map</h2>
            <button
              onClick={() => onOpenLightbox(mapUrl)}
              className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--be-emerald))] hover:underline flex items-center gap-1"
            >
              <MapIcon className="h-3 w-3" /> View full
            </button>
          </div>
          <button
            onClick={() => onOpenLightbox(mapUrl)}
            className="block w-full rounded-2xl overflow-hidden border border-border/60 shadow-sm bg-white group"
          >
            <img
              src={mapUrl}
              alt={`${property.name} map`}
              className="w-full h-auto max-h-[420px] object-contain transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </button>
        </section>
      )}

      {/* Accommodations preview */}
      {siteTypes.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Accommodations</h2>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Tap to check availability</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {siteTypes.map((st: any) => (
              <button
                key={st.id}
                onClick={() => onSiteTypeClick(st)}
                className="group text-left bg-card rounded-2xl overflow-hidden border border-border/60 hover:shadow-lg hover:border-[hsl(var(--be-emerald))]/40 transition-all"
              >
                <div className="h-32 w-full bg-muted overflow-hidden">
                  {st.image_url ? (
                    <img
                      src={st.image_url}
                      alt={st.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, hsl(var(--be-cream)), hsl(var(--be-emerald))/0.15)" }}
                    >
                      <TreePine className="h-8 w-8 text-[hsl(var(--be-emerald))]/40" />
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-[hsl(var(--be-emerald))] leading-tight">{st.name}</h3>
                    {st.base_price ? (
                      <div className="text-right shrink-0">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">From</div>
                        <div className="text-sm font-bold text-[hsl(var(--be-emerald))] leading-none">
                          ${Number(st.base_price).toFixed(0)}
                          <span className="text-[10px] font-normal text-muted-foreground">/nt</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {(st.max_adults != null || st.max_children != null) && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> Sleeps {(st.max_adults ?? 0) + (st.max_children ?? 0)}
                    </div>
                  )}
                  {st.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{st.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Amenities grid */}
      {allAmenities.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">Park amenities</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {allAmenities.map((a) => {
              const Icon = amenityIcon(a);
              return (
                <div
                  key={a}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-card border border-border/60"
                >
                  <div className="w-8 h-8 rounded-full bg-[hsl(var(--be-cream))] flex items-center justify-center text-[hsl(var(--be-emerald))] shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide leading-tight">
                    {a}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Key info & policies */}
      {infoRows.length > 0 && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">Good to know</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {infoRows.map((row, i) => {
              const Icon = row.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border/60">
                  <div className="w-8 h-8 rounded-full bg-[hsl(var(--be-emerald))]/10 flex items-center justify-center text-[hsl(var(--be-emerald))] shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {row.label}
                    </div>
                    <div className="text-xs text-foreground/90 mt-0.5 break-words">{row.value}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

