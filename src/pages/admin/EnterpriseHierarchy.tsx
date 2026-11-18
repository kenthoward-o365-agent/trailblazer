import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { useEnterpriseAccess } from "@/hooks/useEnterpriseAccess";

interface Brand { id: string; organization_id: string; name: string; code: string | null; description: string | null; is_active: boolean; }
interface Region { id: string; brand_id: string; organization_id: string; name: string; code: string | null; description: string | null; is_active: boolean; }
interface Property { id: string; name: string; organization_id: string; brand_id: string | null; region_id: string | null; }
interface Org { id: string; name: string; }

export default function EnterpriseHierarchy() {
  const access = useEnterpriseAccess();
  const [tab, setTab] = useState("brands");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  const [brandForm, setBrandForm] = useState({ name: "", code: "", description: "" });
  const [regionForm, setRegionForm] = useState({ name: "", code: "", brand_id: "", description: "" });

  useEffect(() => { loadOrgs(); }, [access.loading]);
  useEffect(() => { if (orgId) loadAll(orgId); }, [orgId]);

  async function loadOrgs() {
    if (access.loading) return;
    const { data } = await supabase.from("organizations").select("id,name").order("name");
    setOrgs(data ?? []);
    if (!orgId && (data ?? []).length) setOrgId(access.organizationId ?? data![0].id);
  }

  async function loadAll(oid: string) {
    const [b, r, p] = await Promise.all([
      supabase.from("brands").select("*").eq("organization_id", oid).order("name"),
      supabase.from("regions").select("*").eq("organization_id", oid).order("name"),
      supabase.from("properties").select("id,name,organization_id,brand_id,region_id").eq("organization_id", oid).order("name"),
    ]);
    setBrands((b.data ?? []) as Brand[]);
    setRegions((r.data ?? []) as Region[]);
    setProperties((p.data ?? []) as Property[]);
  }

  async function createBrand() {
    if (!orgId || !brandForm.name) return;
    const { error } = await supabase.from("brands").insert({
      organization_id: orgId, name: brandForm.name, code: brandForm.code || null, description: brandForm.description || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Brand created");
    setBrandForm({ name: "", code: "", description: "" });
    setBrandDialogOpen(false);
    loadAll(orgId);
  }

  async function createRegion() {
    if (!orgId || !regionForm.name || !regionForm.brand_id) return;
    const { error } = await supabase.from("regions").insert({
      organization_id: orgId, brand_id: regionForm.brand_id, name: regionForm.name,
      code: regionForm.code || null, description: regionForm.description || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Region created");
    setRegionForm({ name: "", code: "", brand_id: "", description: "" });
    setRegionDialogOpen(false);
    loadAll(orgId);
  }

  async function updateProperty(propertyId: string, patch: Partial<Property>) {
    const { error } = await supabase.from("properties").update(patch).eq("id", propertyId);
    if (error) return toast.error(error.message);
    if (orgId) loadAll(orgId);
  }

  if (access.loading) return <DashboardLayout><div className="p-8">Loading…</div></DashboardLayout>;
  if (!access.isSuperAdmin && !access.isOrgAdmin) {
    return <DashboardLayout><div className="p-8">You need Organization Admin or Super Admin access to manage the enterprise hierarchy.</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Enterprise Hierarchy</h1>
            <p className="text-muted-foreground">Manage Brands, Regions, and Property assignments across the portfolio.</p>
          </div>
          {access.isSuperAdmin && orgs.length > 1 && (
            <div className="w-64">
              <Label>Organization</Label>
              <Select value={orgId ?? ""} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="brands"><Building2 className="w-4 h-4 mr-1" />Brands</TabsTrigger>
            <TabsTrigger value="regions"><MapIcon className="w-4 h-4 mr-1" />Regions</TabsTrigger>
            <TabsTrigger value="properties">Property Assignment</TabsTrigger>
          </TabsList>

          <TabsContent value="brands" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Brands</CardTitle>
                <Button size="sm" onClick={() => setBrandDialogOpen(true)}><Plus className="w-4 h-4 mr-1" />New Brand</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Description</TableHead><TableHead>Regions</TableHead><TableHead>Properties</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {brands.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No brands yet. Create one to begin structuring your portfolio (e.g. "Thousand Trails", "Encore RV").</TableCell></TableRow>}
                    {brands.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell>{b.code ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{b.description ?? ""}</TableCell>
                        <TableCell>{regions.filter((r) => r.brand_id === b.id).length}</TableCell>
                        <TableCell>{properties.filter((p) => p.brand_id === b.id).length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="regions" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Regions</CardTitle>
                <Button size="sm" onClick={() => setRegionDialogOpen(true)} disabled={brands.length === 0}>
                  <Plus className="w-4 h-4 mr-1" />New Region
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Brand</TableHead><TableHead>Properties</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {regions.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No regions yet. Create a brand first, then add regions (e.g. "Northwest", "Southeast").</TableCell></TableRow>}
                    {regions.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.code ?? "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{brands.find((b) => b.id === r.brand_id)?.name ?? "—"}</Badge></TableCell>
                        <TableCell>{properties.filter((p) => p.region_id === r.id).length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="properties" className="mt-6">
            <Card>
              <CardHeader><CardTitle>Assign Properties to Brand & Region</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Property</TableHead><TableHead>Brand</TableHead><TableHead>Region</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {properties.map((p) => {
                      const brandRegions = regions.filter((r) => r.brand_id === p.brand_id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>
                            <Select
                              value={p.brand_id ?? "__none"}
                              onValueChange={(v) => updateProperty(p.id, { brand_id: v === "__none" ? null : v, region_id: null })}
                            >
                              <SelectTrigger className="w-56"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none">Unassigned</SelectItem>
                                {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={p.region_id ?? "__none"}
                              onValueChange={(v) => updateProperty(p.id, { region_id: v === "__none" ? null : v })}
                              disabled={!p.brand_id}
                            >
                              <SelectTrigger className="w-56"><SelectValue placeholder={p.brand_id ? "Unassigned" : "Choose brand first"} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none">Unassigned</SelectItem>
                                {brandRegions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Brand</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={brandForm.name} onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })} placeholder="Thousand Trails" /></div>
              <div><Label>Code</Label><Input value={brandForm.code} onChange={(e) => setBrandForm({ ...brandForm, code: e.target.value })} placeholder="TT" /></div>
              <div><Label>Description</Label><Input value={brandForm.description} onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setBrandDialogOpen(false)}>Cancel</Button>
              <Button onClick={createBrand} disabled={!brandForm.name}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={regionDialogOpen} onOpenChange={setRegionDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Region</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Brand *</Label>
                <Select value={regionForm.brand_id} onValueChange={(v) => setRegionForm({ ...regionForm, brand_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Name *</Label><Input value={regionForm.name} onChange={(e) => setRegionForm({ ...regionForm, name: e.target.value })} placeholder="Northwest" /></div>
              <div><Label>Code</Label><Input value={regionForm.code} onChange={(e) => setRegionForm({ ...regionForm, code: e.target.value })} placeholder="NW" /></div>
              <div><Label>Description</Label><Input value={regionForm.description} onChange={(e) => setRegionForm({ ...regionForm, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRegionDialogOpen(false)}>Cancel</Button>
              <Button onClick={createRegion} disabled={!regionForm.name || !regionForm.brand_id}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
