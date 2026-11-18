import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { ExportDialog } from "@/components/ExportDialog";
import { ExportColumn, ExportFilter } from "@/lib/exportUtils";
import { formatLocalDate } from "@/lib/dateUtils";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { useAuditDate } from "@/contexts/AuditDateContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPress } from "@/hooks/useLongPress";

type SortOption = "confirmation_number" | "guest_name" | "check_in_date";
type ScopeOption = "all" | "in_park" | "departures";

const InParkGuests = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();
  const { auditDate } = useAuditDate();
  const isMobile = useIsMobile();

  const pageTitle = terminology.isHotel ? "In-House Guests" : "In Park Guests";

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [scope, setScope] = useState<ScopeOption>("all");
  const [sortBy, setSortBy] = useState<SortOption>("guest_name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const openReservationFolio = useCallback(
    (id: string) => {
      navigate(`/reservation/edit?id=${id}&focus=folio`);
    },
    [navigate],
  );

  // If URL passes ?reservationId=..., jump straight into that folio
  useEffect(() => {
    const rid = searchParams.get("reservationId");
    if (rid) {
      navigate(`/reservation/edit?id=${rid}&focus=folio`, { replace: true });
    }
  }, [searchParams, navigate]);

  // ?filter=departures preselects the Departures scope
  useEffect(() => {
    const filter = searchParams.get("filter");
    if (filter === "departures") setScope("departures");
  }, [searchParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [scope, selectedProperty?.id, pageSize, auditDate]);

  const propertyId = selectedProperty?.id;

  const reservationsQuery = useQuery({
    queryKey: ["in-park-reservations", propertyId, auditDate, scope, currentPage, pageSize],
    enabled: !!propertyId && !!auditDate,
    queryFn: async () => {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("reservations")
        .select(
          "*, confirmation_number, sites(site_number, site_types(name, code)), guests(first_name, last_name, email, phone)",
          { count: "exact" },
        )
        .eq("property_id", propertyId!);

      if (scope === "in_park") {
        query = query.in("status", ["CHECKED_IN", "CHECK_IN_HOLD"]);
      } else if (scope === "departures") {
        query = query
          .eq("check_out_date", auditDate)
          .in("status", ["CHECKED_IN", "CHECK_IN_HOLD", "CHECKED_OUT"]);
      } else {
        query = query.or(
          `status.eq.CHECKED_IN,status.eq.CHECK_IN_HOLD,and(status.eq.CHECKED_OUT,check_out_date.eq.${auditDate})`,
        );
      }

      query = query.order("check_in_date", { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) {
        toast.error("Failed to load guests");
        throw error;
      }

      const rows = data ?? [];
      const ids = rows.map((r: any) => r.id);
      let balancesMap: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: ledgers } = await supabase
          .from("ledger_accounts")
          .select("reservation_id, balance")
          .eq("property_id", propertyId!)
          .eq("ledger_type", "guest")
          .in("reservation_id", ids);
        (ledgers ?? []).forEach((l: any) => {
          if (l.reservation_id) balancesMap[l.reservation_id] = Number(l.balance) || 0;
        });
      }
      return { rows, count: count ?? 0, balances: balancesMap };
    },
  });

  const reservations = reservationsQuery.data?.rows ?? [];
  const balances = reservationsQuery.data?.balances ?? {};
  const totalCount = reservationsQuery.data?.count ?? 0;
  const loading = reservationsQuery.isLoading;
  const totalPages = Math.ceil(totalCount / pageSize);

  const refreshReservations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["in-park-reservations", propertyId] });
  }, [queryClient, propertyId]);

  // Refresh when the window regains focus
  useEffect(() => {
    const handleFocus = () => {
      if (propertyId && auditDate) refreshReservations();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [propertyId, auditDate, refreshReservations]);


  const filteredReservations = useMemo(() => {
    let result = reservations.filter((res) => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        res.guests?.first_name?.toLowerCase().includes(s) ||
        res.guests?.last_name?.toLowerCase().includes(s) ||
        res.guests?.email?.toLowerCase().includes(s) ||
        res.sites?.site_number?.toLowerCase().includes(s) ||
        (res.confirmation_number && res.confirmation_number.includes(s))
      );
    });

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "confirmation_number":
          cmp = (a.confirmation_number || "").localeCompare(b.confirmation_number || "");
          break;
        case "guest_name":
          cmp = (a.guests?.last_name || "")
            .toLowerCase()
            .localeCompare((b.guests?.last_name || "").toLowerCase());
          break;
        case "check_in_date":
          cmp =
            (a.check_in_date ? new Date(a.check_in_date).getTime() : 0) -
            (b.check_in_date ? new Date(b.check_in_date).getTime() : 0);
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [reservations, searchTerm, sortBy, sortOrder]);

  const exportColumns: ExportColumn[] = [
    { key: "confirmation_number", label: "Confirmation #" },
    {
      key: "guest_name",
      label: "Guest Name",
      format: (_, row) => `${row.guests?.first_name || ""} ${row.guests?.last_name || ""}`.trim(),
    },
    { key: "email", label: "Email", format: (_, row) => row.guests?.email || "" },
    { key: "phone", label: "Phone", format: (_, row) => row.guests?.phone || "" },
    {
      key: "check_in_date",
      label: "Check-in",
      format: (v) => (v ? formatLocalDate(v, "MM/dd/yyyy") : ""),
    },
    {
      key: "check_out_date",
      label: "Check-out",
      format: (v) => (v ? formatLocalDate(v, "MM/dd/yyyy") : ""),
    },
    {
      key: "site_number",
      label: terminology.site,
      format: (_, row) => row.sites?.site_number || "",
    },
    { key: "status", label: "Status" },
    {
      key: "folio_balance",
      label: "Folio Balance",
      format: (_, row) => `$${(balances[row.id] ?? 0).toFixed(2)}`,
    },
  ];

  const exportFilters: ExportFilter[] = [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CHECKED_IN":
        return "bg-green-500/10 text-green-700";
      case "CHECK_IN_HOLD":
        return "bg-amber-500/15 text-amber-700";
      case "CHECKED_OUT":
        return "bg-gray-500/10 text-gray-700";
      default:
        return "bg-gray-500/10 text-gray-700";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl font-bold">
              {scope === "departures" ? `${pageTitle} · Departures` : pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              Guests currently on property and today's checkouts (audit date {auditDate}).
              Click a row to jump straight to the folio.
            </p>
          </div>
        </div>

        <Card className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name, email, site, or confirmation #..."
                  className="pl-8 h-10 sm:h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Show</Label>
              <Select value={scope} onValueChange={(v: ScopeOption) => setScope(v)}>
                <SelectTrigger className="h-10 sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">In Park + Checked Out Today</SelectItem>
                  <SelectItem value="in_park">In Park Only</SelectItem>
                  <SelectItem value="departures">Departures (Today)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sort By</Label>
              <div className="flex items-center gap-1">
                <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
                  <SelectTrigger className="flex-1 h-10 sm:h-9">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmation_number">Confirmation</SelectItem>
                    <SelectItem value="guest_name">Guest Name</SelectItem>
                    <SelectItem value="check_in_date">Check-in Date</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 sm:h-9 sm:w-9 shrink-0"
                  onClick={() => setSortOrder((p) => (p === "asc" ? "desc" : "asc"))}
                >
                  {sortOrder === "asc" ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-end gap-2">
              <Button
                onClick={refreshReservations}
                variant="outline"
                size="sm"
                className="h-10 sm:h-9"
              >
                Refresh
              </Button>
              <Button
                onClick={() => setExportDialogOpen(true)}
                variant="outline"
                size="sm"
                className="h-10 sm:h-9"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading guests...</p>
          ) : filteredReservations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No guests found</p>
          ) : (
            <>
              <div className="md:hidden flex flex-col gap-3">
                {filteredReservations.map((reservation) => (
                  <GuestCard
                    key={reservation.id}
                    reservation={reservation}
                    balance={balances[reservation.id] ?? 0}
                    onOpen={openReservationFolio}
                    getStatusColor={getStatusColor}
                    siteLabel={terminology.site}
                  />
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Confirmation</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>{terminology.site}</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Folio Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReservations.map((reservation) => (
                      <GuestRow
                        key={reservation.id}
                        reservation={reservation}
                        balance={balances[reservation.id] ?? 0}
                        isMobile={isMobile}
                        onOpen={openReservationFolio}
                        getStatusColor={getStatusColor}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Show</span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(v) => setPageSize(Number(v))}
                    >
                      <SelectTrigger className="w-[100px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">per page</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)} to{" "}
                    {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
                  </p>
                  <Pagination className="mx-0 w-auto">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-3 text-sm">
                          Page {currentPage} of {totalPages}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className={
                            currentPage === totalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        title={`Export ${pageTitle}`}
        filenameBase="in-park-guests"
        data={reservations}
        columns={exportColumns}
        filters={exportFilters}
      />
    </DashboardLayout>
  );
};

interface GuestRowProps {
  reservation: any;
  balance: number;
  isMobile: boolean;
  onOpen: (id: string) => void;
  getStatusColor: (status: string) => string;
}

const GuestRow = ({ reservation, balance, isMobile, onOpen, getStatusColor }: GuestRowProps) => {
  const longPressHandlers = useLongPress(() => onOpen(reservation.id), 500);
  const balanceClass = balance > 0 ? "text-orange-600" : "text-emerald-600";

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => !isMobile && onOpen(reservation.id)}
      {...(isMobile ? longPressHandlers : {})}
    >
      <TableCell className="font-mono text-xs">#{reservation.confirmation_number}</TableCell>
      <TableCell>
        <div className="font-medium">
          {reservation.guests?.first_name} {reservation.guests?.last_name}
        </div>
        <div className="text-xs text-muted-foreground">{reservation.guests?.email}</div>
      </TableCell>
      <TableCell className="text-sm">
        {formatLocalDate(reservation.check_in_date, "MM/dd/yyyy")} -{" "}
        {formatLocalDate(reservation.check_out_date, "MM/dd/yyyy")}
      </TableCell>
      <TableCell>
        {reservation.sites?.site_number || "Unassigned"}
        {(reservation.sites?.site_types?.code || reservation.sites?.site_types?.name) && (
          <span className="text-xs text-muted-foreground ml-1">
            ({reservation.sites.site_types.code || reservation.sites.site_types.name})
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge className={getStatusColor(reservation.status)} variant="secondary">
          {reservation.status}
        </Badge>
      </TableCell>
      <TableCell className={`text-right font-semibold ${balanceClass}`}>
        ${balance.toFixed(2)}
      </TableCell>
    </TableRow>
  );
};

interface GuestCardProps {
  reservation: any;
  balance: number;
  onOpen: (id: string) => void;
  getStatusColor: (status: string) => string;
  siteLabel: string;
}

const GuestCard = ({ reservation, balance, onOpen, getStatusColor, siteLabel }: GuestCardProps) => {
  const siteType = reservation.sites?.site_types?.code || reservation.sites?.site_types?.name;
  const balanceClass = balance > 0 ? "text-orange-600" : "text-emerald-600";

  return (
    <div
      className="rounded-lg border bg-card p-3 space-y-3 cursor-pointer active:scale-[0.99] transition"
      onClick={() => onOpen(reservation.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">
            {reservation.guests?.first_name} {reservation.guests?.last_name}
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            #{reservation.confirmation_number}
          </div>
          {reservation.guests?.email && (
            <div className="text-xs text-muted-foreground truncate">{reservation.guests.email}</div>
          )}
        </div>
        <Badge className={getStatusColor(reservation.status)} variant="secondary">
          {reservation.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">Dates</div>
          <div>
            {formatLocalDate(reservation.check_in_date, "MM/dd")} –{" "}
            {formatLocalDate(reservation.check_out_date, "MM/dd/yy")}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">{siteLabel}</div>
          <div className="truncate">
            {reservation.sites?.site_number || "Unassigned"}
            {siteType && <span className="text-xs text-muted-foreground ml-1">({siteType})</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="text-[10px] uppercase text-muted-foreground">Folio Balance</div>
        <div className={`text-sm font-semibold ${balanceClass}`}>${balance.toFixed(2)}</div>
      </div>
    </div>
  );
};

export default InParkGuests;
