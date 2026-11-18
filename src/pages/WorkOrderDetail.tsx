import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import {
  WorkOrderFormDialog,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/components/work-orders/WorkOrderFormDialog";
import { WorkOrderCostItems } from "@/components/work-orders/WorkOrderCostItems";
import { WorkOrderPhotos } from "@/components/work-orders/WorkOrderPhotos";
import { WorkOrderComments } from "@/components/work-orders/WorkOrderComments";
import type { Database } from "@/integrations/supabase/types";

type WoStatus = Database["public"]["Enums"]["wo_status"];
type WoPriority = Database["public"]["Enums"]["wo_priority"];
type WoCategory = Database["public"]["Enums"]["wo_category"];

interface WorkOrder {
  id: string;
  wo_number: string;
  title: string;
  description: string | null;
  status: WoStatus;
  priority: WoPriority;
  category: WoCategory;
  site_id: string | null;
  location_text: string | null;
  reported_by_user_id: string;
  reported_at: string;
  assigned_to_user_id: string | null;
  assigned_at: string | null;
  due_date: string | null;
  completed_at: string | null;
  resolution_notes: string | null;
  property_id: string;
}

const STATUS_TONE: Record<WoStatus, string> = {
  open: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
  in_progress: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
  on_hold: "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_TONE: Record<WoPriority, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  high: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  urgent: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const WorkOrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [siteNumber, setSiteNumber] = useState<string | null>(null);
  const [reporterName, setReporterName] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [totalCost, setTotalCost] = useState(0);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("work_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      toast.error("Failed to load work order");
      setLoading(false);
      return;
    }
    setWo(data as WorkOrder);

    // Names
    const uids = [data.reported_by_user_id, data.assigned_to_user_id].filter(Boolean) as string[];
    if (uids.length) {
      const { data: profs } = await supabase
        .from("staff_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", uids);
      const map = new Map(
        (profs || []).map((p) => [p.user_id, `${p.first_name} ${p.last_name}`.trim() || "User"]),
      );
      setReporterName(map.get(data.reported_by_user_id) || "User");
      setAssigneeName(data.assigned_to_user_id ? map.get(data.assigned_to_user_id) || "" : "");
    }

    if (data.site_id) {
      const { data: s } = await supabase
        .from("sites")
        .select("site_number")
        .eq("id", data.site_id)
        .maybeSingle();
      setSiteNumber(s?.site_number || null);
    } else {
      setSiteNumber(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleStatusChange = async (status: WoStatus) => {
    if (!wo) return;
    setSavingStatus(true);
    const { error } = await supabase
      .from("work_orders")
      .update({ status })
      .eq("id", wo.id);
    if (error) {
      toast.error(error.message);
    } else {
      // Log a system comment
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase.from("work_order_comments").insert({
          work_order_id: wo.id,
          property_id: wo.property_id,
          user_id: userData.user.id,
          comment: `Status changed to ${STATUS_LABELS[status]}`,
          is_system: true,
        });
      }
      toast.success("Status updated");
      load();
    }
    setSavingStatus(false);
  };

  const handleDelete = async () => {
    if (!wo) return;
    if (!confirm(`Delete ${wo.wo_number}? This cannot be undone.`)) return;
    const { error } = await supabase
      .from("work_orders")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", wo.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Work order deleted");
      navigate("/site-turnover/work-orders");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      </DashboardLayout>
    );
  }

  if (!wo) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">Work order not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => navigate("/site-turnover/work-orders")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground">{wo.wo_number}</span>
                <Badge className={STATUS_TONE[wo.status]}>{STATUS_LABELS[wo.status]}</Badge>
                <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_TONE[wo.priority]}`}>
                  {PRIORITY_LABELS[wo.priority]}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mt-1 break-words [overflow-wrap:anywhere]">
                {wo.title}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Select
              value={wo.status}
              onValueChange={(v) => handleStatusChange(v as WoStatus)}
              disabled={savingStatus}
            >
              <SelectTrigger className="w-40 flex-1 sm:flex-none"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as WoStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDelete} title="Delete">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 md:col-span-2 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Description
              </div>
              <div className="text-sm mt-1 whitespace-pre-wrap">
                {wo.description || <span className="text-muted-foreground italic">No description</span>}
              </div>
            </div>
            {wo.resolution_notes && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Resolution
                </div>
                <div className="text-sm mt-1 whitespace-pre-wrap">{wo.resolution_notes}</div>
              </div>
            )}
          </Card>
          <Card className="p-4 space-y-2 text-sm">
            <Row label="Category" value={CATEGORY_LABELS[wo.category]} />
            <Row
              label="Location"
              value={siteNumber ? `Site ${siteNumber}` : wo.location_text || "—"}
            />
            <Row label="Assignee" value={assigneeName || "Unassigned"} />
            <Row label="Reported by" value={reporterName} />
            <Row label="Reported" value={new Date(wo.reported_at).toLocaleString()} />
            {wo.due_date && <Row label="Due" value={wo.due_date} />}
            {wo.completed_at && (
              <Row label="Completed" value={new Date(wo.completed_at).toLocaleString()} />
            )}
            <div className="pt-2 border-t">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Total cost
              </div>
              <div className="text-xl font-bold tabular-nums text-primary">
                ${totalCost.toFixed(2)}
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="costs">
          <TabsList>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="costs" className="mt-4">
            <WorkOrderCostItems workOrderId={wo.id} onTotalChange={setTotalCost} />
          </TabsContent>
          <TabsContent value="photos" className="mt-4">
            <WorkOrderPhotos workOrderId={wo.id} propertyId={wo.property_id} />
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <WorkOrderComments workOrderId={wo.id} />
          </TabsContent>
        </Tabs>
      </div>

      <WorkOrderFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => load()}
        editingId={wo.id}
      />
    </DashboardLayout>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-baseline gap-3">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-medium text-right">{value}</span>
  </div>
);

export default WorkOrderDetail;
