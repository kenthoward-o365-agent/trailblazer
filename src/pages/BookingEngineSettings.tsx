import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";
import { Loader2, ExternalLink, Plus, Trash2, Rocket, Copy, Image as ImageIcon, Sparkles, Wand2, RefreshCw } from "lucide-react";
import { buildSiteTypeDescription } from "@/lib/siteDescription";
import { fetchCustomAttrs } from "@/components/SiteCustomAttributesManager";

export default function BookingEngineSettings() {
  const { selectedProperty } = useProperty();
  const selectedPropertyId = selectedProperty?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [siteTypes, setSiteTypes] = useState<any[]>([]);
  const [siteTypeCfg, setSiteTypeCfg] = useState<Record<string, any>>({});
  const [gallery, setGallery] = useState<any[]>([]);
  const [galleryTitle, setGalleryTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [addOns, setAddOns] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [losRules, setLosRules] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [brandUrl, setBrandUrl] = useState("");
  const [syncingBrand, setSyncingBrand] = useState(false);

  async function syncBrandFromWebsite() {
    if (!brandUrl.trim() || !selectedPropertyId) return;
    setSyncingBrand(true);
    try {
      const { data, error } = await supabase.functions.invoke("booking-engine-brand-sync", {
        body: { property_id: selectedPropertyId, url: brandUrl.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Brand imported — review and save");
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not import brand");
    } finally {
      setSyncingBrand(false);
    }
  }

  // ------- Site CMS (custom CSS via AI or manual) -------
  const [cssPrompt, setCssPrompt] = useState("");
  const [cssBusy, setCssBusy] = useState(false);
  async function generateCssFromPrompt() {
    if (!cssPrompt.trim() || !selectedPropertyId) return;
    setCssBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("booking-engine-css-assistant", {
        body: {
          property_id: selectedPropertyId,
          instruction: cssPrompt.trim(),
          current_css: settings?.custom_css ?? "",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSettings((s: any) => ({ ...s, custom_css: data.css }));
      toast.success("CSS updated — review and save");
    } catch (e: any) {
      toast.error(e?.message ?? "AI could not generate CSS");
    } finally { setCssBusy(false); }
  }

  useEffect(() => {
    if (selectedPropertyId) loadAll();
  }, [selectedPropertyId]);

  async function loadAll() {
    setLoading(true);
    const [prop, s, dep, st, cfg, gal, pk, ao, pc, lr] = await Promise.all([
      supabase.from("properties").select("id, name, booking_engine_enabled, booking_public_slug, booking_custom_slug, booking_custom_domain, default_online_buffer").eq("id", selectedPropertyId!).maybeSingle(),
      supabase.from("booking_engine_settings").select("*").eq("property_id", selectedPropertyId!).maybeSingle(),
      supabase.from("deposit_policies").select("*").eq("property_id", selectedPropertyId!).order("name"),
      supabase.from("site_types").select("id, name, base_price, description, image_path, auto_description, use_auto_description").eq("property_id", selectedPropertyId!).order("name"),
      supabase.from("site_type_booking_config").select("*").eq("property_id", selectedPropertyId!),
      supabase.from("gallery_assets").select("*").eq("property_id", selectedPropertyId!).order("sort_order"),
      supabase.from("packages").select("*").eq("property_id", selectedPropertyId!).order("sort_order"),
      supabase.from("add_ons").select("*").eq("property_id", selectedPropertyId!).order("name"),
      supabase.from("promo_codes").select("*").eq("property_id", selectedPropertyId!).order("code"),
      supabase.from("los_discount_rules").select("*").eq("property_id", selectedPropertyId!).order("min_nights"),
    ]);
    setProperty(prop.data);
    setSettings(s.data ?? {
      property_id: selectedPropertyId!, min_nights: 1, max_nights: 30,
      min_advance_days: 0, max_advance_days: 365,
      tagline: "", about_markdown: "", primary_color: "#0f766e",
      contact_email: "", contact_phone: "", terms_and_conditions: "", cancellation_summary: "",
      confirmation_message: "", allow_search_engine_indexing: false,
    });
    setDeposits(dep.data ?? []);
    setSiteTypes(st.data ?? []);
    const cfgMap: Record<string, any> = {};
    (cfg.data ?? []).forEach((c) => { cfgMap[c.site_type_id] = c; });
    setSiteTypeCfg(cfgMap);
    setGallery(gal.data ?? []);
    setPackages(pk.data ?? []);
    setAddOns(ao.data ?? []);
    setPromos(pc.data ?? []);
    setLosRules(lr.data ?? []);
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    const { error } = await supabase.from("booking_engine_settings").upsert(
      { ...settings, property_id: selectedPropertyId! },
      { onConflict: "property_id" },
    );
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
    setSaving(false);
  }

  async function toggleEngine(enabled: boolean) {
    const patch: any = { booking_engine_enabled: enabled };
    if (enabled && !property?.booking_public_slug) {
      const { data: slug } = await supabase.rpc("generate_booking_public_slug");
      patch.booking_public_slug = slug;
    }
    const { error } = await supabase.from("properties").update(patch).eq("id", selectedPropertyId!);
    if (error) toast.error(error.message);
    else {
      toast.success(enabled ? "Booking engine live" : "Booking engine paused");
      loadAll();
    }
  }

  async function addDeposit() {
    const { error } = await supabase.from("deposit_policies").insert({
      property_id: selectedPropertyId!,
      name: "New Policy",
      deposit_type: "percent",
      deposit_value: 25,
      deposit_due: "at_booking",
      payment_mode: "deposit",
      no_show_charge_type: "percent",
      no_show_charge_value: 100,
    });
    if (error) toast.error(error.message);
    else loadAll();
  }

  async function updateDeposit(id: string, patch: any) {
    setDeposits((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  async function saveDeposit(d: any) {
    const { id, created_at, updated_at, ...rest } = d;
    const { error } = await supabase.from("deposit_policies").update(rest).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Policy saved");
  }

  async function deleteDeposit(id: string) {
    const { error } = await supabase.from("deposit_policies").delete().eq("id", id);
    if (error) toast.error(error.message);
    else loadAll();
  }

  async function toggleTypeBookable(siteType: any, enabled: boolean) {
    const existing = siteTypeCfg[siteType.id];
    if (existing) {
      await supabase.from("site_type_booking_config").update({ is_bookable_online: enabled }).eq("id", existing.id);
    } else {
      await supabase.from("site_type_booking_config").insert({
        property_id: selectedPropertyId!,
        site_type_id: siteType.id,
        is_bookable_online: enabled,
      });
    }
    loadAll();
  }

  async function updateTypeCfg(siteType: any, patch: any) {
    const existing = siteTypeCfg[siteType.id];
    if (existing) {
      const { error } = await supabase.from("site_type_booking_config").update(patch).eq("id", existing.id);
      if (error) toast.error(error.message);
      else { setSiteTypeCfg((p) => ({ ...p, [siteType.id]: { ...existing, ...patch } })); }
    }
  }

  async function updateSiteTypeRow(siteType: any, patch: any) {
    const { error } = await supabase.from("site_types").update(patch).eq("id", siteType.id);
    if (error) return toast.error(error.message);
    setSiteTypes((prev) => prev.map((s) => (s.id === siteType.id ? { ...s, ...patch } : s)));
  }

  async function regenerateAutoDescription(siteType: any) {
    if (!selectedPropertyId) return;
    const [{ data: sites }, defs] = await Promise.all([
      supabase
        .from("sites")
        .select("max_vehicle_length, site_access_type, is_shaded, has_fire_pit, has_picnic_table, allows_bump_outs, has_50amp, has_30amp, custom_attributes")
        .eq("property_id", selectedPropertyId)
        .eq("site_type_id", siteType.id)
        .eq("is_active", true),
      fetchCustomAttrs(selectedPropertyId),
    ]);
    const desc = buildSiteTypeDescription((sites as any) ?? [], defs as any);
    await updateSiteTypeRow(siteType, { auto_description: desc });
    toast.success("Description regenerated");
  }


  async function uploadGalleryFiles(files: FileList, title: string) {
    const arr = Array.from(files);
    let ok = 0;
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${selectedPropertyId}/${Date.now()}-${i}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("booking-gallery")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue; }
      const { error } = await supabase.from("gallery_assets").insert({
        property_id: selectedPropertyId!,
        scope: "property",
        storage_path: path,
        caption: title || null,
        alt_text: title || null,
        sort_order: gallery.length + i,
      });
      if (error) { toast.error(`${file.name}: ${error.message}`); continue; }
      ok++;
    }
    if (ok > 0) { toast.success(`Uploaded ${ok} image${ok > 1 ? "s" : ""}`); loadAll(); }
  }

  async function updateGalleryCaption(id: string, caption: string) {
    const { error } = await supabase.from("gallery_assets").update({ caption, alt_text: caption }).eq("id", id);
    if (error) toast.error(error.message);
    else setGallery((prev) => prev.map((g) => g.id === id ? { ...g, caption } : g));
  }

  async function deleteGallery(id: string, path: string) {
    await supabase.storage.from("booking-gallery").remove([path]);
    await supabase.from("gallery_assets").delete().eq("id", id);
    loadAll();
  }

  async function uploadSiteTypeImage(siteType: any, file: File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${selectedPropertyId}/site-types/${siteType.id}-${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("booking-gallery")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
    if (upErr) { toast.error(upErr.message); return; }
    // Remove previous image if any
    if (siteType.image_path) {
      await supabase.storage.from("booking-gallery").remove([siteType.image_path]);
    }
    const { error } = await supabase.from("site_types").update({ image_path: path }).eq("id", siteType.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Image updated");
    setSiteTypes((prev) => prev.map((s) => s.id === siteType.id ? { ...s, image_path: path } : s));
  }

  async function removeSiteTypeImage(siteType: any) {
    if (!siteType.image_path) return;
    await supabase.storage.from("booking-gallery").remove([siteType.image_path]);
    const { error } = await supabase.from("site_types").update({ image_path: null }).eq("id", siteType.id);
    if (error) { toast.error(error.message); return; }
    setSiteTypes((prev) => prev.map((s) => s.id === siteType.id ? { ...s, image_path: null } : s));
  }

  // ---- Packages / Add-ons / Promos / LOS helpers ----
  async function addPackage() {
    const { error } = await supabase.from("packages").insert({ property_id: selectedPropertyId!, name: "New Package", price: 0, charge_type: "per_stay" });
    if (error) toast.error(error.message); else loadAll();
  }
  async function savePackage(p: any) {
    const { id, created_at, updated_at, ...rest } = p;
    const { error } = await supabase.from("packages").update(rest).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Saved");
  }
  async function deletePackage(id: string) {
    if (!confirm("Delete package?")) return;
    const { error } = await supabase.from("packages").delete().eq("id", id);
    if (error) toast.error(error.message); else loadAll();
  }

  async function addAddOn() {
    const { error } = await supabase.from("add_ons").insert({ property_id: selectedPropertyId!, name: "New Add-on", price: 0, charge_type: "one_time" });
    if (error) toast.error(error.message); else loadAll();
  }
  async function saveAddOn(a: any) {
    const { id, created_at, updated_at, ...rest } = a;
    const { error } = await supabase.from("add_ons").update(rest).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Saved");
  }
  async function deleteAddOn(id: string) {
    if (!confirm("Delete add-on?")) return;
    const { error } = await supabase.from("add_ons").delete().eq("id", id);
    if (error) toast.error(error.message); else loadAll();
  }

  async function addPromo() {
    const { error } = await supabase.from("promo_codes").insert({ property_id: selectedPropertyId!, code: `SAVE${Math.floor(Math.random()*1000)}`, discount_type: "percent", discount_value: 10 });
    if (error) toast.error(error.message); else loadAll();
  }
  async function savePromo(p: any) {
    const { id, created_at, updated_at, uses_count, ...rest } = p;
    const { error } = await supabase.from("promo_codes").update(rest).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Saved");
  }
  async function deletePromo(id: string) {
    if (!confirm("Delete promo code?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) toast.error(error.message); else loadAll();
  }

  async function addLosRule() {
    const { error } = await supabase.from("los_discount_rules").insert({ property_id: selectedPropertyId!, name: "Stay 7+ nights", min_nights: 7, discount_type: "percent", discount_value: 10 });
    if (error) toast.error(error.message); else loadAll();
  }
  async function saveLosRule(r: any) {
    const { id, created_at, updated_at, ...rest } = r;
    const { error } = await supabase.from("los_discount_rules").update(rest).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Saved");
  }
  async function deleteLosRule(id: string) {
    if (!confirm("Delete rule?")) return;
    const { error } = await supabase.from("los_discount_rules").delete().eq("id", id);
    if (error) toast.error(error.message); else loadAll();
  }


  const publicUrl = property?.booking_public_slug
    ? `${window.location.origin}/b/${property.booking_custom_slug || property.booking_public_slug}`
    : "";

  if (loading || !property) {
    return <DashboardLayout><div className="flex items-center gap-2 p-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Rocket className="h-7 w-7" /> Booking Engine</h1>
            <p className="text-muted-foreground mt-1">Configure the public booking site for {property.name}</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Label>Live</Label>
            <Switch checked={property.booking_engine_enabled} onCheckedChange={toggleEngine} />
            {property.booking_engine_enabled ? <Badge>Enabled</Badge> : <Badge variant="secondary">Disabled</Badge>}
          </div>
        </div>

        {publicUrl ? (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    Public booking site
                    {property.booking_engine_enabled
                      ? <Badge>Live</Badge>
                      : <Badge variant="secondary">Preview only — engine disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Open this link in a new tab to review and test as guests configure their booking.
                  </p>
                </div>
                <Button asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" /> Open preview
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={publicUrl} className="font-mono text-sm" onFocus={(e) => e.currentTarget.select()} />
                <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copied"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-sm font-semibold">No preview URL yet</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate a public link so you can review and test the booking site as you configure it.
                </p>
              </div>
              <Button
                onClick={async () => {
                  const { data: slug, error } = await supabase.rpc("generate_booking_public_slug");
                  if (error) return toast.error(error.message);
                  const { error: upErr } = await supabase.from("properties").update({ booking_public_slug: slug }).eq("id", property.id);
                  if (upErr) return toast.error(upErr.message);
                  toast.success("Preview URL generated");
                  loadAll();
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" /> Generate preview URL
              </Button>
            </CardContent>
          </Card>
        )}


        <Tabs defaultValue="general">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="site-types">Site Types</TabsTrigger>
            <TabsTrigger value="deposits">Deposits</TabsTrigger>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="addons">Add-ons</TabsTrigger>
            <TabsTrigger value="promos">Promo Codes</TabsTrigger>
            <TabsTrigger value="los">LOS Discounts</TabsTrigger>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            <TabsTrigger value="cms">Site CMS</TabsTrigger>
            <TabsTrigger value="widget">Booking Widget</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4" /> Match your website
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Paste your main website URL and we'll analyze it with AI to pull colors, fonts, and your logo so
                  guests feel like they never left your site.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="https://your-campground.com"
                    value={brandUrl}
                    onChange={(e) => setBrandUrl(e.target.value)}
                    disabled={syncingBrand}
                  />
                  <Button onClick={syncBrandFromWebsite} disabled={syncingBrand || !brandUrl.trim()}>
                    {syncingBrand ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Import brand
                  </Button>
                </div>
                {settings?.brand_synced_at && (
                  <p className="text-xs text-muted-foreground">
                    Last synced {new Date(settings.brand_synced_at).toLocaleString()}
                    {settings.brand_source_url ? ` from ${settings.brand_source_url}` : ""}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card><CardHeader><CardTitle>Branding & Content</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div><Label>Tagline</Label><Input value={settings.tagline ?? ""} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} /></div>
                <div><Label>Logo URL</Label><Input placeholder="https://…/logo.svg" value={settings.logo_url ?? ""} onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })} /></div>
                <div><Label>Primary Color</Label><Input type="color" value={settings.primary_color ?? "#0f766e"} onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })} /></div>
                <div><Label>Accent Color</Label><Input type="color" value={settings.accent_color ?? "#f59e0b"} onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })} /></div>
                <div><Label>Background</Label><Input type="color" value={settings.background_color ?? "#ffffff"} onChange={(e) => setSettings({ ...settings, background_color: e.target.value })} /></div>
                <div><Label>Text Color</Label><Input type="color" value={settings.text_color ?? "#0f172a"} onChange={(e) => setSettings({ ...settings, text_color: e.target.value })} /></div>
                <div><Label>Heading Font</Label><Input placeholder="Inter" value={settings.heading_font ?? ""} onChange={(e) => setSettings({ ...settings, heading_font: e.target.value })} /></div>
                <div><Label>Body Font</Label><Input placeholder="Inter" value={settings.body_font ?? ""} onChange={(e) => setSettings({ ...settings, body_font: e.target.value })} /></div>
                <div className="md:col-span-2"><Label>About</Label><Textarea rows={4} value={settings.about_markdown ?? ""} onChange={(e) => setSettings({ ...settings, about_markdown: e.target.value })} /></div>
                <div><Label>Contact Email</Label><Input value={settings.contact_email ?? ""} onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })} /></div>
                <div><Label>Contact Phone</Label><Input value={settings.contact_phone ?? ""} onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })} /></div>
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Stay Rules</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-4 gap-4">
                <div><Label>Min nights</Label><Input type="number" value={settings.min_nights ?? 1} onChange={(e) => setSettings({ ...settings, min_nights: Number(e.target.value) })} /></div>
                <div><Label>Max nights</Label><Input type="number" value={settings.max_nights ?? 30} onChange={(e) => setSettings({ ...settings, max_nights: Number(e.target.value) })} /></div>
                <div><Label>Min advance days</Label><Input type="number" value={settings.min_advance_days ?? 0} onChange={(e) => setSettings({ ...settings, min_advance_days: Number(e.target.value) })} /></div>
                <div><Label>Max advance days</Label><Input type="number" value={settings.max_advance_days ?? 365} onChange={(e) => setSettings({ ...settings, max_advance_days: Number(e.target.value) })} /></div>
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Policies</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Cancellation summary</Label><Textarea rows={3} value={settings.cancellation_summary ?? ""} onChange={(e) => setSettings({ ...settings, cancellation_summary: e.target.value })} /></div>
                <div><Label>Terms and conditions</Label><Textarea rows={5} value={settings.terms_and_conditions ?? ""} onChange={(e) => setSettings({ ...settings, terms_and_conditions: e.target.value })} /></div>
                <div><Label>Confirmation message</Label><Textarea rows={3} value={settings.confirmation_message ?? ""} onChange={(e) => setSettings({ ...settings, confirmation_message: e.target.value })} /></div>
              </CardContent>
            </Card>
            <div className="flex justify-end"><Button onClick={saveSettings} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save settings</Button></div>
          </TabsContent>

          <TabsContent value="site-types" className="space-y-3">
            <p className="text-sm text-muted-foreground">Choose which site types can be booked online and set stay rules per type.</p>

            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardHeader>
                <CardTitle className="text-base">Online sales safety cushion</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Hold back the last N sites of every type from online shoppers and OTAs so phone, front desk, and walk-in bookings always have inventory. Staff bookings in the PMS ignore this cushion.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="max-w-[220px]">
                  <Label>Default sites held back</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={property?.default_online_buffer ?? 0}
                    onChange={(e) =>
                      setProperty((p: any) => ({ ...p, default_online_buffer: Math.max(0, Math.min(50, Number(e.target.value) || 0)) }))
                    }
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const val = Number(property?.default_online_buffer ?? 0);
                    const { error } = await supabase
                      .from("properties")
                      .update({ default_online_buffer: val })
                      .eq("id", selectedPropertyId!);
                    if (error) toast.error(error.message);
                    else toast.success("Default cushion saved");
                  }}
                >
                  Save default
                </Button>
                <p className="text-xs text-muted-foreground sm:ml-2">
                  Individual site types can override this below.
                </p>
              </CardContent>
            </Card>

            {siteTypes.map((st) => {
              const cfg = siteTypeCfg[st.id];
              const enabled = cfg?.is_bookable_online ?? false;
              const propertyDefault = property?.default_online_buffer ?? 0;
              return (
                <Card key={st.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{st.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">${Number(st.base_price).toFixed(2)} / night base</p>
                    </div>
                    <Switch checked={enabled} onCheckedChange={(v) => toggleTypeBookable(st, v)} />
                  </CardHeader>
                  {enabled && cfg && (
                    <CardContent className="space-y-4">
                      <SiteTypeImageEditor
                        siteType={st}
                        onUpload={(file) => uploadSiteTypeImage(st, file)}
                        onRemove={() => removeSiteTypeImage(st)}
                      />
                      <div className="grid md:grid-cols-4 gap-3">
                        <div><Label>Min nights</Label><Input type="number" defaultValue={cfg.min_nights ?? ""} onBlur={(e) => updateTypeCfg(st, { min_nights: e.target.value ? Number(e.target.value) : null })} /></div>
                        <div><Label>Max nights</Label><Input type="number" defaultValue={cfg.max_nights ?? ""} onBlur={(e) => updateTypeCfg(st, { max_nights: e.target.value ? Number(e.target.value) : null })} /></div>
                        <div><Label>Max rig length (ft)</Label><Input type="number" defaultValue={cfg.max_rig_length ?? ""} onBlur={(e) => updateTypeCfg(st, { max_rig_length: e.target.value ? Number(e.target.value) : null })} /></div>
                        <div className="flex items-end gap-2"><Switch checked={cfg.allow_specific_site_pick} onCheckedChange={(v) => updateTypeCfg(st, { allow_specific_site_pick: v })} /><Label>Allow site pick</Label></div>
                        <div>
                          <Label>Online cushion override</Label>
                          <Input
                            type="number"
                            min={0}
                            max={50}
                            placeholder={`Using default (${propertyDefault})`}
                            defaultValue={cfg.online_buffer ?? ""}
                            onBlur={(e) => {
                              const raw = e.target.value.trim();
                              const next = raw === "" ? null : Math.max(0, Math.min(50, Number(raw) || 0));
                              updateTypeCfg(st, { online_buffer: next });
                            }}
                          />
                          <p className="text-[11px] text-muted-foreground mt-1">Blank = use property default. 0 = sell every last site online.</p>
                        </div>
                        <div className="md:col-span-4 space-y-2 border-t pt-3">
                          <div className="flex items-center justify-between">
                            <Label>Booking engine description</Label>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 text-xs">
                                <Switch
                                  checked={st.use_auto_description ?? true}
                                  onCheckedChange={(v) => updateSiteTypeRow(st, { use_auto_description: v })}
                                />
                                Use auto-generated
                              </label>
                              <Button size="sm" variant="outline" onClick={() => regenerateAutoDescription(st)}>
                                <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
                              </Button>
                            </div>
                          </div>
                          {(st.use_auto_description ?? true) ? (
                            <div className="text-sm rounded border bg-muted/40 p-2 min-h-[3rem]">
                              {st.auto_description || <span className="text-muted-foreground italic">Click Regenerate to build from site attributes.</span>}
                            </div>
                          ) : (
                            <Textarea
                              rows={2}
                              defaultValue={cfg.public_description ?? ""}
                              onBlur={(e) => updateTypeCfg(st, { public_description: e.target.value })}
                              placeholder="Custom description shown to guests"
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="deposits" className="space-y-3">
            <div className="flex justify-end"><Button onClick={addDeposit}><Plus className="h-4 w-4 mr-1" /> Add policy</Button></div>
            {deposits.map((d) => (
              <Card key={d.id}>
                <CardContent className="pt-6 grid md:grid-cols-4 gap-3">
                  <div className="md:col-span-2"><Label>Name</Label><Input value={d.name} onChange={(e) => updateDeposit(d.id, { name: e.target.value })} /></div>
                  <div><Label>Payment Mode</Label>
                    <Select value={d.payment_mode} onValueChange={(v) => updateDeposit(d.id, { payment_mode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guarantee">Card guarantee only</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="full">Full prepayment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2"><Switch checked={d.is_default} onCheckedChange={(v) => updateDeposit(d.id, { is_default: v })} /><Label>Default</Label></div>
                  <div><Label>Deposit Type</Label>
                    <Select value={d.deposit_type} onValueChange={(v) => updateDeposit(d.id, { deposit_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percent of total</SelectItem>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                        <SelectItem value="first_night">First night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Deposit Value</Label><Input type="number" value={d.deposit_value} onChange={(e) => updateDeposit(d.id, { deposit_value: Number(e.target.value) })} /></div>
                  <div><Label>Deposit Due</Label>
                    <Select value={d.deposit_due} onValueChange={(v) => updateDeposit(d.id, { deposit_due: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="at_booking">At booking</SelectItem>
                        <SelectItem value="days_before_arrival">Days before arrival</SelectItem>
                        <SelectItem value="at_arrival">At arrival</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Days before arrival</Label><Input type="number" value={d.deposit_due_days ?? 0} onChange={(e) => updateDeposit(d.id, { deposit_due_days: Number(e.target.value) })} /></div>
                  <div className="md:col-span-4 flex justify-between">
                    <Button size="sm" variant="destructive" onClick={() => deleteDeposit(d.id)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                    <Button size="sm" onClick={() => saveDeposit(d)}>Save</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="gallery" className="space-y-3">
            <Card><CardContent className="pt-6 space-y-3">
              <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <Label>Image title / caption</Label>
                  <Input
                    placeholder="e.g. Lakeside pull-through site"
                    value={galleryTitle}
                    onChange={(e) => setGalleryTitle(e.target.value)}
                  />
                </div>
                <Button
                  disabled={uploading}
                  onClick={() => document.getElementById("gallery-file-input")?.click()}
                >
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Upload images
                </Button>
              </div>
              <Input
                id="gallery-file-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  if (!e.target.files?.length) return;
                  setUploading(true);
                  try { await uploadGalleryFiles(e.target.files, galleryTitle); setGalleryTitle(""); }
                  finally { setUploading(false); e.target.value = ""; }
                }}
              />
              <p className="text-xs text-muted-foreground">Select one or many images. The title applies to all files uploaded in this batch; you can edit each caption below.</p>
            </CardContent></Card>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {gallery.map((g) => (
                <GalleryTile
                  key={g.id}
                  asset={g}
                  isHero={settings.hero_image_path === g.storage_path}
                  onSetHero={() => {
                    const next = settings.hero_image_path === g.storage_path ? null : g.storage_path;
                    setSettings({ ...settings, hero_image_path: next });
                    supabase.from("booking_engine_settings").update({ hero_image_path: next }).eq("property_id", selectedPropertyId!);
                  }}
                  isBackground={(settings as any).background_image_path === g.storage_path}
                  onSetBackground={() => {
                    const next = (settings as any).background_image_path === g.storage_path ? null : g.storage_path;
                    setSettings({ ...settings, background_image_path: next } as any);
                    supabase.from("booking_engine_settings").update({ background_image_path: next } as any).eq("property_id", selectedPropertyId!);
                  }}
                  onDelete={() => deleteGallery(g.id, g.storage_path)}
                  onCaption={(c) => updateGalleryCaption(g.id, c)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="packages" className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Bundle add-ons or perks into upsell packages shown at checkout.</p>
              <Button onClick={addPackage}><Plus className="h-4 w-4 mr-1" />Add package</Button>
            </div>
            {packages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No packages yet.</p>}
            {packages.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-6 grid md:grid-cols-4 gap-3">
                  <div className="md:col-span-2"><Label>Name</Label><Input value={p.name} onChange={(e) => setPackages((prev) => prev.map((x) => x.id === p.id ? { ...x, name: e.target.value } : x))} /></div>
                  <div><Label>Price</Label><Input type="number" step="0.01" value={p.price} onChange={(e) => setPackages((prev) => prev.map((x) => x.id === p.id ? { ...x, price: Number(e.target.value) } : x))} /></div>
                  <div><Label>Charge</Label>
                    <Select value={p.charge_type} onValueChange={(v) => setPackages((prev) => prev.map((x) => x.id === p.id ? { ...x, charge_type: v } : x))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_stay">Per stay</SelectItem>
                        <SelectItem value="per_night">Per night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-4"><Label>Description</Label><Textarea rows={2} value={p.description ?? ""} onChange={(e) => setPackages((prev) => prev.map((x) => x.id === p.id ? { ...x, description: e.target.value } : x))} /></div>
                  <div className="md:col-span-4 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Switch checked={p.is_active} onCheckedChange={(v) => setPackages((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: v } : x))} /><Label>Active</Label></div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => deletePackage(p.id)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                      <Button size="sm" onClick={() => savePackage(p)}>Save</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="addons" className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Optional extras like firewood, kayak rental, pet fee, etc.</p>
              <Button onClick={addAddOn}><Plus className="h-4 w-4 mr-1" />Add add-on</Button>
            </div>
            {addOns.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No add-ons yet.</p>}
            {addOns.map((a) => (
              <Card key={a.id}>
                <CardContent className="pt-6 grid md:grid-cols-4 gap-3">
                  <div className="md:col-span-2"><Label>Name</Label><Input value={a.name} onChange={(e) => setAddOns((prev) => prev.map((x) => x.id === a.id ? { ...x, name: e.target.value } : x))} /></div>
                  <div><Label>Price</Label><Input type="number" step="0.01" value={a.price} onChange={(e) => setAddOns((prev) => prev.map((x) => x.id === a.id ? { ...x, price: Number(e.target.value) } : x))} /></div>
                  <div><Label>Charge</Label>
                    <Select value={a.charge_type} onValueChange={(v) => setAddOns((prev) => prev.map((x) => x.id === a.id ? { ...x, charge_type: v } : x))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one_time">One-time</SelectItem>
                        <SelectItem value="nightly">Per night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-4"><Label>Description</Label><Textarea rows={2} value={a.description ?? ""} onChange={(e) => setAddOns((prev) => prev.map((x) => x.id === a.id ? { ...x, description: e.target.value } : x))} /></div>
                  <div className="md:col-span-4 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Switch checked={a.is_active} onCheckedChange={(v) => setAddOns((prev) => prev.map((x) => x.id === a.id ? { ...x, is_active: v } : x))} /><Label>Active</Label></div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => deleteAddOn(a.id)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                      <Button size="sm" onClick={() => saveAddOn(a)}>Save</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="promos" className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Discount codes guests can apply at checkout.</p>
              <Button onClick={addPromo}><Plus className="h-4 w-4 mr-1" />Add code</Button>
            </div>
            {promos.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No promo codes yet.</p>}
            {promos.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-6 grid md:grid-cols-4 gap-3">
                  <div><Label>Code</Label><Input value={p.code} onChange={(e) => setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, code: e.target.value.toUpperCase() } : x))} /></div>
                  <div><Label>Type</Label>
                    <Select value={p.discount_type} onValueChange={(v) => setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, discount_type: v } : x))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percent %</SelectItem>
                        <SelectItem value="fixed">Fixed $</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Value</Label><Input type="number" step="0.01" value={p.discount_value} onChange={(e) => setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, discount_value: Number(e.target.value) } : x))} /></div>
                  <div><Label>Max uses</Label><Input type="number" value={p.max_uses ?? ""} onChange={(e) => setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, max_uses: e.target.value ? Number(e.target.value) : null } : x))} /></div>
                  <div><Label>Valid from</Label><Input type="date" value={p.valid_from ?? ""} onChange={(e) => setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, valid_from: e.target.value || null } : x))} /></div>
                  <div><Label>Valid to</Label><Input type="date" value={p.valid_to ?? ""} onChange={(e) => setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, valid_to: e.target.value || null } : x))} /></div>
                  <div className="md:col-span-2"><Label>Description</Label><Input value={p.description ?? ""} onChange={(e) => setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, description: e.target.value } : x))} /></div>
                  <div className="md:col-span-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2"><Switch checked={p.is_active} onCheckedChange={(v) => setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: v } : x))} /><Label>Active</Label></div>
                      <Badge variant="outline">{p.uses_count ?? 0} uses</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => deletePromo(p.id)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                      <Button size="sm" onClick={() => savePromo(p)}>Save</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="los" className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Reward longer stays with automatic discounts.</p>
              <Button onClick={addLosRule}><Plus className="h-4 w-4 mr-1" />Add rule</Button>
            </div>
            {losRules.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No LOS rules yet.</p>}
            {losRules.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-6 grid md:grid-cols-4 gap-3">
                  <div className="md:col-span-2"><Label>Name</Label><Input value={r.name} onChange={(e) => setLosRules((prev) => prev.map((x) => x.id === r.id ? { ...x, name: e.target.value } : x))} /></div>
                  <div><Label>Min nights</Label><Input type="number" value={r.min_nights} onChange={(e) => setLosRules((prev) => prev.map((x) => x.id === r.id ? { ...x, min_nights: Number(e.target.value) } : x))} /></div>
                  <div><Label>Type</Label>
                    <Select value={r.discount_type} onValueChange={(v) => setLosRules((prev) => prev.map((x) => x.id === r.id ? { ...x, discount_type: v } : x))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percent %</SelectItem>
                        <SelectItem value="fixed">Fixed $ / night</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Value</Label><Input type="number" step="0.01" value={r.discount_value} onChange={(e) => setLosRules((prev) => prev.map((x) => x.id === r.id ? { ...x, discount_value: Number(e.target.value) } : x))} /></div>
                  <div className="md:col-span-4 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Switch checked={r.is_active} onCheckedChange={(v) => setLosRules((prev) => prev.map((x) => x.id === r.id ? { ...x, is_active: v } : x))} /><Label>Active</Label></div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={() => deleteLosRule(r.id)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                      <Button size="sm" onClick={() => saveLosRule(r)}>Save</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="cms" className="space-y-4">
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI style assistant</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Describe the change in plain English (e.g. "Make headings serif and add a wood-textured background to the header")
                  and AI will update your custom CSS. All output is scoped to your booking pages only.
                </p>
                <Textarea
                  rows={3}
                  value={cssPrompt}
                  onChange={(e) => setCssPrompt(e.target.value)}
                  placeholder="Round all buttons more, use a warm cream background, and make the hero image larger…"
                  disabled={cssBusy}
                />
                <div className="flex justify-end">
                  <Button onClick={generateCssFromPrompt} disabled={cssBusy || !cssPrompt.trim()}>
                    {cssBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                    Generate CSS
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Custom CSS</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Scoped under <code>.booking-brand</code>. Applies to the entire public booking site.
                </p>
                <Textarea
                  rows={12}
                  className="font-mono text-xs"
                  value={settings.custom_css ?? ""}
                  onChange={(e) => setSettings({ ...settings, custom_css: e.target.value })}
                  placeholder=".booking-brand .hero { padding: 4rem 0; }"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Header navigation</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(settings.header_links ?? []).map((l: any, i: number) => (
                  <div key={i} className="grid md:grid-cols-[1fr_2fr_auto_auto] gap-2 items-center">
                    <Input placeholder="Label" value={l.label ?? ""} onChange={(e) => {
                      const next = [...(settings.header_links ?? [])];
                      next[i] = { ...next[i], label: e.target.value };
                      setSettings({ ...settings, header_links: next });
                    }} />
                    <Input placeholder="https://…" value={l.url ?? ""} onChange={(e) => {
                      const next = [...(settings.header_links ?? [])];
                      next[i] = { ...next[i], url: e.target.value };
                      setSettings({ ...settings, header_links: next });
                    }} />
                    <label className="flex items-center gap-1 text-xs">
                      <Switch checked={!!l.open_in_new_tab} onCheckedChange={(v) => {
                        const next = [...(settings.header_links ?? [])];
                        next[i] = { ...next[i], open_in_new_tab: v };
                        setSettings({ ...settings, header_links: next });
                      }} />
                      New tab
                    </label>
                    <Button variant="ghost" size="icon" onClick={() => {
                      const next = [...(settings.header_links ?? [])];
                      next.splice(i, 1);
                      setSettings({ ...settings, header_links: next });
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setSettings({
                  ...settings,
                  header_links: [...(settings.header_links ?? []), { label: "", url: "", open_in_new_tab: false }],
                })}><Plus className="h-4 w-4 mr-1" />Add link</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Footer columns</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(settings.footer_columns ?? []).map((col: any, ci: number) => (
                  <div key={ci} className="border rounded-md p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <Input placeholder="Column title" value={col.title ?? ""} onChange={(e) => {
                        const next = [...(settings.footer_columns ?? [])];
                        next[ci] = { ...next[ci], title: e.target.value };
                        setSettings({ ...settings, footer_columns: next });
                      }} />
                      <Button variant="ghost" size="icon" onClick={() => {
                        const next = [...(settings.footer_columns ?? [])];
                        next.splice(ci, 1);
                        setSettings({ ...settings, footer_columns: next });
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    {(col.links ?? []).map((l: any, li: number) => (
                      <div key={li} className="grid md:grid-cols-[1fr_2fr_auto] gap-2">
                        <Input placeholder="Label" value={l.label ?? ""} onChange={(e) => {
                          const next = [...(settings.footer_columns ?? [])];
                          const links = [...(next[ci].links ?? [])];
                          links[li] = { ...links[li], label: e.target.value };
                          next[ci] = { ...next[ci], links };
                          setSettings({ ...settings, footer_columns: next });
                        }} />
                        <Input placeholder="https://…" value={l.url ?? ""} onChange={(e) => {
                          const next = [...(settings.footer_columns ?? [])];
                          const links = [...(next[ci].links ?? [])];
                          links[li] = { ...links[li], url: e.target.value };
                          next[ci] = { ...next[ci], links };
                          setSettings({ ...settings, footer_columns: next });
                        }} />
                        <Button variant="ghost" size="icon" onClick={() => {
                          const next = [...(settings.footer_columns ?? [])];
                          const links = [...(next[ci].links ?? [])];
                          links.splice(li, 1);
                          next[ci] = { ...next[ci], links };
                          setSettings({ ...settings, footer_columns: next });
                        }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => {
                      const next = [...(settings.footer_columns ?? [])];
                      next[ci] = { ...next[ci], links: [...(next[ci].links ?? []), { label: "", url: "" }] };
                      setSettings({ ...settings, footer_columns: next });
                    }}><Plus className="h-4 w-4 mr-1" />Add link</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setSettings({
                  ...settings,
                  footer_columns: [...(settings.footer_columns ?? []), { title: "", links: [] }],
                })}><Plus className="h-4 w-4 mr-1" />Add column</Button>
                <div className="pt-2">
                  <Label>Footer note (copyright, address, etc.)</Label>
                  <Input value={settings.footer_note ?? ""} onChange={(e) => setSettings({ ...settings, footer_note: e.target.value })} />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save CMS</Button>
            </div>
          </TabsContent>

          <TabsContent value="widget" className="space-y-4">
            <BookingWidgetTab
              slug={property?.booking_custom_slug || property?.booking_public_slug}
              siteTypes={siteTypes}
              config={settings.widget_config ?? {}}
              onChange={(cfg) => setSettings({ ...settings, widget_config: cfg })}
              onSave={saveSettings}
              saving={saving}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function GalleryTile({ asset, onDelete, onCaption, isHero, onSetHero, isBackground, onSetBackground }: { asset: any; onDelete: () => void; onCaption: (c: string) => void; isHero?: boolean; onSetHero?: () => void; isBackground?: boolean; onSetBackground?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.storage.from("booking-gallery").createSignedUrl(asset.storage_path, 3600).then(({ data }) => {
      if (alive && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { alive = false; };
  }, [asset.storage_path]);
  return (
    <Card className={`overflow-hidden group relative ${isHero ? "ring-2 ring-primary" : isBackground ? "ring-2 ring-amber-500" : ""}`}>
      {url ? (
        <img src={url} alt={asset.caption ?? ""} className="w-full aspect-square object-cover" />
      ) : (
        <div className="aspect-square flex items-center justify-center bg-muted"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>
      )}
      <div className="absolute top-2 left-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
        <div className="flex items-center justify-between gap-1">
          {onSetHero && (
            <Button size="sm" variant={isHero ? "default" : "secondary"} className="h-7 text-xs" onClick={onSetHero}>
              {isHero ? "★ Main image" : "Set as main"}
            </Button>
          )}
          <Button size="icon" variant="destructive" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        {onSetBackground && (
          <Button size="sm" variant={isBackground ? "default" : "secondary"} className="h-7 text-xs w-full" onClick={onSetBackground}>
            {isBackground ? "✓ Background" : "Set as background"}
          </Button>
        )}
      </div>
      <div className="p-2">
        <Input
          placeholder="Caption"
          defaultValue={asset.caption ?? ""}
          onBlur={(e) => e.target.value !== (asset.caption ?? "") && onCaption(e.target.value)}
        />
      </div>
    </Card>
  );
}

function BookingWidgetTab({
  slug, siteTypes, config, onChange, onSave, saving,
}: {
  slug?: string | null;
  siteTypes: any[];
  config: any;
  onChange: (cfg: any) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const engineUrl = slug ? `${origin}/b/${slug}` : "";
  const widgetUrl = `${origin}/booking-widget.js`;
  const cfg = {
    theme: config?.theme ?? "light",
    button_text: config?.button_text ?? "Check availability",
    button_color: config?.button_color ?? "#0f766e",
    show_site_type: config?.show_site_type ?? true,
    show_guests: config?.show_guests ?? true,
    layout: config?.layout ?? "inline",
    ...config,
  };
  const siteTypesJson = JSON.stringify(
    siteTypes.map((st) => ({ id: st.id, name: st.name })),
  ).replace(/"/g, "&quot;");

  const embed = slug
    ? `<!-- Trailblazer Booking Widget -->
<div id="tbz-booking-widget"></div>
<script
  src="${widgetUrl}"
  data-engine-url="${engineUrl}"
  data-theme="${cfg.theme}"
  data-layout="${cfg.layout}"
  data-button-text="${cfg.button_text}"
  data-button-color="${cfg.button_color}"
  data-show-site-type="${cfg.show_site_type}"
  data-show-guests="${cfg.show_guests}"
  data-site-types="${siteTypesJson}"
  async
></script>`
    : "";

  function copy() {
    navigator.clipboard.writeText(embed);
    toast.success("Embed code copied");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Widget appearance</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Layout</Label>
            <Select value={cfg.layout} onValueChange={(v) => onChange({ ...cfg, layout: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inline">Inline (horizontal bar)</SelectItem>
                <SelectItem value="stacked">Stacked (vertical card)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Theme</Label>
            <Select value={cfg.theme} onValueChange={(v) => onChange({ ...cfg, theme: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Button text</Label>
            <Input value={cfg.button_text} onChange={(e) => onChange({ ...cfg, button_text: e.target.value })} />
          </div>
          <div>
            <Label>Button color</Label>
            <Input type="color" value={cfg.button_color} onChange={(e) => onChange({ ...cfg, button_color: e.target.value })} />
          </div>
          <label className="flex items-center gap-2">
            <Switch checked={cfg.show_site_type} onCheckedChange={(v) => onChange({ ...cfg, show_site_type: v })} />
            <span className="text-sm">Show site-type selector</span>
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={cfg.show_guests} onCheckedChange={(v) => onChange({ ...cfg, show_guests: v })} />
            <span className="text-sm">Show guest count selector</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Embed code</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!slug ? (
            <p className="text-sm text-muted-foreground">Publish your booking engine (assign a slug) to generate the embed code.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Paste this into your website. It renders a search form; when the guest submits,
                they're sent straight to your booking engine with the dates pre-filled and availability already running.
              </p>
              <Textarea rows={12} readOnly value={embed} className="font-mono text-xs" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={copy}><Copy className="h-4 w-4 mr-2" />Copy embed</Button>
                <Button onClick={onSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save widget settings</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SiteTypeImageEditor({
  siteType,
  onUpload,
  onRemove,
}: {
  siteType: any;
  onUpload: (file: File) => Promise<void> | void;
  onRemove: () => Promise<void> | void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!siteType.image_path) { setPreviewUrl(null); return; }
    supabase.storage
      .from("booking-gallery")
      .createSignedUrl(siteType.image_path, 3600)
      .then(({ data }) => { if (active) setPreviewUrl(data?.signedUrl ?? null); });
    return () => { active = false; };
  }, [siteType.image_path]);

  return (
    <div className="flex items-start gap-4 rounded-lg border bg-muted/30 p-3">
      <div className="h-24 w-40 shrink-0 overflow-hidden rounded-md bg-muted flex items-center justify-center">
        {previewUrl ? (
          <img src={previewUrl} alt={siteType.name} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        <div>
          <Label className="text-sm">Site type photo</Label>
          <p className="text-xs text-muted-foreground">Shown on the booking engine result card for this site type. Recommended 1200×800.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={async (e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                if (!file) return;
                setBusy(true);
                try { await onUpload(file); } finally { setBusy(false); input.value = ""; }
              }}
            />
            <Button asChild size="sm" variant="outline" disabled={busy}>
              <span>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ImageIcon className="h-4 w-4 mr-2" />}{siteType.image_path ? "Replace image" : "Upload image"}</span>
            </Button>
          </label>
          {siteType.image_path && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { await onRemove(); } finally { setBusy(false); } }}>
              <Trash2 className="h-4 w-4 mr-2" />Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
