import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Brand = { id: string; name: string };
type WL = {
  brand_id: string;
  custom_domain: string | null;
  sender_email: string | null;
  sender_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  is_active: boolean;
};

export default function BrandWhiteLabel() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState<string>("");
  const [w, setW] = useState<WL | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("brands").select("id,name").order("name").then(({ data }) => {
      setBrands(data ?? []);
      if (data?.[0]) setBrandId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!brandId) return;
    supabase.from("brand_white_label").select("*").eq("brand_id", brandId).maybeSingle()
      .then(({ data }) => setW(data as WL ?? {
        brand_id: brandId, custom_domain: null, sender_email: null, sender_name: null,
        logo_url: null, favicon_url: null, primary_color: null, accent_color: null, is_active: false,
      }));
  }, [brandId]);

  const save = async () => {
    if (!w) return;
    setSaving(true);
    const { error } = await supabase.from("brand_white_label").upsert(w);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("White-label saved");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Brand White-Label</h1>
        <p className="text-muted-foreground">Custom domain, email sender, and theme per brand.</p>
      </div>

      <div className="max-w-md">
        <Label>Brand</Label>
        <Select value={brandId} onValueChange={setBrandId}>
          <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
          <SelectContent>{brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {w && (
        <Card>
          <CardHeader><CardTitle>White-label config</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded border p-3">
              <div className="font-medium">Active</div>
              <Switch checked={w.is_active} onCheckedChange={v => setW({ ...w, is_active: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Custom domain</Label><Input value={w.custom_domain ?? ""} onChange={e => setW({ ...w, custom_domain: e.target.value })} placeholder="book.brand.com" /></div>
              <div><Label>Sender email</Label><Input value={w.sender_email ?? ""} onChange={e => setW({ ...w, sender_email: e.target.value })} placeholder="reservations@brand.com" /></div>
              <div><Label>Sender name</Label><Input value={w.sender_name ?? ""} onChange={e => setW({ ...w, sender_name: e.target.value })} /></div>
              <div><Label>Logo URL</Label><Input value={w.logo_url ?? ""} onChange={e => setW({ ...w, logo_url: e.target.value })} /></div>
              <div><Label>Favicon URL</Label><Input value={w.favicon_url ?? ""} onChange={e => setW({ ...w, favicon_url: e.target.value })} /></div>
              <div><Label>Primary color</Label><Input value={w.primary_color ?? ""} onChange={e => setW({ ...w, primary_color: e.target.value })} placeholder="#123456" /></div>
              <div><Label>Accent color</Label><Input value={w.accent_color ?? ""} onChange={e => setW({ ...w, accent_color: e.target.value })} placeholder="#abcdef" /></div>
            </div>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
