import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight, ArrowLeft, PartyPopper, Loader2, MapPin, Building2, DollarSign, CreditCard, Globe, Sparkles } from "lucide-react";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import trailblazerLogo from "@/assets/trailblazer-dark.png";

const STEPS = [
  { key: "welcome", title: "Property Basics", icon: Building2, help: "Tell us about your campground so we can set up reports, taxes, and time-zone aware audit dates correctly." },
  { key: "sites", title: "Site Inventory", icon: MapPin, help: "Add your site types (RV, tent, cabin) and how many of each. You can rearrange them on the campground map later." },
  { key: "rates", title: "Rates", icon: DollarSign, help: "Set your default nightly rate. You can add seasonal rates, weekly/monthly rates, and package deals from Settings anytime." },
  { key: "payments", title: "Payments", icon: CreditCard, help: "Connect Adyen so you can capture card guarantees and take payments. Skip if you're not ready — you can always come back." },
  { key: "booking", title: "Booking Engine", icon: Globe, help: "Turn on your public booking page. Our AI can even match your existing website's colors and fonts automatically." },
  { key: "go-live", title: "Go Live", icon: PartyPopper, help: "One final review — then you're open for business." },
] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const { needsOnboarding, propertyId, loading } = useOnboardingStatus();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [property, setProperty] = useState<any>(null);

  // Step 1 form
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [phone, setPhone] = useState("");

  // Step 2 form
  const [siteTypeName, setSiteTypeName] = useState("Standard RV");
  const [siteCount, setSiteCount] = useState(20);
  const [numberingPrefix, setNumberingPrefix] = useState("");

  // Step 3
  const [rateName, setRateName] = useState("Standard Nightly");
  const [rateAmount, setRateAmount] = useState(65);

  // Step 5
  const [publicSlug, setPublicSlug] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    if (!loading && !needsOnboarding && propertyId === null) {
      // User has no org-admin property. Send home.
      navigate("/", { replace: true });
    }
  }, [loading, needsOnboarding, propertyId, navigate]);

  useEffect(() => {
    (async () => {
      if (!propertyId) return;
      const { data } = await supabase.from("properties").select("*").eq("id", propertyId).maybeSingle();
      if (data) {
        setProperty(data);
        setName(data.name || "");
        setAddress(data.address || "");
        setTimezone(data.timezone || "America/Los_Angeles");
        setPhone(data.phone1 || "");
        setStep(Math.max(0, Math.min(STEPS.length - 1, data.setup_step ?? 0)));
      }
    })();
  }, [propertyId]);

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  const persistStep = async (nextStep: number, extra: Record<string, any> = {}) => {
    if (!propertyId) return;
    await supabase.from("properties").update({ setup_step: nextStep, ...extra }).eq("id", propertyId);
  };

  const goNext = async () => {
    if (!propertyId) return;
    setBusy(true);
    try {
      const s = STEPS[step].key;

      if (s === "welcome") {
        if (!name.trim()) return toast.error("Property name is required");
        await supabase.from("properties").update({
          name, address, timezone, phone1: phone || null,
        }).eq("id", propertyId);
      }

      if (s === "sites") {
        // Create site type + N sites
        const { data: st, error: stErr } = await supabase.from("site_types").insert({
          property_id: propertyId,
          name: siteTypeName,
          code: siteTypeName.slice(0, 4).toUpperCase(),
        } as any).select().single();
        if (stErr) throw stErr;

        const rows = Array.from({ length: siteCount }).map((_, i) => ({
          property_id: propertyId,
          site_type_id: st.id,
          site_number: `${numberingPrefix}${String(i + 1).padStart(3, "0")}`,
          status: "available",
        }));
        const { error: sErr } = await supabase.from("sites").insert(rows as any);
        if (sErr && !sErr.message?.includes("limit")) throw sErr;
        toast.success(`Created ${rows.length} sites`);
      }

      if (s === "rates") {
        const { error } = await supabase.from("rates").insert({
          property_id: propertyId,
          name: rateName,
          rate_type: "base",
          base_amount: rateAmount,
          is_default: true,
          is_active: true,
        } as any);
        if (error) throw error;
      }

      if (s === "booking") {
        const updates: any = {};
        if (publicSlug.trim()) updates.booking_public_slug = publicSlug.trim().toLowerCase();
        if (Object.keys(updates).length) {
          await supabase.from("properties").update(updates).eq("id", propertyId);
        }
        if (websiteUrl.trim()) {
          supabase.functions.invoke("booking-engine-brand-sync", {
            body: { property_id: propertyId, website_url: websiteUrl.trim() },
          }).catch(() => {/* non-blocking */});
          toast.success("Brand sync started — we'll pull colors & fonts from your website in the background");
        }
      }

      const next = Math.min(STEPS.length - 1, step + 1);
      await persistStep(next);
      setStep(next);
    } catch (e: any) {
      toast.error(e?.message || "Could not save this step");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!propertyId) return;
    setBusy(true);
    try {
      await supabase.from("properties").update({
        setup_completed: true,
        setup_completed_at: new Date().toISOString(),
        setup_step: STEPS.length,
      }).eq("id", propertyId);
      toast.success("You're live! Welcome to Trailblazer.");
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Could not complete onboarding");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !propertyId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const StepIcon = STEPS[step].icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-950/10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <img src={trailblazerLogo} alt="Trailblazer" className="h-8" />
          <Badge variant="outline" className="text-xs">Step {step + 1} of {STEPS.length}</Badge>
        </div>

        <Progress value={progress} className="mb-6" />

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main form */}
          <Card className="md:col-span-2 border-primary/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <StepIcon className="h-5 w-5" />
                </div>
                <CardTitle>{STEPS[step].title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {STEPS[step].key === "welcome" && (
                <>
                  <div className="space-y-2">
                    <Label>Property Name *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Trailblazer RV Park" />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Pine Ridge Rd, Mountain View, CA" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/Los_Angeles" />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
                    </div>
                  </div>
                </>
              )}

              {STEPS[step].key === "sites" && (
                <>
                  <p className="text-sm text-muted-foreground">Add your first batch of sites. You can add more types and reorganize them on the map later.</p>
                  <div className="space-y-2">
                    <Label>Site Type</Label>
                    <Input value={siteTypeName} onChange={(e) => setSiteTypeName(e.target.value)} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>How many?</Label>
                      <Input type="number" value={siteCount} onChange={(e) => setSiteCount(parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Number Prefix (optional)</Label>
                      <Input value={numberingPrefix} onChange={(e) => setNumberingPrefix(e.target.value)} placeholder="e.g. A" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Sites will be numbered {numberingPrefix}001 through {numberingPrefix}{String(siteCount).padStart(3, "0")}.</p>
                </>
              )}

              {STEPS[step].key === "rates" && (
                <>
                  <div className="space-y-2">
                    <Label>Rate Name</Label>
                    <Input value={rateName} onChange={(e) => setRateName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nightly Amount (USD)</Label>
                    <Input type="number" value={rateAmount} onChange={(e) => setRateAmount(parseFloat(e.target.value) || 0)} />
                  </div>
                  <p className="text-xs text-muted-foreground">This becomes your default rate. Add seasons, weekly/monthly discounts, and packages later in Settings → Rates.</p>
                </>
              )}

              {STEPS[step].key === "payments" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <CreditCard className="h-5 w-5 text-primary mt-0.5" />
                      <div className="text-sm">
                        <div className="font-medium">Payments are powered by Adyen</div>
                        <p className="text-muted-foreground mt-1">
                          Trailblazer is fully PCI SAQ A compliant — we never touch raw card data. To take payments you'll need an Adyen merchant account.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => navigate("/settings/property")}>Open Payment Settings</Button>
                  <p className="text-xs text-muted-foreground text-center">You can skip this and come back — no reservations require payment setup.</p>
                </div>
              )}

              {STEPS[step].key === "booking" && (
                <>
                  <div className="space-y-2">
                    <Label>Public Booking URL Slug</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">/b/</span>
                      <Input value={publicSlug} onChange={(e) => setPublicSlug(e.target.value)} placeholder="trailblazer-rv" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Auto-match your existing website (optional)</Label>
                    <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://yourcampground.com" />
                    <p className="text-xs text-muted-foreground">Our AI will scrape colors, fonts, and logo so guests feel right at home.</p>
                  </div>
                </>
              )}

              {STEPS[step].key === "go-live" && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <PartyPopper className="h-16 w-16 mx-auto text-primary mb-3" />
                    <h3 className="text-xl font-semibold">You're ready to launch!</h3>
                    <p className="text-muted-foreground mt-2 text-sm">Everything is configured. Click below to enter Trailblazer.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {STEPS.slice(0, -1).map((s, idx) => (
                      <div key={s.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>{s.title}</span>
                        <Badge variant="outline" className="ml-auto text-[10px]">Done</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || busy}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => { persistStep(step + 1); setStep(step + 1); }} disabled={busy}>Skip</Button>
                    <Button onClick={goNext} disabled={busy}>
                      {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                      Save & Continue <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                ) : (
                  <Button onClick={finish} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PartyPopper className="h-4 w-4 mr-1" />}
                    Launch Trailblazer
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contextual help */}
          <Card className="border-primary/10 h-fit">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> What this does
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>{STEPS[step].help}</p>
              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="text-xs font-medium text-foreground">Setup checklist</div>
                {STEPS.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className={`h-3.5 w-3.5 ${i < step ? "text-primary" : i === step ? "text-primary/50" : "text-muted-foreground/30"}`} />
                    <span className={i === step ? "font-medium text-foreground" : ""}>{s.title}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
