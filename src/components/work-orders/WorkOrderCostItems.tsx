import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type CostType = Database["public"]["Enums"]["wo_cost_type"];

const COST_TYPE_LABELS: Record<CostType, string> = {
  parts: "Parts",
  labor: "Labor",
  external_vendor: "External Vendor",
  other: "Other",
};

interface CostItem {
  id: string;
  cost_type: CostType;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number | null;
  vendor_name: string | null;
  incurred_on: string;
}

interface Props {
  workOrderId: string;
  onTotalChange?: (total: number) => void;
}

export const WorkOrderCostItems = ({ workOrderId, onTotalChange }: Props) => {
  const { selectedProperty } = useProperty();
  const [items, setItems] = useState<CostItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    cost_type: "parts" as CostType,
    description: "",
    quantity: "1",
    unit_cost: "",
    vendor_name: "",
    incurred_on: new Date().toISOString().slice(0, 10),
  });

  const load = async () => {
    const { data, error } = await supabase
      .from("work_order_cost_items")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("incurred_on", { ascending: false });
    if (error) {
      toast.error("Failed to load cost items");
      return;
    }
    const rows = (data || []) as CostItem[];
    setItems(rows);
    const total = rows.reduce((s, r) => s + Number(r.total_cost || 0), 0);
    onTotalChange?.(total);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  const handleAdd = async () => {
    if (!selectedProperty?.id) return;
    if (!form.description.trim()) return toast.error("Description required");
    const qty = Number(form.quantity);
    const unit = Number(form.unit_cost);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error("Invalid quantity");
    if (!Number.isFinite(unit) || unit < 0) return toast.error("Invalid unit cost");

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;

    const { error } = await supabase.from("work_order_cost_items").insert({
      work_order_id: workOrderId,
      property_id: selectedProperty.id,
      cost_type: form.cost_type,
      description: form.description.trim(),
      quantity: qty,
      unit_cost: unit,
      vendor_name: form.vendor_name.trim() || null,
      incurred_on: form.incurred_on,
      created_by_user_id: uid,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setAdding(false);
    setForm({
      cost_type: "parts",
      description: "",
      quantity: "1",
      unit_cost: "",
      vendor_name: "",
      incurred_on: new Date().toISOString().slice(0, 10),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this cost item?")) return;
    const { error } = await supabase
      .from("work_order_cost_items")
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const subtotals = items.reduce(
    (acc, it) => {
      acc[it.cost_type] = (acc[it.cost_type] || 0) + Number(it.total_cost || 0);
      acc.total += Number(it.total_cost || 0);
      return acc;
    },
    { parts: 0, labor: 0, external_vendor: 0, other: 0, total: 0 } as Record<string, number>,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {(["parts", "labor", "external_vendor", "other"] as CostType[]).map((t) => (
          <Card key={t} className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {COST_TYPE_LABELS[t]}
            </div>
            <div className="text-lg font-bold tabular-nums">
              ${subtotals[t].toFixed(2)}
            </div>
          </Card>
        ))}
        <Card className="p-3 bg-primary/5 border-primary/30">
          <div className="text-[10px] uppercase tracking-wider text-primary font-semibold">Total</div>
          <div className="text-lg font-bold tabular-nums text-primary">
            ${subtotals.total.toFixed(2)}
          </div>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Cost items</h3>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add cost
          </Button>
        )}
      </div>

      {adding && (
        <Card className="p-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.cost_type}
                onValueChange={(v) => setForm({ ...form, cost_type: v as CostType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(COST_TYPE_LABELS) as CostType[]).map((c) => (
                    <SelectItem key={c} value={c}>{COST_TYPE_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Incurred on</Label>
              <Input
                type="date"
                value={form.incurred_on}
                onChange={(e) => setForm({ ...form, incurred_on: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Replacement 30A breaker"
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Qty</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit cost</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor (optional)</Label>
              <Input
                value={form.vendor_name}
                onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                placeholder="Home Depot"
                maxLength={100}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd}>Save cost</Button>
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No cost items yet.
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="whitespace-nowrap">{it.incurred_on}</TableCell>
                  <TableCell>{COST_TYPE_LABELS[it.cost_type]}</TableCell>
                  <TableCell>{it.description}</TableCell>
                  <TableCell className="text-muted-foreground">{it.vendor_name || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{it.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">${Number(it.unit_cost).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    ${Number(it.total_cost || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(it.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};
