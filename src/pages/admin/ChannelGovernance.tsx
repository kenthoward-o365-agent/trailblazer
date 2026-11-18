import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Radio } from "lucide-react";
import { toast } from "sonner";

interface Org { id: string; name: string; }
interface Brand { id: string; name: string; organization_id: string; }
interface Policy {
  id?: string;
  organization_id: string;
  brand_id: string | null;
  allowed_channels: string[];
  parity_enforced: boolean;
  notes: string | null;
}

const KNOWN_CHANNELS = [
  { key: "expedia", label: "Expedia" },
  { key: "booking_com", label: "Booking.com" },
  { key: "airbnb", label: "Airbnb" },
  { key: "google_hotel_ads", label: "Google Hotel Ads" },
  { key: "brand_direct", label: "Brand direct (brand.com)" },
];

export default function ChannelGovernance() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [brandId, setBrandId] = useState<string>("__none");
  const [policy, setPolicy] = useState<Policy | null>(null);

  useEffect(() => {
    (async () => {
      const [o, b] = await Promise.all([
        supabase.from("organizations").select("id,name").order("name"),
        supabase.from("brands").select("id,name,organization_id").order("name"),
      ]);
      setOrgs(o.data ?? []); setBrands(b.data ?? []);
      if (o.data && o.data.length > 0) setOrgId(o.data[0].id);
    })();
  }, []);

  useEffect(() => { if (orgId) loadPolicy(); }, [orgId, brandId]);

  async function loadPolicy() {
    let q = supabase.from("channel_governance_policies").select("*").eq("organization_id", orgId);
    q = brandId === "__none" ? q.is("brand_id", null) : q.eq("brand_id", brandId);
    const { data } = await q.maybeSingle();
    if (data) {
      setPolicy({
        ...data,
        allowed_channels: Array.isArray(data.allowed_channels) ? data.allowed_channels as string[] : [],
      });
    } else {
      setPolicy({
        organization_id: orgId,
        brand_id: brandId === "__none" ? null : brandId,
        allowed_channels: [],
        parity_enforced: true,
        notes: "",
      });
    }
  }

  async function save() {
    if (!policy) return;
    const payload: any = {
      organization_id: policy.organization_id,
      brand_id: policy.brand_id,
      allowed_channels: policy.allowed_channels,
      parity_enforced: policy.parity_enforced,
      notes: policy.notes,
    };
    const { error } = policy.id
      ? await supabase.from("channel_governance_policies").update(payload).eq("id", policy.id)
      : await supabase.from("channel_governance_policies").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Policy saved");
    loadPolicy();
  }

  const filteredBrands = useMemo(() => brands.filter((b) => b.organization_id === orgId), [brands, orgId]);

  function toggleChannel(key: string, on: boolean) {
    if (!policy) return;
    const set = new Set(policy.allowed_channels);
    on ? set.add(key) : set.delete(key);
    setPolicy({ ...policy, allowed_channels: Array.from(set) });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Radio className="h-7 w-7" /> Channel Governance</h1>
          <p className="text-muted-foreground">Bulk-enable channels and enforce parity per brand.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Scope</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Organization</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Brand (optional)</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Organization-wide default</SelectItem>
                  {filteredBrands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {policy && (
          <Card>
            <CardHeader><CardTitle>Policy</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label>Allowed channels</Label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {KNOWN_CHANNELS.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 border rounded p-2">
                      <Checkbox
                        checked={policy.allowed_channels.includes(c.key)}
                        onCheckedChange={(v) => toggleChannel(c.key, !!v)}
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={policy.parity_enforced}
                  onCheckedChange={(v) => setPolicy({ ...policy, parity_enforced: v })} />
                <div>
                  <div className="font-medium">Enforce rate parity</div>
                  <div className="text-sm text-muted-foreground">Require identical rates across enabled channels for this scope.</div>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={policy.notes ?? ""} onChange={(e) => setPolicy({ ...policy, notes: e.target.value })} />
              </div>

              <Button onClick={save}>Save policy</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
