import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import {
  Plus,
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Ban,
  DollarSign,
  ArrowLeft,
  Download,
} from "lucide-react";
import {
  WorkOrderFormDialog,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/components/work-orders/WorkOrderFormDialog";
import { exportToCSV, generateFilename } from "@/lib/exportUtils";
import type { Database } from "@/integrations/supabase/types";

type WoStatus = Database["public"]["Enums"]["wo_status"];
type WoPriority = Database["public"]["Enums"]["wo_priority"];
type WoCategory = Database["public"]["Enums"]["wo_category"];

interface WorkOrderRow {
  id: string;
  wo_number: string;
  title: string;
  status: WoStatus;
  priority: WoPriority;
  category: WoCategory;
  site_id: string | null;
  location_text: string | null;
  reported_at: string;
  assigned_to_user_id: string | null;
  completed_at: string | null;
  site_number?: string;
  assignee_name?: string;
  total_cost?: number;
}

const STATUS_TONE: Record<WoStatus, string> = {
  open: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300",
  in_progress: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  on_hold: "bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-300",
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_TONE: Record<WoPriority, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  high: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  urgent: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const WorkOrders = () => {
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const [rows, setRows] = useState<WorkOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [params] = useSearchParams();
  const siteFilter = params.get("site");

  const [totalCount, setTotalCount] = useState(0);
  const [pageLimit, setPageLimit] = useState(200);

  const load = async () => {
    if (!selectedProperty?.id) return;
    setLoading(true);
    const { data, error, count } = await supabase
      .from("work_orders")
      .select("id, wo_number, title, status, priority, category, site_id, location_text, reported_at, assigned_to_user_id, completed_at", { count: "exact" })
      .eq("property_id", selectedProperty.id)
      .is("deleted_at", null)
      .order("reported_at", { ascending: false })
      .range(0, pageLimit - 1);
    if (error) {
      setLoading(false);
      return;
    }
    setTotalCount(count ?? 0);
    const base = (data || []) as WorkOrderRow[];


    // Attach site numbers + assignee names + totals
    const siteIds = [...new Set(base.map((r) => r.site_id).filter(Boolean) as string[])];
    const uids = [...new Set(base.map((r) => r.assigned_to_user_id).filter(Boolean) as string[])];
    const woIds = base.map((r) => r.id);

    const [{ data: sitesData }, { data: profs }, { data: costs }] = await Promise.all([
      siteIds.length
        ? supabase.from("sites").select("id, site_number").in("id", siteIds)
        : Promise.resolve({ data: [] }),
      uids.length
        ? supabase
            .from("staff_profiles")
            .select("user_id, first_name, last_name")
            .in("user_id", uids)
        : Promise.resolve({ data: [] }),
      woIds.length
        ? supabase
            .from("work_order_cost_items")
            .select("work_order_id, total_cost")
            .in("work_order_id", woIds)
        : Promise.resolve({ data: [] }),
    ]);

    const siteMap = new Map((sitesData || []).map((s: any) => [s.id, s.site_number]));
    const nameMap = new Map(
      (profs || []).map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`.trim()]),
    );
    const costMap = new Map<string, number>();
    for (const c of (costs || []) as any[]) {
      costMap.set(c.work_order_id, (costMap.get(c.work_order_id) || 0) + Number(c.total_cost || 0));
    }

    setRows(
      base.map((r) => ({
        ...r,
        site_number: r.site_id ? siteMap.get(r.site_id) : undefined,
        assignee_name: r.assigned_to_user_id ? nameMap.get(r.assigned_to_user_id) : undefined,
        total_cost: costMap.get(r.id) || 0,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty?.id, pageLimit]);


  useEffect(() => {
    // Pre-fill search with site number when linked from a site badge
    if (!siteFilter) return;
    supabase
      .from("sites")
      .select("site_number")
      .eq("id", siteFilter)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.site_number) setSearch(data.site_number);
      });
  }, [siteFilter]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${r.wo_number} ${r.title} ${r.site_number || ""} ${r.location_text || ""} ${r.assignee_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, categoryFilter, priorityFilter, search]);

  // Dashboard aggregates
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 3600 * 1000);

  const statusCounts = rows.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<WoStatus, number>,
  );

  const openTotal =
    (statusCounts.open || 0) + (statusCounts.in_progress || 0) + (statusCounts.on_hold || 0);

  const categoryData = useMemo(() => {
    const map = new Map<WoCategory, number>();
    for (const r of rows) {
      if (new Date(r.reported_at) < ninetyDaysAgo) continue;
      map.set(r.category, (map.get(r.category) || 0) + 1);
    }
    return (Object.keys(CATEGORY_LABELS) as WoCategory[])
      .map((c) => ({ category: CATEGORY_LABELS[c], count: map.get(c) || 0 }))
      .filter((d) => d.count > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const agingData = useMemo(() => {
    const buckets = { "0-3d": 0, "4-7d": 0, "8-14d": 0, "15d+": 0 };
    for (const r of rows) {
      if (r.status === "completed" || r.status === "cancelled") continue;
      const days = Math.floor((now.getTime() - new Date(r.reported_at).getTime()) / (24 * 3600 * 1000));
      if (days <= 3) buckets["0-3d"]++;
      else if (days <= 7) buckets["4-7d"]++;
      else if (days <= 14) buckets["8-14d"]++;
      else buckets["15d+"]++;
    }
    return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const monthCost = rows
    .filter((r) => new Date(r.reported_at) >= startOfMonth)
    .reduce((s, r) => s + (r.total_cost || 0), 0);

  const handleExport = () => {
    exportToCSV(
      filtered.map((r) => ({
        wo_number: r.wo_number,
        title: r.title,
        status: STATUS_LABELS[r.status],
        priority: PRIORITY_LABELS[r.priority],
        category: CATEGORY_LABELS[r.category],
        location: r.site_number ? `Site ${r.site_number}` : r.location_text || "",
        assignee: r.assignee_name || "",
        reported_at: r.reported_at,
        completed_at: r.completed_at || "",
        total_cost: (r.total_cost || 0).toFixed(2),
      })),
      [
        { key: "wo_number", label: "WO #" },
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        { key: "priority", label: "Priority" },
        { key: "category", label: "Category" },
        { key: "location", label: "Location" },
        { key: "assignee", label: "Assignee" },
        { key: "reported_at", label: "Reported" },
        { key: "completed_at", label: "Completed" },
        { key: "total_cost", label: "Total cost" },
      ],
      generateFilename("work-orders"),
    );
  };

  const StatTile = ({
    label,
    value,
    Icon,
    tone,
  }: {
    label: string;
    value: string | number;
    Icon: any;
    tone: string;
  }) => (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
        </div>
        <div className={`rounded-lg p-2 ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-5 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/site-turnover")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <Wrench className="h-6 w-6 text-primary" />
                Work Orders
              </h1>
              <p className="text-sm text-muted-foreground">
                Track and assign maintenance issues across the park
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExport} className="flex-1 sm:flex-none">
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-1" /> New work order
            </Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="w-full flex overflow-x-auto sm:inline-flex sm:w-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>


          <TabsContent value="dashboard" className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatTile label="Open (all active)" value={openTotal} Icon={AlertTriangle} tone="bg-blue-500/15 text-blue-600" />
              <StatTile label="In Progress" value={statusCounts.in_progress || 0} Icon={Clock} tone="bg-amber-500/15 text-amber-600" />
              <StatTile label="Completed" value={statusCounts.completed || 0} Icon={CheckCircle2} tone="bg-emerald-500/15 text-emerald-600" />
              <StatTile label="Cancelled" value={statusCounts.cancelled || 0} Icon={Ban} tone="bg-muted text-muted-foreground" />
              <StatTile label="Cost this month" value={`$${monthCost.toFixed(2)}`} Icon={DollarSign} tone="bg-accent/20 text-accent" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Most common issues (last 90 days)</h3>
                {categoryData.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="category" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} fontSize={11} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Open work order aging</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={agingData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="bucket" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            <Card className="p-3 grid grid-cols-2 md:grid-cols-5 gap-2">
              <Input
                placeholder="Search WO #, title, site, assignee…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="md:col-span-2"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {(Object.keys(STATUS_LABELS) as WoStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {(Object.keys(CATEGORY_LABELS) as WoCategory[]).map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {(Object.keys(PRIORITY_LABELS) as WoPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            {loading ? (
              <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
            ) : filtered.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                No work orders match your filters.
              </Card>
            ) : (
              <>
                {/* Mobile list */}
                <div className="grid grid-cols-1 gap-2 md:hidden">
                  {filtered.map((r) => (
                    <Card
                      key={r.id}
                      className="p-3 cursor-pointer active:scale-[0.99] transition-transform"
                      onClick={() => navigate(`/site-turnover/work-orders/${r.id}`)}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground font-mono">{r.wo_number}</div>
                          <div className="text-sm font-semibold truncate">{r.title}</div>
                        </div>
                        <Badge className={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <div className="flex flex-wrap gap-2 min-w-0">
                          <span className={`px-1.5 py-0.5 rounded ${PRIORITY_TONE[r.priority]}`}>
                            {PRIORITY_LABELS[r.priority]}
                          </span>
                          <span className="truncate">
                            {r.site_number ? `Site ${r.site_number}` : r.location_text || "—"}
                          </span>
                        </div>
                        {r.total_cost ? (
                          <span className="font-semibold tabular-nums text-foreground shrink-0">
                            ${r.total_cost.toFixed(2)}
                          </span>
                        ) : null}
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Tablet+ table */}
                <Card className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>WO #</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reported</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <TableRow
                          key={r.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/site-turnover/work-orders/${r.id}`)}
                        >
                          <TableCell className="font-mono text-xs">{r.wo_number}</TableCell>
                          <TableCell className="font-medium max-w-xs truncate">{r.title}</TableCell>
                          <TableCell className="text-sm">
                            {r.site_number ? `Site ${r.site_number}` : r.location_text || "—"}
                          </TableCell>
                          <TableCell className="text-sm">{CATEGORY_LABELS[r.category]}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_TONE[r.priority]}`}>
                              {PRIORITY_LABELS[r.priority]}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{r.assignee_name || "—"}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(r.reported_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {r.total_cost ? `$${r.total_cost.toFixed(2)}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </>
            )}

            {rows.length < totalCount && !loading && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Showing {rows.length} of {totalCount} work orders</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageLimit((n) => n + 200)}
                >
                  Load more
                </Button>
              </div>
            )}

          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ReportsSection rows={rows} />
          </TabsContent>
        </Tabs>
      </div>

      <WorkOrderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(id) => {
          load();
          navigate(`/site-turnover/work-orders/${id}`);
        }}
      />
    </DashboardLayout>
  );
};

/* ------------------------------------------------------------------ */

const ReportsSection = ({ rows }: { rows: WorkOrderRow[] }) => {
  // Cost by category
  const costByCategory = useMemo(() => {
    const map = new Map<WoCategory, number>();
    for (const r of rows) {
      map.set(r.category, (map.get(r.category) || 0) + (r.total_cost || 0));
    }
    return (Object.keys(CATEGORY_LABELS) as WoCategory[])
      .map((c) => ({ category: CATEGORY_LABELS[c], cost: map.get(c) || 0 }))
      .filter((d) => d.cost > 0);
  }, [rows]);

  // Assignee performance
  const assigneePerf = useMemo(() => {
    const map = new Map<string, { name: string; completed: number; totalDays: number; cost: number }>();
    for (const r of rows) {
      if (!r.assigned_to_user_id) continue;
      const key = r.assigned_to_user_id;
      const entry = map.get(key) || {
        name: r.assignee_name || "User",
        completed: 0,
        totalDays: 0,
        cost: 0,
      };
      if (r.status === "completed" && r.completed_at) {
        entry.completed++;
        entry.totalDays += (new Date(r.completed_at).getTime() - new Date(r.reported_at).getTime()) / (24 * 3600 * 1000);
      }
      entry.cost += r.total_cost || 0;
      map.set(key, entry);
    }
    return [...map.values()]
      .map((v) => ({ ...v, avgDays: v.completed > 0 ? v.totalDays / v.completed : 0 }))
      .sort((a, b) => b.completed - a.completed);
  }, [rows]);

  // Site hotspots
  const siteHotspots = useMemo(() => {
    const map = new Map<string, { label: string; count: number; cost: number }>();
    for (const r of rows) {
      const label = r.site_number ? `Site ${r.site_number}` : r.location_text || "Unassigned";
      const entry = map.get(label) || { label, count: 0, cost: 0 };
      entry.count++;
      entry.cost += r.total_cost || 0;
      map.set(label, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [rows]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Cost by category (all time)</h3>
        {costByCategory.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">No cost data</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={costByCategory}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="category" fontSize={11} angle={-15} textAnchor="end" height={60} interval={0} />
              <YAxis fontSize={11} />
              <RechartsTooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              <Bar dataKey="cost" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Site hotspots (top 10)</h3>
        {siteHotspots.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">No data</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">WOs</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {siteHotspots.map((s) => (
                <TableRow key={s.label}>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.count}</TableCell>
                  <TableCell className="text-right tabular-nums">${s.cost.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold mb-3">Assignee performance</h3>
        {assigneePerf.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">No assignments yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assignee</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Avg days to close</TableHead>
                <TableHead className="text-right">Total cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assigneePerf.map((a) => (
                <TableRow key={a.name}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.completed}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.avgDays > 0 ? a.avgDays.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">${a.cost.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default WorkOrders;
