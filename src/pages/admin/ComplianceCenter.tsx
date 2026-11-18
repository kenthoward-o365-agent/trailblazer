import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Org = { id: string; name: string };
type Settings = {
  organization_id: string;
  data_residency: "US" | "CA" | "EU";
  byok_enabled: boolean;
  byok_key_reference: string | null;
  dpa_url: string | null;
  subprocessors_url: string | null;
  soc2_readiness_state: "not_started" | "in_progress" | "ready" | "certified";
  security_contact_email: string | null;
  incident_response_url: string | null;
};

export default function ComplianceCenter() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("organizations").select("id,name").order("name").then(({ data }) => {
      setOrgs(data ?? []);
      if (data?.[0]) setOrgId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!orgId) return;
    supabase.from("org_compliance_settings").select("*").eq("organization_id", orgId).maybeSingle()
      .then(({ data }) => {
        setS(data as Settings ?? {
          organization_id: orgId,
          data_residency: "US",
          byok_enabled: false,
          byok_key_reference: null,
          dpa_url: null,
          subprocessors_url: null,
          soc2_readiness_state: "in_progress",
          security_contact_email: null,
          incident_response_url: null,
        });
      });
  }, [orgId]);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase.from("org_compliance_settings").upsert(s);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Compliance settings saved");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compliance Center</h1>
        <p className="text-muted-foreground">Data residency, BYOK, SOC 2 readiness and DPA links per organization.</p>
      </div>

      <div className="max-w-md">
        <Label>Organization</Label>
        <Select value={orgId} onValueChange={setOrgId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {s && (
        <Card>
          <CardHeader><CardTitle>Trust & Compliance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Residency</Label>
                <Select value={s.data_residency} onValueChange={v => setS({ ...s, data_residency: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="EU">European Union</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>SOC 2 Readiness</Label>
                <Select value={s.soc2_readiness_state} onValueChange={v => setS({ ...s, soc2_readiness_state: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not started</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="certified">Certified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded border p-3">
              <div>
                <div className="font-medium">Customer-managed encryption (BYOK)</div>
                <div className="text-sm text-muted-foreground">Provide a KMS key reference to encrypt this org's exports.</div>
              </div>
              <Switch checked={s.byok_enabled} onCheckedChange={v => setS({ ...s, byok_enabled: v })} />
            </div>

            {s.byok_enabled && (
              <div>
                <Label>KMS Key Reference (ARN / URI)</Label>
                <Input value={s.byok_key_reference ?? ""} onChange={e => setS({ ...s, byok_key_reference: e.target.value })} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>DPA URL</Label>
                <Input value={s.dpa_url ?? ""} onChange={e => setS({ ...s, dpa_url: e.target.value })} placeholder="https://…/dpa.pdf" />
              </div>
              <div>
                <Label>Subprocessors URL</Label>
                <Input value={s.subprocessors_url ?? ""} onChange={e => setS({ ...s, subprocessors_url: e.target.value })} />
              </div>
              <div>
                <Label>Security Contact Email</Label>
                <Input value={s.security_contact_email ?? ""} onChange={e => setS({ ...s, security_contact_email: e.target.value })} />
              </div>
              <div>
                <Label>Incident Response URL</Label>
                <Input value={s.incident_response_url ?? ""} onChange={e => setS({ ...s, incident_response_url: e.target.value })} />
              </div>
            </div>

            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
