import { useEffect, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, ChevronRight, ClipboardCheck, ShieldCheck, PenLine, User, CreditCard, FileText, AlertCircle } from "lucide-react";
import { bookingApi } from "@/lib/bookingEngineApi";
import { getGuestSession, clearGuestSession } from "@/lib/guestSession";
import { SignaturePad, type SignaturePadRef } from "@/components/SignaturePad";
import { AdyenCheckout, Dropin, Card as AdyenCard } from "@adyen/adyen-web";
import "@adyen/adyen-web/styles/adyen.css";

type Ctx = { slug: string; data: any };
type Step = "details" | "registration" | "payment" | "signature" | "review";

const STEPS: { id: Step; label: string; icon: any }[] = [
  { id: "details", label: "Your details", icon: User },
  { id: "registration", label: "Registration card", icon: FileText },
  { id: "payment", label: "Card on file", icon: CreditCard },
  { id: "signature", label: "Sign", icon: PenLine },
  { id: "review", label: "Confirm", icon: ClipboardCheck },
];

export default function OnlineCheckIn() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useOutletContext<Ctx>();
  const navigate = useNavigate();
  const primary = data.settings?.primary_color ?? "hsl(var(--primary))";

  const [session] = useState(() => getGuestSession(slug!));
  const [state, setState] = useState<{ reservation: any; property: any; has_active_auth: boolean } | null>(null);
  const [step, setStep] = useState<Step>("details");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [complete, setComplete] = useState<{ status: string; hold_reason: string | null } | null>(null);

  // Form data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [specialRequests, setSpecialRequests] = useState("");
  const [paymentDone, setPaymentDone] = useState(false);
  const [signaturePresent, setSignaturePresent] = useState(false);
  const sigRef = useRef<SignaturePadRef>(null);

  useEffect(() => {
    if (!session) {
      navigate(`/b/${slug}/login`, { replace: true });
      return;
    }
    bookingApi.checkinPrefetch(slug!, session.token).then((r) => {
      setState(r);
      const g = r.reservation.guests;
      setFirstName(g?.first_name ?? "");
      setLastName(g?.last_name ?? "");
      setEmail(g?.email ?? "");
      setPhone(g?.phone ?? "");
      setStreet(g?.street_address ?? "");
      setCity(g?.city ?? "");
      setStateVal(g?.state ?? "");
      setZipcode(g?.zipcode ?? "");
      setAdults(r.reservation.adults_count ?? 1);
      setChildren(r.reservation.children_count ?? 0);
      setSpecialRequests(r.reservation.special_requests ?? "");
      setPaymentDone(r.has_active_auth === true);
    }).catch((e) => {
      if (String(e.message).includes("session_expired") || String(e.message).includes("unauthorized")) {
        clearGuestSession(slug!);
        navigate(`/b/${slug}/login`, { replace: true });
      } else setErr(e.message);
    });
  }, [slug, session, navigate]);

  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const goNext = () => setStep(STEPS[stepIdx + 1]?.id ?? "review");
  const goBack = () => setStep(STEPS[stepIdx - 1]?.id ?? "details");

  async function saveDetails() {
    if (!session) return;
    setSaving(true); setErr(null);
    try {
      await bookingApi.checkinUpdateGuest(slug!, session.token, {
        guest: { first_name: firstName, last_name: lastName, email, phone, street_address: street, city, state: stateVal, zipcode },
        adults_count: adults, children_count: children, special_requests: specialRequests,
      });
      goNext();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function uploadSignatureAndAdvance() {
    if (!session) return;
    const dataUrl = sigRef.current?.toDataURL();
    if (!dataUrl) { setErr("Please sign the registration card first."); return; }
    setSaving(true); setErr(null);
    try {
      await bookingApi.checkinUploadSignature(slug!, session.token, dataUrl, `${firstName} ${lastName}`.trim());
      goNext();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function completeCheckin() {
    if (!session) return;
    setSaving(true); setErr(null);
    try {
      const r = await bookingApi.checkinComplete(slug!, session.token);
      setComplete({ status: r.status, hold_reason: r.hold_reason });
    } catch (e: any) { setErr(e.message?.includes("signature_required")
      ? "Please capture your signature before completing check-in."
      : e.message);
    } finally { setSaving(false); }
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your check-in…
      </div>
    );
  }

  if (complete) {
    const isHold = complete.status === "CHECK_IN_HOLD";
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold">
              {isHold ? "You're checked in — with hold" : "You're all checked in!"}
            </h2>
            {isHold ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Your site isn't ready yet. You can charge purchases to your folio and use park facilities. Front desk will notify you when your site is ready.</p>
                <p className="text-xs">Reason: {complete.hold_reason?.replace(/_/g, " ")}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Welcome! Head to site {state.reservation.sites?.site_number ?? ""} whenever you're ready.
              </p>
            )}
            <Button className="w-full h-11" onClick={() => navigate(`/b/${slug}/my-trip`)} style={{ background: primary, color: "white" }}>
              Back to my trip
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      {/* Progress */}
      <div className="flex items-center justify-between gap-1 text-xs">
        {STEPS.map((s, i) => (
          <div key={s.id} className={`flex-1 flex flex-col items-center gap-1 ${i <= stepIdx ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`h-7 w-7 rounded-full flex items-center justify-center border-2 ${i <= stepIdx ? "border-primary bg-primary/10" : "border-muted"}`}>
              {i < stepIdx ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
            </div>
            <span className="hidden sm:inline truncate">{s.label}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{STEPS[stepIdx].label}</CardTitle>
            <Badge variant="outline">#{state.reservation.confirmation_number}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "details" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="First name" value={firstName} onChange={setFirstName} />
              <Field label="Last name" value={lastName} onChange={setLastName} />
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
              <div className="sm:col-span-2"><Field label="Street address" value={street} onChange={setStreet} /></div>
              <Field label="City" value={city} onChange={setCity} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="State" value={stateVal} onChange={setStateVal} />
                <Field label="ZIP" value={zipcode} onChange={setZipcode} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <NumberField label="Adults" value={adults} onChange={setAdults} min={1} />
                <NumberField label="Children" value={children} onChange={setChildren} min={0} />
              </div>
              <div className="sm:col-span-2">
                <Label>Special requests</Label>
                <Textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} rows={2} className="mt-1" />
              </div>
            </div>
          )}

          {step === "registration" && (
            <RegistrationCardView reservation={state.reservation} property={state.property} guest={{ firstName, lastName, email, phone, street, city, stateVal, zipcode }} />
          )}

          {step === "payment" && (
            <GuestPaymentStep
              slug={slug!}
              token={session!.token}
              amount={estimateAuthAmount(state.reservation)}
              alreadyAuthorized={paymentDone}
              onComplete={() => { setPaymentDone(true); }}
              onError={(m) => setErr(m)}
            />
          )}

          {step === "signature" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                By signing below, you acknowledge you've reviewed the registration card and agree to the property's terms, including responsibility for charges to your folio.
              </p>
              <SignaturePad ref={sigRef} height={200} onChange={(empty) => setSignaturePresent(!empty)} />
            </div>
          )}

          {step === "review" && (
            <div className="space-y-3">
              <Row label="Guest" value={`${firstName} ${lastName}`} />
              <Row label="Party" value={`${adults} adult${adults === 1 ? "" : "s"}${children ? `, ${children} children` : ""}`} />
              <Row label="Arrive" value={state.reservation.check_in_date} />
              <Row label="Depart" value={state.reservation.check_out_date} />
              <Row label="Site" value={state.reservation.sites?.site_number ?? "To be assigned"} />
              <Row label="Card on file" value={paymentDone ? "✓ Authorized" : "— Skipped"} />
              <Row label="Signature" value={signaturePresent ? "✓ Captured" : "Not signed"} />
              <div className="rounded-md bg-muted p-3 text-xs flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5" />
                <p>If your site isn't ready yet you'll be checked in with hold — you can charge to your folio and use facilities until your site is available.</p>
              </div>
            </div>
          )}

          {err && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" /> {err}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky bottom nav */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur p-3 flex gap-2">
        <div className="max-w-2xl mx-auto flex gap-2 w-full">
          {stepIdx > 0 && (
            <Button variant="ghost" onClick={goBack} disabled={saving} className="h-11">
              Back
            </Button>
          )}
          <div className="flex-1" />
          {step === "details" && (
            <Button onClick={saveDetails} disabled={saving} className="h-11 min-w-32" style={{ background: primary, color: "white" }}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save & continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === "registration" && (
            <Button onClick={goNext} className="h-11 min-w-32" style={{ background: primary, color: "white" }}>
              I've reviewed <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === "payment" && (
            <Button onClick={goNext} className="h-11 min-w-32" style={{ background: primary, color: "white" }}>
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === "signature" && (
            <Button onClick={uploadSignatureAndAdvance} disabled={saving || !signaturePresent} className="h-11 min-w-32" style={{ background: primary, color: "white" }}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === "review" && (
            <Button onClick={completeCheckin} disabled={saving} className="h-11 min-w-32" style={{ background: primary, color: "white" }}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Complete check-in
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function estimateAuthAmount(r: any): number {
  // Default incidental hold = $100, or total price / nights if smaller
  const total = Number(r.total_price ?? 0);
  return Math.max(100, Math.round(total * 0.25));
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 mt-1" />
    </div>
  );
}
function NumberField({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" value={value} min={min} onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))} className="h-11 mt-1" />
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/60 pb-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function RegistrationCardView({ reservation, property, guest }: { reservation: any; property: any; guest: any }) {
  return (
    <div className="rounded-md border p-4 space-y-3 text-sm max-h-[60vh] overflow-y-auto bg-card">
      <div className="text-center">
        <div className="font-bold text-base">{property?.name}</div>
        <div className="text-xs text-muted-foreground">Registration Card</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><div className="text-xs text-muted-foreground">Confirmation</div><div className="font-medium">#{reservation.confirmation_number}</div></div>
        <div><div className="text-xs text-muted-foreground">Site</div><div className="font-medium">{reservation.sites?.site_number ?? "TBD"}</div></div>
        <div><div className="text-xs text-muted-foreground">Arrive</div><div className="font-medium">{reservation.check_in_date}</div></div>
        <div><div className="text-xs text-muted-foreground">Depart</div><div className="font-medium">{reservation.check_out_date}</div></div>
      </div>
      <div className="border-t pt-3">
        <div className="text-xs text-muted-foreground mb-1">Guest</div>
        <div className="font-medium">{guest.firstName} {guest.lastName}</div>
        <div className="text-xs">{guest.email} · {guest.phone}</div>
        <div className="text-xs">{guest.street}, {guest.city} {guest.stateVal} {guest.zipcode}</div>
      </div>
      <div className="border-t pt-3 text-xs text-muted-foreground space-y-2">
        <p><strong>Terms:</strong> Registered guest is responsible for all charges posted to the folio during the stay, including damages and additional guest charges. Quiet hours, pet, and property rules apply as posted.</p>
        <p><strong>Payment authorization:</strong> The card on file may be authorized for the estimated stay and incidentals, and charged for the folio balance at checkout.</p>
        <p><strong>Cancellation:</strong> {property?.cancellation_summary ?? "Per property policy."}</p>
      </div>
    </div>
  );
}

// ---- Adyen Drop-in for guest online check-in ----
function GuestPaymentStep({
  slug, token, amount, alreadyAuthorized, onComplete, onError,
}: {
  slug: string; token: string; amount: number; alreadyAuthorized: boolean;
  onComplete: () => void; onError: (m: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "done" | "error" | "unavailable">(alreadyAuthorized ? "done" : "loading");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (alreadyAuthorized) return;
    let disposed = false;
    let dropin: Dropin | null = null;

    (async () => {
      try {
        const session = await bookingApi.checkinAdyenSession(slug, token, {
          amount, currency: "USD", return_url: window.location.href,
        });
        if (disposed) return;
        if (session.error === "adyen_not_configured") { setStatus("unavailable"); return; }
        if (!session.id || !session.clientKey) { setStatus("error"); setMsg("Payment temporarily unavailable"); return; }

        const checkout = await AdyenCheckout({
          environment: session.environment ?? "test",
          clientKey: session.clientKey,
          session: { id: session.id, sessionData: session.sessionData },
          onPaymentCompleted: (r: any) => {
            if (r.resultCode === "Authorised") { setStatus("done"); onComplete(); }
            else { setStatus("error"); setMsg(`Payment ${r.resultCode}`); }
          },
          onError: (e: any) => { setStatus("error"); setMsg(e?.message ?? "Payment error"); onError(e?.message ?? "Payment error"); },
        });

        if (disposed || !containerRef.current) return;
        dropin = new Dropin(checkout, { paymentMethodComponents: [AdyenCard] }).mount(containerRef.current);
        setStatus("ready");
      } catch (e: any) {
        setStatus("error"); setMsg(e.message ?? "Payment error"); onError(e.message ?? "Payment error");
      }
    })();

    return () => { disposed = true; try { dropin?.unmount(); } catch { /* noop */ } };
  }, [slug, token, amount, alreadyAuthorized]);

  if (alreadyAuthorized || status === "done") {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm flex items-start gap-2">
        <Check className="h-5 w-5 text-emerald-600 mt-0.5" />
        <div>
          <div className="font-medium">Card on file authorized</div>
          <div className="text-muted-foreground text-xs mt-0.5">
            We placed a hold of about ${amount.toFixed(2)} for incidentals. Final folio balance is charged at checkout.
          </div>
        </div>
      </div>
    );
  }
  if (status === "unavailable") {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <div className="font-medium">Card capture not available online</div>
        <div className="text-muted-foreground mt-1">You can continue — the front desk will collect a card when you arrive. Your folio access still works.</div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        We'll authorize about <strong>${amount.toFixed(2)}</strong> to your card as an incidentals hold. Actual charges are settled at checkout.
      </p>
      {status === "loading" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading secure card form…
        </div>
      )}
      {status === "error" && <div className="text-sm text-destructive">{msg}</div>}
      <div ref={containerRef} />
    </div>
  );
}
