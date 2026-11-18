import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface CustomAttribute {
  id: string;
  property_id: string;
  name: string;
  code: string;
  data_type: "boolean" | "number" | "text";
  enforce_on_booking: boolean;
  sort_order: number;
}

interface Props {
  propertyId: string;
  onChange?: (attrs: CustomAttribute[]) => void;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

export function SiteCustomAttributesManager({ propertyId, onChange }: Props) {
  const [rows, setRows] = useState<CustomAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_custom_attributes" as any)
      .select("*")
      .eq("property_id", propertyId)
      .order("sort_order");
    if (error) toast.error(error.message);
    const list = ((data as any) ?? []) as CustomAttribute[];
    setRows(list);
    onChange?.(list);
    setLoading(false);
  };

  useEffect(() => {
    if (propertyId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const add = async () => {
    if (!newName.trim()) return;
    if (rows.length >= 5) return toast.error("Maximum 5 custom attributes");
    const code = slug(newName);
    if (!code) return toast.error("Invalid name");
    const { error } = await supabase.from("site_custom_attributes" as any).insert({
      property_id: propertyId,
      name: newName.trim(),
      code,
      data_type: "boolean",
      enforce_on_booking: true,
      sort_order: rows.length,
    } as any);
    if (error) return toast.error(error.message);
    setNewName("");
    await load();
  };

  const update = async (id: string, patch: Partial<CustomAttribute>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("site_custom_attributes" as any).update(patch as any).eq("id", id);
    if (error) toast.error(error.message);
    else onChange?.(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this custom attribute?")) return;
    const { error } = await supabase.from("site_custom_attributes" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  };

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h3 className="font-medium">Custom Site Attributes</h3>
        <p className="text-xs text-muted-foreground">
          Up to 5 property-specific attributes (e.g. Pet Friendly, Waterfront) that can be enforced when guests book.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No custom attributes yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-12 items-center gap-2 border rounded p-2">
              <Input
                className="col-span-4"
                value={r.name}
                onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)))}
                onBlur={(e) => update(r.id, { name: e.target.value })}
              />
              <div className="col-span-3">
                <Select value={r.data_type} onValueChange={(v: any) => update(r.id, { data_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boolean">Yes / No</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="col-span-4 flex items-center gap-2 text-sm">
                <Switch
                  checked={r.enforce_on_booking}
                  onCheckedChange={(v) => update(r.id, { enforce_on_booking: v })}
                />
                Enforce on booking
              </label>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)} className="col-span-1 justify-self-end">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {rows.length < 5 && (
        <div className="flex gap-2 pt-1">
          <Input
            placeholder="New attribute name (e.g. Pet Friendly)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button onClick={add}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      )}
    </Card>
  );
}

export async function fetchCustomAttrs(propertyId: string): Promise<CustomAttribute[]> {
  const { data } = await supabase
    .from("site_custom_attributes" as any)
    .select("*")
    .eq("property_id", propertyId)
    .order("sort_order");
  return ((data as any) ?? []) as CustomAttribute[];
}
