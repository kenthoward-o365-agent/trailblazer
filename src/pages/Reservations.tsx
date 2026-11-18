import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Plus, Search, CheckCircle, Wand2, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { ExportDialog } from "@/components/ExportDialog";
import { ExportColumn, ExportFilter } from "@/lib/exportUtils";
import { AutoAssignDialog } from "@/components/AutoAssignDialog";
import { format, parseISO } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { CancellationBalanceDialog } from "@/components/CancellationBalanceDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPress } from "@/hooks/useLongPress";

interface CancellationDialogState {
  open: boolean;
  reservationId: string;
  guestName: string;
  depositBalance: number;
  depositAccountId: string;
}

type SortOption = 'confirmation_number' | 'guest_name' | 'check_in_date';

const Reservations = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();
  const isMobile = useIsMobile();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("confirmed");
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('guest_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [cancellationDialog, setCancellationDialog] = useState<CancellationDialogState>({
    open: false,
    reservationId: "",
    guestName: "",
    depositBalance: 0,
    depositAccountId: "",
  });
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Export configuration
  const exportColumns: ExportColumn[] = [
    { key: 'confirmation_number', label: 'Confirmation #' },
    { key: 'guest_name', label: 'Guest Name', format: (_, row) => `${row.guests?.first_name || ''} ${row.guests?.last_name || ''}`.trim() },
    { key: 'email', label: 'Email', format: (_, row) => row.guests?.email || '' },
    { key: 'phone', label: 'Phone', format: (_, row) => row.guests?.phone || '' },
    { key: 'check_in_date', label: 'Check-in', format: (v) => v ? formatLocalDate(v, 'MM/dd/yyyy') : '' },
    { key: 'check_out_date', label: 'Check-out', format: (v) => v ? formatLocalDate(v, 'MM/dd/yyyy') : '' },
    { key: 'site_number', label: terminology.site, format: (_, row) => row.sites?.site_number || '' },
    { key: 'site_type', label: 'Site Type', format: (_, row) => row.sites?.site_types?.name || '' },
    { key: 'status', label: 'Status' },
    { key: 'total_price', label: 'Total', format: (v) => v ? `$${Number(v).toFixed(2)}` : '' },
  ];

  const exportFilters: ExportFilter[] = [
    { 
      key: 'status', 
      label: 'Status', 
      type: 'select', 
      options: [
        { value: 'all', label: 'All Statuses' },
        { value: 'PENDING', label: 'Pending' },
        { value: 'CONFIRMED', label: 'Confirmed' },
        { value: 'CHECKED_IN', label: 'Checked In' },
        { value: 'CANCELLED', label: 'Cancelled' },
        { value: 'NO_SHOW', label: 'No Show' },
      ]
    },
  ];

  const handleApplyExportFilters = (filters: Record<string, string>) => {
    let result = reservations;
    if (filters.status && filters.status !== 'all') {
      result = result.filter(r => r.status === filters.status);
    }
    return result;
  };
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleOpenReservation = useCallback((id: string) => {
    navigate(`/reservation/edit?id=${id}`);
  }, [navigate]);

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'arrivals' || filter === 'departures' || filter === 'checked_in') {
      setDateFilter(filter);
    }
  }, [searchParams]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, dateFilter, selectedProperty?.id, pageSize]);

  useEffect(() => {
    if (selectedProperty?.id) {
      loadReservations();
    }
  }, [statusFilter, dateFilter, selectedProperty?.id, currentPage, pageSize]);

  // Refresh data when returning to this page (e.g., after editing a reservation)
  useEffect(() => {
    const handleFocus = () => {
      if (selectedProperty?.id) {
        loadReservations();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedProperty?.id, statusFilter, dateFilter, currentPage, pageSize]);

  const loadReservations = async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    
    let query = supabase
      .from("reservations")
      .select("*, confirmation_number, sites(site_number, site_types(name, code)), guests(first_name, last_name, email, phone)", { count: "exact" })
      .eq("property_id", selectedProperty.id)
      .order("check_in_date", { ascending: false })
      .range(from, to);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter.toUpperCase() as any);
    } else {
      // Exclude CHECKED_OUT from "all" view - completed stays are in Guest History
      query = query.neq("status", "CHECKED_OUT");
    }

    if (dateFilter === 'arrivals') {
      query = query.eq("check_in_date", today).eq("status", "CONFIRMED");
    } else if (dateFilter === 'departures') {
      query = query.eq("check_out_date", today).in("status", ["CONFIRMED", "CHECKED_IN"]);
    } else if (dateFilter === 'checked_in') {
      query = query.eq("status", "CHECKED_IN");
    }

    const { data, error, count } = await query;

    if (error) {
      toast.error("Failed to load reservations");
    } else {
      setReservations(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const handleCheckIn = async (reservationId: string) => {
    const { error } = await supabase
      .from("reservations")
      .update({ status: "CHECKED_IN" })
      .eq("id", reservationId);

    if (error) {
      toast.error("Failed to check in");
    } else {
      toast.success("Guest checked in successfully");
      loadReservations();
    }
  };

  const handleCheckOut = (reservationId: string) => {
    // Navigate to In-House Guests page with reservation pre-selected for proper checkout flow
    navigate(`/in-house-guests?reservationId=${reservationId}`);
  };

  const handleCancel = async (reservationId: string) => {
    const { data: advanceDeposit } = await supabase
      .from("ledger_accounts")
      .select("id, balance")
      .eq("reservation_id", reservationId)
      .eq("ledger_type", "advance_deposit")
      .eq("is_active", true)
      .maybeSingle();

    const reservation = reservations.find((r) => r.id === reservationId);
    const guestName = reservation
      ? `${reservation.guests?.first_name || ""} ${reservation.guests?.last_name || ""}`.trim()
      : "Guest";

    if (advanceDeposit && advanceDeposit.balance !== 0) {
      setCancellationDialog({
        open: true,
        reservationId,
        guestName,
        depositBalance: Math.abs(advanceDeposit.balance),
        depositAccountId: advanceDeposit.id,
      });
      return;
    }

    const { error } = await supabase
      .from("reservations")
      .update({ status: "CANCELLED" })
      .eq("id", reservationId);

    if (error) {
      toast.error("Failed to cancel reservation");
    } else {
      toast.success("Reservation cancelled");
      loadReservations();
    }
  };

  const filteredReservations = useMemo(() => {
    let result = reservations.filter((res) => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        res.guests?.first_name?.toLowerCase().includes(search) ||
        res.guests?.last_name?.toLowerCase().includes(search) ||
        res.guests?.email?.toLowerCase().includes(search) ||
        res.sites?.site_number?.toLowerCase().includes(search) ||
        (res.confirmation_number && res.confirmation_number.includes(search))
      );
    });

    // Apply dynamic sorting
    result = [...result].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'confirmation_number':
          comparison = (a.confirmation_number || '').localeCompare(b.confirmation_number || '');
          break;
        case 'guest_name':
          const nameA = (a.guests?.last_name || '').toLowerCase();
          const nameB = (b.guests?.last_name || '').toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        case 'check_in_date':
          const dateA = a.check_in_date ? new Date(a.check_in_date).getTime() : 0;
          const dateB = b.check_in_date ? new Date(b.check_in_date).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [reservations, searchTerm, sortBy, sortOrder]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-500/10 text-yellow-700";
      case "CONFIRMED": return "bg-blue-500/10 text-blue-700";
      case "CHECKED_IN": return "bg-green-500/10 text-green-700";
      case "CHECKED_OUT": return "bg-gray-500/10 text-gray-700";
      case "CANCELLED": return "bg-red-500/10 text-red-700";
      case "NO_SHOW": return "bg-purple-500/10 text-purple-700";
      default: return "bg-gray-500/10 text-gray-700";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl font-bold">
              {dateFilter === 'arrivals' ? "Today's Arrivals" : dateFilter === 'departures' ? "Today's Departures" : dateFilter === 'checked_in' ? "In-Park Guests" : "Reservations"}
            </h1>
            <p className="text-sm text-muted-foreground">Manage all bookings and guest stays</p>
          </div>
          <Button size="sm" onClick={() => navigate("/book")} className="w-full sm:w-auto h-10 sm:h-9">
            <Plus className="mr-2 h-4 w-4" />
            New Reservation
          </Button>
        </div>

        {/* Filters */}
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
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Sort By</Label>
              <div className="flex items-center gap-1">
                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
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
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:flex sm:items-end gap-2">
              <Button onClick={loadReservations} variant="outline" size="sm" className="h-10 sm:h-9">
                Refresh
              </Button>
              <Button
                onClick={() => setAutoAssignOpen(true)}
                variant="secondary"
                size="sm"
                className="h-10 sm:h-9"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Auto Assign</span>
                <span className="sm:hidden">Assign</span>
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

        {/* Reservations List/Table */}
        <Card className="p-3">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading reservations...</p>
          ) : filteredReservations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No reservations found</p>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="md:hidden flex flex-col gap-3">
                {filteredReservations.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    onOpen={handleOpenReservation}
                    onCheckIn={() => navigate(`/check-in?reservationId=${reservation.id}`)}
                    onCheckOut={() => handleCheckOut(reservation.id)}
                    onEdit={() => navigate(`/reservation/edit?id=${reservation.id}`)}
                    getStatusColor={getStatusColor}
                    siteLabel={terminology.site}
                  />
                ))}
              </div>

              {/* Desktop/tablet: table */}
              <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Confirmation</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>{terminology.site}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations.map((reservation) => (
                    <ReservationRow
                      key={reservation.id}
                      reservation={reservation}
                      isMobile={isMobile}
                      onOpen={handleOpenReservation}
                      onCheckIn={() => navigate(`/check-in?reservationId=${reservation.id}`)}
                      onCheckOut={() => handleCheckOut(reservation.id)}
                      onEdit={() => navigate(`/reservation/edit?id=${reservation.id}`)}
                      getStatusColor={getStatusColor}
                    />
                  ))}
                </TableBody>
              </Table>
              </div>
              
              {/* Pagination */}
              {totalPages > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Show</span>
                    <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(Number(v))}>
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
                    Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
                  </p>
                  <Pagination className="mx-0 w-auto">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <span className="px-3 text-sm">Page {currentPage} of {totalPages}</span>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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

      <CancellationBalanceDialog
        open={cancellationDialog.open}
        onOpenChange={(open) => setCancellationDialog((prev) => ({ ...prev, open }))}
        reservationId={cancellationDialog.reservationId}
        guestName={cancellationDialog.guestName}
        depositBalance={cancellationDialog.depositBalance}
        depositAccountId={cancellationDialog.depositAccountId}
        mode="cancel"
        onComplete={loadReservations}
      />

      <AutoAssignDialog
        open={autoAssignOpen}
        onOpenChange={setAutoAssignOpen}
        onComplete={loadReservations}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        title="Export Reservations"
        filenameBase="reservations"
        data={reservations}
        columns={exportColumns}
        filters={exportFilters}
        onApplyFilters={handleApplyExportFilters}
      />
    </DashboardLayout>
  );
};

// Separate component to use hooks per row for long press
interface ReservationRowProps {
  reservation: any;
  isMobile: boolean;
  onOpen: (id: string) => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onEdit: () => void;
  getStatusColor: (status: string) => string;
}

const ReservationRow = ({ reservation, isMobile, onOpen, onCheckIn, onCheckOut, onEdit, getStatusColor }: ReservationRowProps) => {
  const longPressHandlers = useLongPress(() => onOpen(reservation.id), 500);
  const today = new Date().toISOString().split("T")[0];

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onDoubleClick={() => !isMobile && onOpen(reservation.id)}
      {...(isMobile ? longPressHandlers : {})}
    >
      <TableCell className="font-mono text-xs">
        #{reservation.confirmation_number}
      </TableCell>
      <TableCell>
        <div className="font-medium">
          {reservation.guests?.first_name} {reservation.guests?.last_name}
        </div>
        <div className="text-xs text-muted-foreground">{reservation.guests?.email}</div>
      </TableCell>
      <TableCell className="text-sm">
        {formatLocalDate(reservation.check_in_date, "MM/dd/yyyy")} - {formatLocalDate(reservation.check_out_date, "MM/dd/yyyy")}
      </TableCell>
      <TableCell>
        {reservation.sites?.site_number || 'Unassigned'}
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
      <TableCell className="text-right font-medium">
        ${parseFloat(String(reservation.total_price)).toFixed(2)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          {reservation.status === "CONFIRMED" && reservation.check_in_date === today && (
            <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onCheckIn(); }}>
              <CheckCircle className="h-3 w-3 mr-1" />
              Check In
            </Button>
          )}
          {["CONFIRMED", "PENDING", "NO_SHOW", "CANCELLED", "CHECKED_OUT"].includes(reservation.status) && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              Edit
            </Button>
          )}
          {reservation.status === "CHECKED_IN" && (
            <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); onCheckOut(); }}>
              Check Out
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

interface ReservationCardProps {
  reservation: any;
  onOpen: (id: string) => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onEdit: () => void;
  getStatusColor: (status: string) => string;
  siteLabel: string;
}

const ReservationCard = ({ reservation, onOpen, onCheckIn, onCheckOut, onEdit, getStatusColor, siteLabel }: ReservationCardProps) => {
  const today = new Date().toISOString().split("T")[0];
  const siteType = reservation.sites?.site_types?.code || reservation.sites?.site_types?.name;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={() => onOpen(reservation.id)}
      >
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
          <div>{formatLocalDate(reservation.check_in_date, "MM/dd")} – {formatLocalDate(reservation.check_out_date, "MM/dd/yy")}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-muted-foreground">{siteLabel}</div>
          <div className="truncate">
            {reservation.sites?.site_number || 'Unassigned'}
            {siteType && <span className="text-xs text-muted-foreground ml-1">({siteType})</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-sm font-semibold">
          ${parseFloat(String(reservation.total_price)).toFixed(2)}
        </div>
        <div className="flex gap-2">
          {reservation.status === "CONFIRMED" && reservation.check_in_date === today && (
            <Button size="sm" className="h-9 px-3" onClick={onCheckIn}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Check In
            </Button>
          )}
          {["CONFIRMED", "PENDING", "NO_SHOW", "CANCELLED", "CHECKED_OUT"].includes(reservation.status) && (
            <Button size="sm" variant="outline" className="h-9 px-3" onClick={onEdit}>
              Edit
            </Button>
          )}
          {reservation.status === "CHECKED_IN" && (
            <Button size="sm" variant="secondary" className="h-9 px-3" onClick={onCheckOut}>
              Check Out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reservations;
