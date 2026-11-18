import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProperty } from "@/contexts/PropertyContext";
import { SiteCustomAttributesManager } from "@/components/SiteCustomAttributesManager";

interface SiteType {
  id: string;
  name: string;
  code: string | null;
  base_price: number;
  description: string | null;
  max_adults: number | null;
  max_children: number | null;
  site_count?: number;
}

const empty = {
  name: "",
  code: "",
  base_price: 0,
  description: "",
  max_adults: 2,
  max_children: 2,
};

export default function SiteTypesSettings() {
  const { selectedProperty } = useProperty();
  const [rows, setRows] = useState<SiteType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SiteType | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const propertyId = selectedProperty?.id;

  const load = async () => {
    if (!propertyId) return;
    setLoading(true);
    const { data: types, error } = await supabase
      .from("site_types")
      .select("id,name,code,base_price,description,max_adults,max_children")
      .eq("property_id", propertyId)
      .order("name");
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const { data: sites } = await supabase
      .from("sites")
      .select("site_type_id")
      .eq("property_id", propertyId);
    const counts = new Map<string, number>();
    (sites ?? []).forEach((s: any) => {
      if (s.site_type_id) counts.set(s.site_type_id, (counts.get(s.site_type_id) ?? 0) + 1);
    });
    setRows((types ?? []).map((t: any) => ({ ...t, site_count: counts.get(t.id) ?? 0 })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (r: SiteType) => {
    setEditing(r);
    setForm({
      name: r.name,
      code: r.code ?? "",
      base_price: Number(r.base_price ?? 0),
      description: r.description ?? "",
      max_adults: r.max_adults ?? 2,
      max_children: r.max_children ?? 2,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!propertyId) return;
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const payload = {
        property_id: propertyId,
        name: form.name.trim(),
        code: form.code.trim() ? form.code.trim().toUpperCase() : form.name.slice(0, 4).toUpperCase(),
        base_price: Number(form.base_price) || 0,
        description: form.description.trim() || null,
        max_adults: Number(form.max_adults) || null,
        max_children: Number(form.max_children) || null,
      };
      if (editing) {
        const { error } = await supabase.from("site_types").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Site type updated");
      } else {
        const { error } = await supabase.from("site_types").insert(payload as any);
        if (error) throw error;
        toast.success("Site type created");
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: SiteType) => {
    if ((r.site_count ?? 0) > 0) {
      toast.error(`Cannot delete — ${r.site_count} site(s) still use this type`);
      return;
    }
    if (!confirm(`Delete site type "${r.name}"?`)) return;
    const { error } = await supabase.from("site_types").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Site Types</h1>
            <p className="text-sm text-muted-foreground">
              Manage the categories of sites available at your property (e.g. RV Back-In, Tent, Cabin).
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> New Site Type
          </Button>
        </div>

        {propertyId && <SiteCustomAttributesManager propertyId={propertyId} />}



        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="text-right">Base Price</TableHead>
                <TableHead className="text-right">Max Adults</TableHead>
                <TableHead className="text-right">Max Children</TableHead>
                <TableHead className="text-right">Sites</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No site types yet.</TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.code ?? "—"}</TableCell>
                  <TableCell className="text-right">${Number(r.base_price ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{r.max_adults ?? "—"}</TableCell>
                  <TableCell className="text-right">{r.max_children ?? "—"}</TableCell>
                  <TableCell className="text-right">{r.site_count ?? 0}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(r)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Site Type" : "New Site Type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. RV Back-In" />
              </div>
              <div>
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Auto" />
              </div>
              <div>
                <Label>Base Price</Label>
                <Input type="number" step="0.01" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Max Adults</Label>
                <Input type="number" value={form.max_adults} onChange={(e) => setForm({ ...form, max_adults: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Max Children</Label>
                <Input type="number" value={form.max_children} onChange={(e) => setForm({ ...form, max_children: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
