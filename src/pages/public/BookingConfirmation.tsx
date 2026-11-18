import { useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2, Loader2, Calendar, Users, MapPin, Mail, Copy, Sparkles, Printer, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

type Ctx = { slug: string; data: any };

function formatDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  } catch { return d; }
}

function money(n: number, ccy = "USD") {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy }).format(n); }
  catch { return `$${n.toFixed(2)}`; }
}

export default function BookingConfirmation() {
  const { slug, data } = useOutletContext<Ctx>();
  const { reservationId } = useParams<{ reservationId: string }>();
  const [res, setRes] = useState<any>(null);
  const currency = data.property.currency ?? "USD";

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase
        .from("reservations")
        .select("confirmation_number, check_in_date, check_out_date, total_price, guests_count, site_id, site_type_id, guests(first_name, last_name, email)")
        .eq("id", reservationId!)
        .maybeSingle();
      setRes(r);
    })();
  }, [reservationId]);

  if (!res) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-[hsl(var(--be-emerald))]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your confirmation…
      </div>
    );
  }

  function ics() {
    const dt = (d: string) => d.replace(/-/g, "");
    const uid = `${res.confirmation_number}@trailblazer`;
    const content = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Trailblazer//Booking//EN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dt(new Date().toISOString().split("T")[0])}T000000Z
DTSTART;VALUE=DATE:${dt(res.check_in_date)}
DTEND;VALUE=DATE:${dt(res.check_out_date)}
SUMMARY:Stay at ${data.property.name}
DESCRIPTION:Confirmation ${res.confirmation_number}
END:VEVENT
END:VCALENDAR`;
    const blob = new Blob([content], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${res.confirmation_number}.ics`; a.click();
    URL.revokeObjectURL(url);
  }

  const s = data.settings ?? {};

  return (
    <div
      className="w-full"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--be-canvas)) 0%, hsl(var(--be-cream)) 50%, hsl(var(--be-canvas)) 100%)",
        minHeight: "calc(100vh - 4rem)",
      }}
    >
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          {/* Hero */}
          <div
            className="relative rounded-3xl overflow-hidden shadow-xl border"
            style={{ borderColor: "hsl(var(--be-emerald) / 0.2)" }}
          >
            <div
              className="p-8 md:p-10 text-white text-center relative"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--be-emerald)) 0%, hsl(var(--be-emerald) / 0.85) 100%)",
              }}
            >
              {/* Gold sparkle accents */}
              <Sparkles
                className="absolute top-4 left-6 h-4 w-4 opacity-60"
                style={{ color: "hsl(var(--be-gold))" }}
              />
              <Sparkles
                className="absolute bottom-4 right-6 h-3 w-3 opacity-40"
                style={{ color: "hsl(var(--be-gold))" }}
              />

              <div
                className="mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center"
                style={{ background: "hsl(var(--be-gold) / 0.25)", border: "2px solid hsl(var(--be-gold))" }}
              >
                <CheckCircle2 className="h-9 w-9" style={{ color: "hsl(var(--be-gold))" }} />
              </div>

              <div className="text-[11px] uppercase tracking-[0.2em] font-semibold opacity-80" style={{ color: "hsl(var(--be-gold))" }}>
                Reservation confirmed
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold mt-2">You're all set, {res.guests?.first_name ?? "camper"}!</h1>
              <p className="opacity-90 mt-2">See you at {data.property.name}</p>

              <div className="mt-6 inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-4 py-2 text-sm">
                <span className="opacity-80 text-xs uppercase tracking-wider">Confirmation</span>
                <span className="font-mono font-bold text-base tracking-wider">#{res.confirmation_number}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(res.confirmation_number);
                    toast.success("Confirmation number copied");
                  }}
                  className="ml-1 opacity-70 hover:opacity-100"
                  aria-label="Copy confirmation number"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Trip card */}
            <div className="bg-white p-6 md:p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TripStat
                  icon={<Calendar className="h-4 w-4" />}
                  label="Check-in"
                  value={formatDate(res.check_in_date)}
                  sub="From 3:00 PM"
                />
                <TripStat
                  icon={<Calendar className="h-4 w-4" />}
                  label="Check-out"
                  value={formatDate(res.check_out_date)}
                  sub="Until 11:00 AM"
                />
                <TripStat
                  icon={<Users className="h-4 w-4" />}
                  label="Guests"
                  value={String(res.guests_count)}
                />
                <TripStat
                  icon={<MapPin className="h-4 w-4" />}
                  label="Total"
                  value={money(Number(res.total_price), currency)}
                  emphasis
                />
              </div>

              {res.guests?.email && (
                <div
                  className="rounded-xl p-4 text-sm flex items-start gap-3 border"
                  style={{
                    background: "hsl(var(--be-cream) / 0.6)",
                    borderColor: "hsl(var(--be-gold) / 0.35)",
                  }}
                >
                  <Mail className="h-4 w-4 mt-0.5" style={{ color: "hsl(var(--be-emerald))" }} />
                  <div>
                    Confirmation & receipt sent to <strong>{res.guests.email}</strong>.
                    Check your inbox in the next few minutes.
                  </div>
                </div>
              )}

              {s.confirmation_message && (
                <div
                  className="rounded-xl border-l-4 p-4 whitespace-pre-wrap text-sm text-slate-700"
                  style={{
                    borderColor: "hsl(var(--be-gold))",
                    background: "hsl(var(--be-cream) / 0.4)",
                  }}
                >
                  {s.confirmation_message}
                </div>
              )}

              {/* Next steps */}
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[hsl(var(--be-emerald))] mb-3">
                  What's next
                </div>
                <ul className="space-y-2 text-sm">
                  <NextStep n={1} title="Save your dates" desc="Add the trip to your calendar so you don't forget." />
                  <NextStep n={2} title="Watch your email" desc="Pre-arrival details and site info are on the way." />
                  <NextStep n={3} title="Manage anytime" desc="Modify or cancel from your booking portal." />
                </ul>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button
                  onClick={ics}
                  variant="outline"
                  className="border-[hsl(var(--be-emerald))]/30 text-[hsl(var(--be-emerald))]"
                >
                  <Calendar className="h-4 w-4 mr-2" /> Add to calendar
                </Button>
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  className="border-[hsl(var(--be-emerald))]/30 text-[hsl(var(--be-emerald))]"
                >
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-[hsl(var(--be-emerald))]/30 text-[hsl(var(--be-emerald))]"
                >
                  <Link to={`/b/${slug}/manage`}>Manage booking</Link>
                </Button>
                <Button
                  asChild
                  className="ml-auto text-white font-semibold shadow-md"
                  style={{ background: "hsl(var(--be-emerald))" }}
                >
                  <Link to={`/b/${slug}`}>
                    Back to {data.property.name}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-500 mt-6">
            Powered by <span className="font-semibold text-[hsl(var(--be-emerald))]">Trailblazer PMS</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TripStat({
  icon, label, value, sub, emphasis,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; emphasis?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        <span style={{ color: "hsl(var(--be-emerald))" }}>{icon}</span> {label}
      </div>
      <div className={`mt-1 font-bold ${emphasis ? "text-lg text-[hsl(var(--be-emerald))]" : "text-sm text-slate-800"}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function NextStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold"
        style={{
          background: "hsl(var(--be-emerald) / 0.1)",
          color: "hsl(var(--be-emerald))",
          border: "1px solid hsl(var(--be-emerald) / 0.2)",
        }}
      >
        {n}
      </span>
      <div>
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
    </li>
  );
}
