import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useInternalUser } from "@/hooks/useInternalUser";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Rocket, ExternalLink, Copy, RefreshCw, Loader2, Globe } from "lucide-react";

interface Row {
  id: string;
  name: string;
  organization_name: string | null;
  booking_engine_enabled: boolean;
  booking_public_slug: string | null;
  booking_custom_slug: string | null;
  booking_custom_domain: string | null;
}

export default function AdminBookingEngine() {
  const { isInternalUser, loading } = useInternalUser();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [customSlug, setCustomSlug] = useState<Record<string, string>>({});
  const [customDomain, setCustomDomain] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !isInternalUser) navigate("/");
  }, [loading, isInternalUser, navigate]);

  useEffect(() => {
    if (isInternalUser) load();
  }, [isInternalUser]);

  async function load() {
    setLoadingRows(true);
    const { data } = await supabase
      .from("properties")
      .select("id, name, booking_engine_enabled, booking_public_slug, booking_custom_slug, booking_custom_domain, organization:organizations(name)")
      .order("name");
    const mapped: Row[] = (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      organization_name: r.organization?.name ?? null,
      booking_engine_enabled: r.booking_engine_enabled,
      booking_public_slug: r.booking_public_slug,
      booking_custom_slug: r.booking_custom_slug,
      booking_custom_domain: r.booking_custom_domain,
    }));
    setRows(mapped);
    setCustomSlug(Object.fromEntries(mapped.map((r) => [r.id, r.booking_custom_slug ?? ""])));
    setCustomDomain(Object.fromEntries(mapped.map((r) => [r.id, r.booking_custom_domain ?? ""])));
    setLoadingRows(false);
  }

  async function toggle(row: Row, next: boolean) {
    setSaving(row.id);
    const patch: any = { booking_engine_enabled: next };
    if (next && !row.booking_public_slug) {
      const { data: slug } = await supabase.rpc("generate_booking_public_slug");
      patch.booking_public_slug = slug;
    }
    const { error } = await supabase.from("properties").update(patch).eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success(next ? "Booking engine enabled" : "Booking engine disabled");
      await load();
    }
    setSaving(null);
  }

  async function regenerateSlug(row: Row) {
    setSaving(row.id);
    const { data: slug } = await supabase.rpc("generate_booking_public_slug");
    const { error } = await supabase.from("properties").update({ booking_public_slug: slug }).eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success("New URL generated");
      await load();
    }
    setSaving(null);
  }

  async function saveCustom(row: Row) {
    setSaving(row.id);
    const slug = customSlug[row.id]?.trim() || null;
    const domain = customDomain[row.id]?.trim() || null;
    const { error } = await supabase
      .from("properties")
      .update({ booking_custom_slug: slug, booking_custom_domain: domain })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      await load();
    }
    setSaving(null);
  }

  const publicUrl = (slug: string | null) =>
    slug ? `${window.location.origin}/b/${slug}` : "";

  if (loading) return <DashboardLayout><div className="p-8">Loading…</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Rocket className="h-7 w-7" /> Booking Engines
          </h1>
          <p className="text-muted-foreground mt-1">
            Provision and manage the public-facing booking site for each property.
          </p>
        </div>

        {loadingRows ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading properties…</div>
        ) : (
          <div className="grid gap-4">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {row.name}
                        {row.booking_engine_enabled ? (
                          <Badge variant="default">Live</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{row.organization_name ?? "—"}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Enable</Label>
                      <Switch
                        checked={row.booking_engine_enabled}
                        onCheckedChange={(v) => toggle(row, v)}
                        disabled={saving === row.id}
                      />
                    </div>
                  </div>
                </CardHeader>
                {row.booking_engine_enabled && (
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs uppercase text-muted-foreground">Secure Public URL</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input readOnly value={publicUrl(row.booking_public_slug)} className="font-mono text-sm" />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(publicUrl(row.booking_public_slug));
                            toast.success("Copied");
                          }}
                        ><Copy className="h-4 w-4" /></Button>
                        <Button size="icon" variant="outline" asChild>
                          <a href={publicUrl(row.booking_public_slug)} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                        <Button size="icon" variant="outline" onClick={() => regenerateSlug(row)} disabled={saving === row.id}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs uppercase text-muted-foreground">Vanity slug (optional)</Label>
                        <Input
                          value={customSlug[row.id] ?? ""}
                          onChange={(e) => setCustomSlug((s) => ({ ...s, [row.id]: e.target.value }))}
                          placeholder="e.g. sunrise-rv"
                        />
                        {customSlug[row.id] && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {window.location.origin}/b/{customSlug[row.id]}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs uppercase text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Custom domain (optional)
                        </Label>
                        <Input
                          value={customDomain[row.id] ?? ""}
                          onChange={(e) => setCustomDomain((s) => ({ ...s, [row.id]: e.target.value }))}
                          placeholder="book.example.com"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => saveCustom(row)} disabled={saving === row.id}>
                        Save routing
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
