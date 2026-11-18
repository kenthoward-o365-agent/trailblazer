import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, ShieldCheck, ChevronLeft, Tag, Check, Plus, Minus, Sparkles,
  Lock, CalendarDays, Users, Info, CreditCard,
} from "lucide-react";
import { bookingApi } from "@/lib/bookingEngineApi";
import { lookupZip } from "@/lib/zipLookup";
import { AdyenCheckout, Dropin, Card as AdyenCard } from "@adyen/adyen-web";
import "@adyen/adyen-web/styles/adyen.css";
import { supabase } from "@/integrations/supabase/client";

type Ctx = { slug: string; data: any };
type Step = "extras" | "guest" | "payment" | "confirming";

const STEPS: { key: Step; label: string }[] = [
  { key: "extras", label: "Extras" },
  { key: "guest", label: "Your details" },
  { key: "payment", label: "Payment" },
];

function money(n: number, ccy = "USD") {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy }).format(n); }
  catch { return `$${n.toFixed(2)}`; }
}

function formatDate(d: string) {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  } catch { return d; }
}

export default function BookingCheckout() {
  const { slug, data } = useOutletContext<Ctx>();
  const { holdId } = useParams<{ holdId: string }>();
  const navigate = useNavigate();
  const currency = data.property.currency ?? "USD";

  const [hold, setHold] = useState<any>(null);
  const [step, setStep] = useState<Step>("extras");
  const [depositId, setDepositId] = useState<string>("");
  const [addOnQty, setAddOnQty] = useState<Record<string, number>>({});
  const [packageQty, setPackageQty] = useState<Record<string, number>>({});
  const [promoInput, setPromoInput] = useState("");
  const [promoAppliedCode, setPromoAppliedCode] = useState<string | null>(null);
  const [specialRequests, setSpecialRequests] = useState("");
  const [guest, setGuest] = useState({ first_name: "", last_name: "", email: "", phone: "", street_address: "", city: "", state: "", zipcode: "", country: "US" });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [paymentUnavailable, setPaymentUnavailable] = useState(false);
  const dropinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: h } = await supabase.from("booking_holds").select("*").eq("id", holdId!).maybeSingle();
      if (!h) { navigate(`/b/${slug}`); return; }
      setHold(h);
      const def = data.deposit_policies.find((p: any) => p.is_default) ?? data.deposit_policies[0];
      if (def) setDepositId(def.id);
    })();
  }, [holdId]);

  const quoteBody = useMemo(() => ({
    hold_id: holdId,
    deposit_policy_id: depositId || null,
    add_ons: Object.entries(addOnQty).filter(([, q]) => q > 0).map(([id, quantity]) => ({ id, quantity })),
    packages: Object.entries(packageQty).filter(([, q]) => q > 0).map(([id, quantity]) => ({ id, quantity })),
    promo_code: promoAppliedCode,
  }), [holdId, depositId, addOnQty, packageQty, promoAppliedCode]);

  useEffect(() => {
    if (!hold) return;
    setQuoteLoading(true);
    bookingApi.quote(slug, quoteBody).then(setQuote).catch(() => {}).finally(() => setQuoteLoading(false));
  }, [hold, quoteBody, slug]);

  function bumpAddOn(id: string, delta: number) {
    setAddOnQty((p) => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + delta) }));
  }
  function bumpPackage(id: string, delta: number) {
    setPackageQty((p) => ({ ...p, [id]: Math.max(0, (p[id] ?? 0) + delta) }));
  }

  function applyPromo() {
    if (!promoInput.trim()) return;
    setPromoAppliedCode(promoInput.trim());
  }
  function removePromo() { setPromoAppliedCode(null); setPromoInput(""); }

  async function goPayment() {
    if (!guest.email || !guest.first_name) { alert("First name and email required"); return; }
    if (!termsAccepted) { alert("Please accept terms & conditions"); return; }
    setStep("payment");
    try {
      const amount = quote?.deposit?.amount_due_today ?? 0;
      const returnUrl = `${window.location.origin}/b/${slug}/checkout/${holdId}`;
      const session = await bookingApi.adyenSession(slug, {
        hold_id: holdId,
        amount: amount || 0.01,
        currency,
        return_url: returnUrl,
        mode: amount > 0 ? "sale" : "tokenize",
      });
      const checkout = await AdyenCheckout({
        environment: session.environment,
        clientKey: session.clientKey,
        session: { id: session.id, sessionData: session.sessionData },
        onPaymentCompleted: async () => finalize("Authorised"),
        onError: (e: any) => alert(e?.message ?? "Payment error"),
      });
      if (dropinRef.current) new Dropin(checkout, { paymentMethodComponents: [AdyenCard] }).mount(dropinRef.current);
    } catch (e: any) {
      if (String(e.message).includes("adyen_not_configured")) setPaymentUnavailable(true);
      else alert(e.message);
    }
  }

  async function finalize(resultCode: string) {
    setStep("confirming");
    try {
      const { reservation } = await bookingApi.confirm(slug, {
        ...quoteBody, guest, adyen_result_code: resultCode, special_requests: specialRequests,
      });
      navigate(`/b/${slug}/confirmation/${reservation.id}`);
    } catch (e: any) {
      alert(e.message); setStep("payment");
    }
  }

  async function bookWithoutPayment() { await finalize("Skipped"); }

  if (!hold) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-[hsl(var(--be-emerald))]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Preparing your checkout…
      </div>
    );
  }

  const s = data.settings ?? {};
  const addOns = data.add_ons ?? [];
  const packages = data.packages ?? [];
  const stepIdx = STEPS.findIndex((x) => x.key === step);

  return (
    <div
      className="w-full"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--be-canvas)) 0%, hsl(var(--be-cream)) 40%, hsl(var(--be-canvas)) 100%)",
        minHeight: "calc(100vh - 4rem)",
      }}
    >
      {/* Emerald ribbon */}
      <div style={{ background: "hsl(var(--be-emerald))" }} className="text-white">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
          <button
            onClick={() => navigate(`/b/${slug}`)}
            className="inline-flex items-center gap-1 opacity-90 hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4" /> Back to {data.property.name}
          </button>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" style={{ color: "hsl(var(--be-gold))" }} /> Secure checkout</span>
            <span className="hidden sm:inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" style={{ color: "hsl(var(--be-gold))" }} /> PCI DSS via Adyen</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-10">
        {/* Segmented stepper */}
        <div className="mx-auto mb-6 max-w-3xl">
          <div className="flex items-stretch rounded-full border border-[hsl(var(--be-emerald))]/15 bg-white p-1 shadow-sm">
            {STEPS.map((it, i) => {
              const active = i === stepIdx;
              const done = i < stepIdx;
              return (
                <div key={it.key} className="flex-1 flex items-center justify-center">
                  <div
                    className={`w-full flex items-center justify-center gap-2 rounded-full py-2 text-xs md:text-sm font-medium transition-all ${
                      active ? "text-white shadow" : done ? "text-[hsl(var(--be-emerald))]" : "text-slate-400"
                    }`}
                    style={active ? { background: "hsl(var(--be-emerald))" } : {}}
                  >
                    <span
                      className={`h-5 w-5 rounded-full inline-flex items-center justify-center text-[10px] font-semibold ${
                        active ? "bg-white/20" : done ? "bg-[hsl(var(--be-emerald))]/10" : "bg-slate-100"
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="hidden sm:inline">{it.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* MAIN */}
          <div className="space-y-5">
            {step === "extras" && (
              <>
                {packages.length > 0 && (
                  <Panel
                    title="Enhance your stay"
                    subtitle="Curated packages your host recommends"
                    icon={<Sparkles className="h-4 w-4" style={{ color: "hsl(var(--be-gold))" }} />}
                  >
                    <div className="grid gap-3">
                      {packages.map((p: any) => (
                        <ExtraRow
                          key={p.id}
                          name={p.name}
                          description={p.description}
                          price={Number(p.price)}
                          perLabel={p.charge_type === "per_night" ? "night" : "stay"}
                          qty={packageQty[p.id] ?? 0}
                          onInc={() => bumpPackage(p.id, 1)}
                          onDec={() => bumpPackage(p.id, -1)}
                          currency={currency}
                          highlight
                        />
                      ))}
                    </div>
                  </Panel>
                )}

                {addOns.length > 0 && (
                  <Panel title="Add-ons" subtitle="Optional extras for your stay">
                    <div className="grid gap-3">
                      {addOns.map((a: any) => (
                        <ExtraRow
                          key={a.id}
                          name={a.name}
                          description={a.description}
                          price={Number(a.price)}
                          perLabel={a.charge_type === "per_night" ? "night" : "stay"}
                          qty={addOnQty[a.id] ?? 0}
                          onInc={() => bumpAddOn(a.id, 1)}
                          onDec={() => bumpAddOn(a.id, -1)}
                          currency={currency}
                        />
                      ))}
                    </div>
                  </Panel>
                )}

                <Panel
                  title="Promo code"
                  icon={<Tag className="h-4 w-4" style={{ color: "hsl(var(--be-gold))" }} />}
                >
                  {promoAppliedCode && !quote?.promo_error ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-50 p-3">
                      <div className="flex items-center gap-2 text-sm text-emerald-800">
                        <Check className="h-4 w-4 text-emerald-600" />
                        <span><strong>{promoAppliedCode}</strong> applied — save {money(quote?.promo_discount ?? 0, currency)}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={removePromo}>Remove</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        className="uppercase tracking-wide"
                      />
                      <Button onClick={applyPromo} variant="outline" className="border-[hsl(var(--be-emerald))]/30 text-[hsl(var(--be-emerald))]">Apply</Button>
                    </div>
                  )}
                  {quote?.promo_error && <p className="text-sm text-destructive mt-2">{quote.promo_error}</p>}
                </Panel>

                <div className="flex justify-end">
                  <BrandButton onClick={() => setStep("guest")}>Continue to your details</BrandButton>
                </div>
              </>
            )}

            {step === "guest" && (
              <>
                <button onClick={() => setStep("extras")} className="text-sm text-[hsl(var(--be-emerald))] inline-flex items-center gap-1 hover:underline">
                  <ChevronLeft className="h-4 w-4" /> Back to extras
                </button>

                <Panel title="Guest information" subtitle="Who's the reservation for?">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field label="First name *"><Input value={guest.first_name} onChange={(e) => setGuest({ ...guest, first_name: e.target.value })} /></Field>
                    <Field label="Last name"><Input value={guest.last_name} onChange={(e) => setGuest({ ...guest, last_name: e.target.value })} /></Field>
                    <Field label="Email *"><Input type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} /></Field>
                    <Field label="Phone"><Input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} /></Field>
                    <div className="md:col-span-2">
                      <Field label="Street address"><Input value={guest.street_address} onChange={(e) => setGuest({ ...guest, street_address: e.target.value })} /></Field>
                    </div>
                    <Field label="Zip / Postal code">
                      <Input
                        value={guest.zipcode}
                        onChange={(e) => setGuest({ ...guest, zipcode: e.target.value })}
                        onBlur={async (e) => {
                          const zip = e.target.value.trim();
                          if (!zip) return;
                          const hit = await lookupZip(zip, guest.country || "US");
                          if (hit) {
                            setGuest((prev) => ({
                              ...prev,
                              city: prev.city || hit.city,
                              state: prev.state || hit.state,
                            }));
                          }
                        }}
                      />
                    </Field>
                    <Field label="City"><Input value={guest.city} onChange={(e) => setGuest({ ...guest, city: e.target.value })} /></Field>
                    <Field label="State / Region"><Input value={guest.state} onChange={(e) => setGuest({ ...guest, state: e.target.value })} /></Field>
                    <Field label="Country"><Input value={guest.country} onChange={(e) => setGuest({ ...guest, country: e.target.value.toUpperCase() })} maxLength={2} placeholder="US" /></Field>
                    <div className="md:col-span-2">
                      <Field label="Special requests">
                        <Textarea rows={3} value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Site preferences, arrival time, anything else the property should know…" />
                      </Field>
                    </div>
                  </div>
                </Panel>

                {data.deposit_policies.length > 1 && (
                  <Panel title="Deposit policy" subtitle="Choose how you'd like to secure your booking">
                    <div className="grid gap-2">
                      {data.deposit_policies.map((p: any) => {
                        const sel = depositId === p.id;
                        return (
                          <label
                            key={p.id}
                            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                              sel ? "border-[hsl(var(--be-emerald))] bg-[hsl(var(--be-emerald))]/5 shadow-sm" : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <input type="radio" checked={sel} onChange={() => setDepositId(p.id)} className="mt-1 accent-[hsl(var(--be-emerald))]" />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{p.name}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{p.description ?? `${p.payment_mode} — ${p.deposit_type} ${p.deposit_value}`}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </Panel>
                )}

                {(s.cancellation_summary || s.terms_and_conditions) && (
                  <Panel title="Policies">
                    <div className="space-y-3 text-sm">
                      {s.cancellation_summary && (
                        <div>
                          <div className="font-semibold text-[hsl(var(--be-emerald))] mb-1 text-xs uppercase tracking-wider">Cancellation</div>
                          <p className="text-slate-600 whitespace-pre-wrap">{s.cancellation_summary}</p>
                        </div>
                      )}
                      {s.terms_and_conditions && (
                        <details className="text-slate-600">
                          <summary className="cursor-pointer font-semibold text-[hsl(var(--be-emerald))] text-xs uppercase tracking-wider">Terms & conditions</summary>
                          <p className="mt-2 whitespace-pre-wrap">{s.terms_and_conditions}</p>
                        </details>
                      )}
                      <label className="flex items-center gap-2 pt-2 border-t">
                        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="accent-[hsl(var(--be-emerald))]" />
                        <span className="text-sm">I agree to the terms &amp; cancellation policy.</span>
                      </label>
                    </div>
                  </Panel>
                )}

                <div className="flex justify-end">
                  <BrandButton onClick={goPayment} disabled={!termsAccepted && !!(s.cancellation_summary || s.terms_and_conditions)}>
                    Continue to payment
                  </BrandButton>
                </div>
              </>
            )}

            {step === "payment" && (
              <>
                <button onClick={() => setStep("guest")} className="text-sm text-[hsl(var(--be-emerald))] inline-flex items-center gap-1 hover:underline">
                  <ChevronLeft className="h-4 w-4" /> Back to details
                </button>

                <Panel
                  title="Payment"
                  subtitle="Encrypted end-to-end. We never see your card."
                  icon={<CreditCard className="h-4 w-4" style={{ color: "hsl(var(--be-gold))" }} />}
                >
                  {paymentUnavailable ? (
                    <div className="space-y-3">
                      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex gap-2">
                        <Info className="h-4 w-4 mt-0.5" />
                        <div>Online payment is not enabled for this property yet. You can still request the booking and the property will contact you to confirm.</div>
                      </div>
                      <BrandButton onClick={bookWithoutPayment}>Request booking</BrandButton>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div ref={dropinRef} />
                    </div>
                  )}
                </Panel>

                <TrustRow />
              </>
            )}

            {step === "confirming" && (
              <div className="rounded-2xl border bg-white p-8 flex flex-col items-center gap-3 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--be-emerald))]" />
                <div className="font-semibold text-[hsl(var(--be-emerald))]">Finalizing your booking…</div>
                <div className="text-xs text-slate-500">Please don't close this window.</div>
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div>
            <div className="sticky top-6 space-y-4">
              <div className="rounded-2xl border border-[hsl(var(--be-emerald))]/15 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b bg-[hsl(var(--be-cream))]/40">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[hsl(var(--be-emerald))]/70 font-semibold">Order summary</div>
                  <div className="mt-0.5 text-base font-bold text-[hsl(var(--be-emerald))]">{data.property.name}</div>
                </div>

                {(() => {
                  const st = (data.site_types ?? []).find((t: any) => t.id === hold.site_type_id);
                  if (!st) return null;
                  return (
                    <div className="px-5 pt-4 flex items-center gap-3">
                      <div className="h-16 w-20 shrink-0 rounded-lg overflow-hidden bg-[hsl(var(--be-cream))] border border-[hsl(var(--be-emerald))]/15">
                        {st.image_url ? (
                          <img src={st.image_url} alt={st.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[hsl(var(--be-emerald))]/40 text-[10px] font-semibold">No photo</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-[hsl(var(--be-gold))] uppercase tracking-widest">Your site</div>
                        <div className="text-sm font-bold text-[hsl(var(--be-emerald))] truncate">{st.name}</div>
                        {st.max_adults != null && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Users className="h-3 w-3" /> Sleeps {st.max_adults + (st.max_children ?? 0)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="px-5 py-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Stat icon={<CalendarDays className="h-3.5 w-3.5" />} label="Arrive" value={formatDate(hold.check_in)} />
                    <Stat icon={<CalendarDays className="h-3.5 w-3.5" />} label="Depart" value={formatDate(hold.check_out)} />
                    <Stat icon={<Info className="h-3.5 w-3.5" />} label="Nights" value={String(quote?.nights ?? "—")} />
                    <Stat icon={<Users className="h-3.5 w-3.5" />} label="Guests" value={String(hold.guests)} />
                  </div>

                  <div className="border-t pt-3 space-y-1.5">
                    {quoteLoading && !quote && (
                      <div className="flex items-center justify-center py-3 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    )}

                    {quote && (
                      <>
                        <Line label={`Site (${money(quote.per_night, currency)} × ${quote.nights})`} value={money(quote.room_subtotal, currency)} />
                        {quote.los_discount > 0 && (
                          <Line label="LOS discount" value={`- ${money(quote.los_discount, currency)}`} accent="emerald" />
                        )}
                        {quote.package_lines.map((l: any) => (
                          <Line key={l.id} label={`${l.name} × ${l.quantity}`} value={money(l.total, currency)} />
                        ))}
                        {quote.add_on_lines.map((l: any) => (
                          <Line key={l.id} label={`${l.name} × ${l.quantity}`} value={money(l.total, currency)} />
                        ))}
                        {quote.taxes_total > 0 && (
                          <Line label="Taxes & fees" value={money(quote.taxes_total, currency)} muted />
                        )}
                        {quote.promo_applied && (
                          <Line label={quote.promo_applied.code} value={`- ${money(quote.promo_discount, currency)}`} accent="emerald" />
                        )}

                        <div className="border-t border-dashed pt-3 mt-2 flex items-baseline justify-between">
                          <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Total</span>
                          <span className="text-xl font-extrabold text-[hsl(var(--be-emerald))]">{money(quote.total, currency)}</span>
                        </div>

                        {quote.deposit && (
                          <div
                            className="rounded-xl p-3 mt-3 border"
                            style={{
                              background: "hsl(var(--be-emerald) / 0.06)",
                              borderColor: "hsl(var(--be-emerald) / 0.25)",
                            }}
                          >
                            <div className="flex items-baseline justify-between">
                              <span className="text-xs font-semibold text-[hsl(var(--be-emerald))]">Due today</span>
                              <span className="text-lg font-bold text-[hsl(var(--be-emerald))]">
                                {money(quote.deposit.amount_due_today, currency)}
                              </span>
                            </div>
                            {quote.deposit.balance_due > 0 && (
                              <div className="flex items-baseline justify-between text-[11px] text-slate-600 mt-1">
                                <span>Balance at check-in</span>
                                <span>{money(quote.deposit.balance_due, currency)}</span>
                              </div>
                            )}
                            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--be-emerald))] border border-[hsl(var(--be-emerald))]/20">
                              {quote.deposit.name}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <TrustRow compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ————— UI primitives ————— */

function Panel({
  title, subtitle, icon, children,
}: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <header className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-base font-semibold text-[hsl(var(--be-emerald))]">{title}</h3>
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function BrandButton({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <Button
      size="lg"
      onClick={onClick}
      disabled={disabled}
      className="text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
      style={{ background: "hsl(var(--be-emerald))" }}
    >
      {children}
    </Button>
  );
}

function ExtraRow({
  name, description, price, perLabel, qty, onInc, onDec, currency, highlight,
}: {
  name: string; description?: string; price: number; perLabel: string;
  qty: number; onInc: () => void; onDec: () => void; currency: string; highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border p-3 transition-all ${
        qty > 0
          ? "border-[hsl(var(--be-emerald))] bg-[hsl(var(--be-emerald))]/5 shadow-sm"
          : highlight
          ? "border-[hsl(var(--be-gold))]/40 bg-[hsl(var(--be-gold))]/5"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium">{name}</div>
        {description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{description}</div>}
        <div className="text-sm mt-1 font-semibold text-[hsl(var(--be-emerald))]">
          {money(price, currency)} <span className="text-xs text-slate-500 font-normal">/ {perLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="outline" onClick={onDec} disabled={!qty} className="h-8 w-8 rounded-full">
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-6 text-center font-semibold">{qty}</span>
        <Button
          size="icon"
          variant="outline"
          onClick={onInc}
          className="h-8 w-8 rounded-full border-[hsl(var(--be-emerald))]/40 text-[hsl(var(--be-emerald))] hover:bg-[hsl(var(--be-emerald))]/10"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50/70 border border-slate-100 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
        {icon} {label}
      </div>
      <div className="text-sm font-semibold text-[hsl(var(--be-emerald))] mt-0.5">{value}</div>
    </div>
  );
}

function Line({ label, value, accent, muted }: { label: string; value: string; accent?: "emerald"; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${accent === "emerald" ? "text-emerald-700 font-medium" : muted ? "text-slate-500" : "text-slate-700"}`}>
      <span className="truncate pr-2">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function TrustRow({ compact }: { compact?: boolean }) {
  const items = [
    { icon: <Lock className="h-3.5 w-3.5" />, label: "256-bit TLS" },
    { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "PCI DSS SAQ A" },
    { icon: <CreditCard className="h-3.5 w-3.5" />, label: "Adyen secure" },
  ];
  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      <div className="flex items-center justify-around gap-2 text-[11px] text-slate-500">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5">
            <span style={{ color: "hsl(var(--be-emerald))" }}>{it.icon}</span>
            <span className="font-medium">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
