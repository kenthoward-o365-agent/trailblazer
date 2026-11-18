import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { History, RefreshCw, Search, Download, Shield } from "lucide-react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useInternalUser } from "@/hooks/useInternalUser";
import { format, formatDistanceStrict, parseISO } from "date-fns";

interface AuditEntry {
  id: string;
  admin_user_id: string;
  admin_user_name: string;
  admin_role: string;
  property_id: string;
  property_name: string;
  organization_id: string | null;
  organization_name: string | null;
  action: "access_started" | "access_ended";
  session_id: string;
  user_agent: string | null;
  created_at: string;
}

interface SessionGroup {
  session_id: string;
  admin_user_name: string;
  admin_role: string;
  property_name: string;
  organization_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration: string | null;
}

type ActionType = "access_started" | "access_ended";

export const AdminAccessAudit = () => {
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const { isInternalUser, loading: internalLoading } = useInternalUser();
  const queryClient = useQueryClient();
  const [pageLimit, setPageLimit] = useState(200);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"sessions" | "entries">("sessions");

  const canAccess = isSuperAdmin || isInternalUser;

  const auditQuery = useQuery({
    queryKey: ["admin-access-audit", pageLimit],
    enabled: canAccess,
    queryFn: async (): Promise<{ entries: AuditEntry[]; count: number }> => {
      const { data, error, count } = await supabase
        .from("admin_access_audit")
        .select(
          "id, admin_user_id, admin_user_name, admin_role, property_id, property_name, organization_id, organization_name, action, session_id, user_agent, created_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(0, pageLimit - 1);

      if (error) {
        toast.error("Failed to load audit data");
        throw error;
      }

      const typedData: AuditEntry[] = (data || []).map(entry => ({
        ...entry,
        action: entry.action as ActionType,
      }));
      return { entries: typedData, count: count ?? 0 };
    },
  });

  const auditEntries = auditQuery.data?.entries ?? [];
  const totalCount = auditQuery.data?.count ?? 0;
  const loading = auditQuery.isLoading;
  const loadingMore = auditQuery.isFetching && !auditQuery.isLoading;

  const sessionGroups = useMemo(() => groupBySession(auditEntries), [auditEntries]);

  const loadAuditData = (_limit: number, _isLoadMore: boolean) =>
    queryClient.invalidateQueries({ queryKey: ["admin-access-audit"] });


  const groupBySession = (entries: AuditEntry[]): SessionGroup[] => {
    const sessionMap = new Map<string, { start?: AuditEntry; end?: AuditEntry }>();

    entries.forEach(entry => {
      const existing = sessionMap.get(entry.session_id) || {};
      if (entry.action === "access_started") {
        existing.start = entry;
      } else {
        existing.end = entry;
      }
      sessionMap.set(entry.session_id, existing);
    });

    const groups: SessionGroup[] = [];
    sessionMap.forEach((value, session_id) => {
      if (value.start) {
        let duration: string | null = null;
        if (value.start && value.end) {
          duration = formatDistanceStrict(
            parseISO(value.end.created_at),
            parseISO(value.start.created_at)
          );
        }

        groups.push({
          session_id,
          admin_user_name: value.start.admin_user_name,
          admin_role: value.start.admin_role,
          property_name: value.start.property_name,
          organization_name: value.start.organization_name,
          started_at: value.start.created_at,
          ended_at: value.end?.created_at || null,
          duration,
        });
      }
    });

    // Sort by started_at descending
    groups.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

    return groups;
  };

  const filteredEntries = auditEntries.filter(entry => {
    const matchesSearch = searchTerm === "" ||
      entry.admin_user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.property_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.organization_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    const matchesAction = actionFilter === "all" || entry.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const filteredSessions = sessionGroups.filter(session => {
    const matchesSearch = searchTerm === "" ||
      session.admin_user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.property_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (session.organization_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    return matchesSearch;
  });

  const exportToCSV = () => {
    const headers = ["Date/Time", "Admin User", "Role", "Property", "Organization", "Action", "Session ID"];
    const rows = filteredEntries.map(entry => [
      format(parseISO(entry.created_at), "yyyy-MM-dd HH:mm:ss"),
      entry.admin_user_name,
      entry.admin_role,
      entry.property_name,
      entry.organization_name || "-",
      entry.action,
      entry.session_id,
    ]);

    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-access-audit-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  };

  const getRoleBadge = (role: string) => {
    if (role === "super_admin") {
      return <Badge className="bg-purple-500">Super Admin</Badge>;
    }
    return <Badge variant="secondary">Internal Admin</Badge>;
  };

  if (superAdminLoading || internalLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-destructive">Access Denied</h2>
          <p className="text-muted-foreground mt-2">You do not have permission to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6" />
              Admin Access Audit
            </h1>
            <p className="text-muted-foreground">
              Track when internal staff access customer properties for support
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => loadAuditData(pageLimit, false)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {auditEntries.length < totalCount && (
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={() => setPageLimit((n) => n + 200)}
              >
                {loadingMore ? "Loading…" : `Load older (${totalCount - auditEntries.length} more)`}
              </Button>
            )}
          </div>

        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sessionGroups.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">
                {sessionGroups.filter(s => !s.ended_at).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unique Properties Accessed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(sessionGroups.map(s => s.property_name)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search" className="sr-only">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by admin, property, or organization..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={viewMode} onValueChange={(v) => setViewMode(v as "sessions" | "entries")}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sessions">Sessions</SelectItem>
                    <SelectItem value="entries">All Entries</SelectItem>
                  </SelectContent>
                </Select>
                {viewMode === "entries" && (
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Filter by action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="access_started">Access Started</SelectItem>
                      <SelectItem value="access_ended">Access Ended</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : viewMode === "sessions" ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Admin User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => (
                  <TableRow key={session.session_id}>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(session.started_at), "MMM dd, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        {session.admin_user_name}
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(session.admin_role)}</TableCell>
                    <TableCell>{session.property_name}</TableCell>
                    <TableCell>
                      {session.organization_name || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {session.ended_at ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Completed
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {session.duration || (
                        <span className="text-muted-foreground">In progress...</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No admin access sessions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Time</TableHead>
                  <TableHead>Admin User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(entry.created_at), "MMM dd, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        {entry.admin_user_name}
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(entry.admin_role)}</TableCell>
                    <TableCell>{entry.property_name}</TableCell>
                    <TableCell>
                      {entry.organization_name || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {entry.action === "access_started" ? (
                        <Badge className="bg-blue-500">Access Started</Badge>
                      ) : (
                        <Badge variant="outline">Access Ended</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEntries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No audit entries found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminAccessAudit;
