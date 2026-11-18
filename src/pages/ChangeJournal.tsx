import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { subDays, parseISO, startOfDay, endOfDay } from "date-fns";
import { Search, ArrowRight, RefreshCw, FileText } from "lucide-react";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { formatPropertyDateTime, getPropertyTodayString, formatLocalDate } from "@/lib/dateUtils";

interface ChangeEntry {
  id: string;
  record_type: string;
  record_id: string;
  record_identifier: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string | null;
  created_at: string;
}

const PAGE_SIZE = 100;

const ChangeJournal = () => {
  const { selectedProperty } = useProperty();
  const queryClient = useQueryClient();
  const terminology = usePropertyTerminology();
  const [searchTerm, setSearchTerm] = useState("");
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>("all");
  const propertyToday = getPropertyTodayString(selectedProperty?.timezone);
  const [startDate, setStartDate] = useState(formatLocalDate(subDays(new Date(), 7).toISOString().split('T')[0], "yyyy-MM-dd") || propertyToday);
  const [endDate, setEndDate] = useState(propertyToday);

  const propertyId = selectedProperty?.id;

  const query = useInfiniteQuery({
    queryKey: ["change-journal", propertyId, startDate, endDate, recordTypeFilter],
    enabled: !!propertyId,
    initialPageParam: 0,
    getNextPageParam: (last: { rows: ChangeEntry[]; count: number }, all: Array<{ rows: ChangeEntry[]; count: number }>) => {
      const loaded = all.reduce((n, p) => n + p.rows.length, 0);
      return loaded < last.count ? loaded : undefined;
    },
    queryFn: async ({ pageParam }): Promise<{ rows: ChangeEntry[]; count: number }> => {

      const offset = pageParam as number;
      const startDateTime = startOfDay(parseISO(startDate)).toISOString();
      const endDateTime = endOfDay(parseISO(endDate)).toISOString();

      let q = supabase
        .from("change_journal")
        .select(
          "id, record_type, record_id, record_identifier, field_name, old_value, new_value, changed_by_name, created_at",
          { count: "exact" },
        )
        .eq("property_id", propertyId!)
        .gte("created_at", startDateTime)
        .lte("created_at", endDateTime)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (recordTypeFilter !== "all") {
        q = q.eq("record_type", recordTypeFilter);
      }

      const { data, error, count } = await q;
      if (error) {
        toast.error("Failed to load change journal");
        throw error;
      }
      return { rows: (data ?? []) as ChangeEntry[], count: count ?? 0 };
    },
  });

  const entries = (query.data?.pages ?? []).flatMap((p) => p.rows);
  const totalCount = query.data?.pages[0]?.count ?? 0;
  const loading = query.isLoading;
  const loadingMore = query.isFetchingNextPage;
  const loadEntries = (_offset: number, _reset: boolean) =>
    queryClient.invalidateQueries({ queryKey: ["change-journal", propertyId] });



  const filteredEntries = entries.filter((entry) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      entry.record_identifier.toLowerCase().includes(search) ||
      entry.field_name.toLowerCase().includes(search) ||
      (entry.old_value?.toLowerCase().includes(search) ?? false) ||
      (entry.new_value?.toLowerCase().includes(search) ?? false) ||
      (entry.changed_by_name?.toLowerCase().includes(search) ?? false)
    );
  });

  const getRecordTypeBadge = (type: string) => {
    if (type === "reservation") {
      return <Badge variant="default" className="text-xs">Reservation</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Housekeeping</Badge>;
  };

  const formatFieldName = (fieldName: string): string => {
    const fieldLabels: Record<string, string> = {
      check_in_date: "Check-In Date",
      check_out_date: "Check-Out Date",
      site_id: terminology.site,
      site_type_id: terminology.siteType,
      rate_id: "Rate Code",
      status: "Status",
      adults_count: "Adults",
      children_count: "Children",
      city_ledger_account_id: "Direct Bill Account",
      billing_instructions: "Billing Instructions",
      housekeeping_status: "Site Maintenance Status",
      occupancy_status: "Occupancy Status",
      reservation_created: "Reservation Created",
      guest_checkout: "Guest Checkout",
    };
    return fieldLabels[fieldName] || fieldName.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatValue = (value: string | null): string => {
    if (!value) return "—";
    return value;
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Change Journal</h1>
          <p className="text-sm text-muted-foreground">
            Track changes to reservations and site maintenance status (45-day retention)
          </p>
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by confirmation #, site, or user..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={recordTypeFilter} onValueChange={setRecordTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Record Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="reservation">Reservations</SelectItem>
                <SelectItem value="housekeeping">Site Maintenance</SelectItem>
              </SelectContent>
            </Select>


            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[140px]"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[140px]"
              />
            </div>

            <Button variant="outline" size="icon" onClick={() => loadEntries(0, true)}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>

          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-2" />
              <p>No changes recorded for this period</p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Date/Time</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[100px]">Identifier</TableHead>
                    <TableHead className="w-[130px]">Field Changed</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead className="w-[30px]"></TableHead>
                    <TableHead>New Value</TableHead>
                    <TableHead className="w-[130px]">Changed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatPropertyDateTime(entry.created_at, selectedProperty?.timezone, "MM/dd/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {getRecordTypeBadge(entry.record_type)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {entry.record_identifier}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFieldName(entry.field_name)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate" title={entry.old_value || ""}>
                        {formatValue(entry.old_value)}
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate" title={entry.new_value || ""}>
                        {formatValue(entry.new_value)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate" title={entry.changed_by_name || ""}>
                        {entry.changed_by_name || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {filteredEntries.length} of {totalCount} entries</span>
            {entries.length < totalCount && (
              <Button
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() => query.fetchNextPage()}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>

        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ChangeJournal;
