import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { ExportDialog } from "@/components/ExportDialog";
import { ExportColumn, ExportFilter } from "@/lib/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPress } from "@/hooks/useLongPress";
import { format } from "date-fns";
import { parseLocalDate, formatLocalDate } from "@/lib/dateUtils";

type SortOption = 'last_name' | 'confirmation_number' | 'check_out_date';

interface ClosedFolio {
  id: string;
  balance: number;
  closed_at: string;
  reservations: {
    id: string;
    confirmation_number: string;
    check_in_date: string;
    check_out_date: string;
    total_price: number;
    sites: {
      site_number: string;
      site_types: { name: string };
    } | null;
    guests: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
    };
  };
}

const GuestHistory = () => {
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const reservationIdFromUrl = searchParams.get("reservationId");
  
  const [closedFolios, setClosedFolios] = useState<ClosedFolio[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const totalPages = Math.ceil(totalCount / pageSize);
  
  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('last_name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Export configuration
  const exportColumns: ExportColumn[] = [
    { key: 'guest_name', label: 'Guest Name', format: (_, row) => `${row.reservations?.guests?.first_name || ''} ${row.reservations?.guests?.last_name || ''}`.trim() },
    { key: 'email', label: 'Email', format: (_, row) => row.reservations?.guests?.email || '' },
    { key: 'confirmation_number', label: 'Confirmation #', format: (_, row) => row.reservations?.confirmation_number || '' },
    { key: 'check_in_date', label: 'Check-in', format: (_, row) => row.reservations?.check_in_date ? formatLocalDate(row.reservations.check_in_date, 'MM/dd/yyyy') : '' },
    { key: 'check_out_date', label: 'Check-out', format: (_, row) => row.reservations?.check_out_date ? formatLocalDate(row.reservations.check_out_date, 'MM/dd/yyyy') : '' },
    { key: 'site_number', label: terminology.site, format: (_, row) => row.reservations?.sites?.site_number || '' },
    { key: 'site_type', label: 'Site Type', format: (_, row) => row.reservations?.sites?.site_types?.name || '' },
    { key: 'total_price', label: 'Total', format: (_, row) => row.reservations?.total_price ? `$${Number(row.reservations.total_price).toFixed(2)}` : '' },
    { key: 'balance', label: 'Balance', format: (v) => `$${Number(v || 0).toFixed(2)}` },
    { key: 'closed_at', label: 'Closed Date', format: (v) => v ? format(new Date(v), 'MM/dd/yyyy') : '' },
  ];

  const exportFilters: ExportFilter[] = [
    { 
      key: 'balance_status', 
      label: 'Balance Status', 
      type: 'select', 
      options: [
        { value: 'all', label: 'All' },
        { value: 'has_balance', label: 'Has Balance' },
        { value: 'zero_balance', label: 'Zero Balance' },
      ]
    },
  ];

  const handleApplyExportFilters = (filters: Record<string, string>) => {
    let result = closedFolios;
    if (filters.balance_status === 'has_balance') {
      result = result.filter(f => f.balance !== 0);
    } else if (filters.balance_status === 'zero_balance') {
      result = result.filter(f => f.balance === 0);
    }
    return result;
  };

  const handleOpenFolio = useCallback((folioId: string) => {
    navigate(`/guest-history/${folioId}`);
  }, [navigate]);

  // If there's a reservationId in URL, find and navigate to that folio
  useEffect(() => {
    if (reservationIdFromUrl && closedFolios.length > 0) {
      const matchingFolio = closedFolios.find(
        (f) => f.reservations?.id === reservationIdFromUrl
      );
      if (matchingFolio) {
        navigate(`/guest-history/${matchingFolio.id}`, { replace: true });
      }
    }
  }, [reservationIdFromUrl, closedFolios, navigate]);

  // Reset page when property or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProperty?.id, pageSize]);

  useEffect(() => {
    if (selectedProperty?.id) {
      loadClosedFolios();
    }
  }, [selectedProperty?.id, currentPage, pageSize]);

  const loadClosedFolios = async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    
    try {
      const { data, error, count } = await supabase
        .from("ledger_accounts")
        .select(`
          id,
          balance,
          closed_at,
          reservations!ledger_accounts_reservation_id_fkey (
            id,
            confirmation_number,
            check_in_date,
            check_out_date,
            total_price,
            sites (
              site_number,
              site_types (name)
            ),
            guests (
              id,
              first_name,
              last_name,
              email,
              phone
            )
          )
        `, { count: "exact" })
        .eq("property_id", selectedProperty.id)
        .eq("ledger_type", "guest")
        .eq("is_active", false)
        .not("closed_at", "is", null)
        .order("closed_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setClosedFolios((data as ClosedFolio[]) || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error loading closed folios:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFolios = useMemo(() => {
    let result = closedFolios.filter((folio) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const guestName = `${folio.reservations?.guests?.first_name} ${folio.reservations?.guests?.last_name}`.toLowerCase();
      const confirmationNumber = folio.reservations?.confirmation_number?.toLowerCase() || "";
      const siteNumber = folio.reservations?.sites?.site_number?.toLowerCase() || "";
      return guestName.includes(query) || confirmationNumber.includes(query) || siteNumber.includes(query);
    });

    // Apply sorting
    result = [...result].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'last_name':
          const nameA = (a.reservations?.guests?.last_name || '').toLowerCase();
          const nameB = (b.reservations?.guests?.last_name || '').toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        case 'confirmation_number':
          comparison = (a.reservations?.confirmation_number || '').localeCompare(b.reservations?.confirmation_number || '');
          break;
        case 'check_out_date':
          const dateA = a.reservations?.check_out_date ? new Date(a.reservations.check_out_date).getTime() : 0;
          const dateB = b.reservations?.check_out_date ? new Date(b.reservations.check_out_date).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [closedFolios, searchQuery, sortBy, sortOrder]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Guest History</h1>
          <p className="text-sm text-muted-foreground">
            View closed folios from checked-out guests
          </p>
        </div>

        {/* Search Card */}
        <Card className="p-3">
          <div className="grid md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Guest name, confirmation #, or site..."
                  className="pl-8 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Sort By</Label>
              <div className="flex items-center gap-1">
                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                  <SelectTrigger className="flex-1 h-9">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_name">Last Name</SelectItem>
                    <SelectItem value="confirmation_number">Confirmation</SelectItem>
                    <SelectItem value="check_out_date">Check Out Date</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={loadClosedFolios} variant="outline" size="sm">
                Refresh
              </Button>
              <Button 
                onClick={() => setExportDialogOpen(true)} 
                variant="outline" 
                size="sm"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </Card>

        {/* Table Card */}
        <Card className="p-3">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading closed folios...</p>
          ) : filteredFolios.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No closed folios found</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Confirmation</TableHead>
                    <TableHead>Stay Dates</TableHead>
                    <TableHead>{terminology.site}</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Closed</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFolios.map((folio) => (
                    <ClosedFolioRow
                      key={folio.id}
                      folio={folio}
                      isMobile={isMobile}
                      onOpen={handleOpenFolio}
                      formatCurrency={formatCurrency}
                      terminology={terminology}
                    />
                  ))}
                </TableBody>
              </Table>
              
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

        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          title="Export Guest History"
          filenameBase="guest-history"
          data={closedFolios}
          columns={exportColumns}
          filters={exportFilters}
          onApplyFilters={handleApplyExportFilters}
        />
      </div>
    </DashboardLayout>
  );
};

interface ClosedFolioRowProps {
  folio: ClosedFolio;
  isMobile: boolean;
  onOpen: (folioId: string) => void;
  formatCurrency: (amount: number) => string;
  terminology: { site: string };
}

const ClosedFolioRow = ({ folio, isMobile, onOpen, formatCurrency, terminology }: ClosedFolioRowProps) => {
  const longPressHandlers = useLongPress(() => onOpen(folio.id), 500);
  
  const guest = folio.reservations?.guests;
  const reservation = folio.reservations;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onDoubleClick={() => !isMobile && onOpen(folio.id)}
      {...(isMobile ? longPressHandlers : {})}
    >
      <TableCell>
        <div className="font-medium">
          {guest?.first_name} {guest?.last_name}
        </div>
        <div className="text-xs text-muted-foreground">{guest?.email}</div>
      </TableCell>
      <TableCell className="font-mono text-xs">
        #{reservation?.confirmation_number}
      </TableCell>
      <TableCell className="text-sm">
        {reservation?.check_in_date && formatLocalDate(reservation.check_in_date, "MM/dd/yyyy")} -{" "}
        {reservation?.check_out_date && formatLocalDate(reservation.check_out_date, "MM/dd/yyyy")}
      </TableCell>
      <TableCell>
        {reservation?.sites?.site_number || 'N/A'}
        {reservation?.sites?.site_types?.name && (
          <span className="text-xs text-muted-foreground ml-1">
            ({reservation.sites.site_types.name})
          </span>
        )}
      </TableCell>
      <TableCell className={`text-right font-medium ${folio.balance !== 0 ? "text-destructive" : ""}`}>
        {formatCurrency(folio.balance)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {folio.closed_at && format(new Date(folio.closed_at), "MMM dd, yyyy")}
      </TableCell>
      <TableCell className="text-right">
        <Button 
          size="sm" 
          variant="outline" 
          className="h-7 px-2 text-xs"
          onClick={(e) => { e.stopPropagation(); onOpen(folio.id); }}
        >
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default GuestHistory;
