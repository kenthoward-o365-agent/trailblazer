import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type WoCategory = Database["public"]["Enums"]["wo_category"];
type WoPriority = Database["public"]["Enums"]["wo_priority"];
type WoStatus = Database["public"]["Enums"]["wo_status"];

export const CATEGORY_LABELS: Record<WoCategory, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  grounds: "Grounds / Landscaping",
  structural: "Structural / Facilities",
  site_specific: "Site Specific",
  other: "Other",
};

export const PRIORITY_LABELS: Record<WoPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const STATUS_LABELS: Record<WoStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface SiteOption {
  id: string;
  site_number: string;
}

interface UserOption {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string) => void;
  initialSiteId?: string | null;
  editingId?: string | null;
}

export const WorkOrderFormDialog = ({
  open,
  onOpenChange,
  onSaved,
  initialSiteId,
  editingId,
}: Props) => {
  const { selectedProperty, organization } = useProperty();
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "other" as WoCategory,
    priority: "normal" as WoPriority,
    status: "open" as WoStatus,
    site_id: initialSiteId ?? "",
    location_text: "",
    assigned_to_user_id: "",
    due_date: "",
  });

  useEffect(() => {
    if (!open || !selectedProperty?.id) return;

    (async () => {
      const [{ data: sitesData }, { data: profilesData }, { data: accessData }] =
        await Promise.all([
          supabase
            .from("sites")
            .select("id, site_number")
            .eq("property_id", selectedProperty.id)
            .eq("is_active", true)
            .order("site_number"),
          supabase
            .from("staff_profiles")
            .select("user_id, first_name, last_name")
            .order("first_name"),
          organization?.id
            ? supabase
                .from("user_property_access")
                .select("user_id")
                .eq("organization_id", organization.id)
                .or(
                  `property_id.eq.${selectedProperty.id},is_org_admin.eq.true`,
                )
            : Promise.resolve({ data: [] as { user_id: string }[] }),
        ]);
      setSites(sitesData || []);
      const allowed = new Set((accessData || []).map((a) => a.user_id));
      setUsers(
        (profilesData || []).filter((p) => allowed.has(p.user_id)) as UserOption[],
      );

      if (editingId) {
        const { data: wo } = await supabase
          .from("work_orders")
          .select("*")
          .eq("id", editingId)
          .maybeSingle();
        if (wo) {
          setForm({
            title: wo.title,
            description: wo.description ?? "",
            category: wo.category,
            priority: wo.priority,
            status: wo.status,
            site_id: wo.site_id ?? "",
            location_text: wo.location_text ?? "",
            assigned_to_user_id: wo.assigned_to_user_id ?? "",
            due_date: wo.due_date ?? "",
          });
        }
      } else {
        setForm((f) => ({
          ...f,
          title: "",
          description: "",
          site_id: initialSiteId ?? "",
          location_text: "",
          assigned_to_user_id: "",
          due_date: "",
        }));
      }
    })();
  }, [open, editingId, selectedProperty?.id, organization?.id, initialSiteId]);

  const handleSave = async () => {
    if (!selectedProperty?.id) return;
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.site_id && !form.location_text.trim()) {
      toast.error("Provide a site OR a location");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      const payload = {
        property_id: selectedProperty.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        priority: form.priority,
        status: form.status,
        site_id: form.site_id || null,
        location_text: form.location_text.trim() || null,
        assigned_to_user_id: form.assigned_to_user_id || null,
        due_date: form.due_date || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("work_orders")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        onSaved(editingId);
        toast.success("Work order updated");
      } else {
        const { data, error } = await supabase
          .from("work_orders")
          .insert({ ...payload, reported_by_user_id: uid })
          .select("id, wo_number")
          .single();
        if (error) throw error;
        onSaved(data.id);
        toast.success(`Created ${data.wo_number}`);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save work order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Work Order" : "New Work Order"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Short summary of the issue"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as WoCategory })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as WoCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as WoPriority })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABELS) as WoPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Site (optional)</Label>
              <Select
                value={form.site_id || "__none"}
                onValueChange={(v) =>
                  setForm({ ...form, site_id: v === "__none" ? "" : v })
                }
              >
                <SelectTrigger><SelectValue placeholder="No site" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Not tied to a site —</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>Site {s.site_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location (if not a site)</Label>
              <Input
                value={form.location_text}
                onChange={(e) => setForm({ ...form, location_text: e.target.value })}
                placeholder="e.g. Bathhouse A, Playground"
                maxLength={200}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assign to</Label>
              <Select
                value={form.assigned_to_user_id || "__none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    assigned_to_user_id: v === "__none" ? "" : v,
                  })
                }
              >
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Unassigned —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.first_name} {u.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
          </div>

          {editingId && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as WoStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as WoStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the issue in detail"
              rows={4}
              maxLength={2000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Create work order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
