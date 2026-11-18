import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, DollarSign, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { ExportDialog } from "@/components/ExportDialog";
import { ExportColumn, ExportFilter } from "@/lib/exportUtils";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPress } from "@/hooks/useLongPress";

interface GuestWithStats {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  total_stays: number;
  total_revenue: number;
}

type SortOption = 'last_name' | 'total_stays' | 'total_revenue';

const GuestProfiles = () => {
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const isMobile = useIsMobile();
  const [guests, setGuests] = useState<GuestWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
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
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone', format: (v) => v || '' },
    { key: 'city', label: 'City', format: (v) => v || '' },
    { key: 'state', label: 'State', format: (v) => v || '' },
    { key: 'zipcode', label: 'Zip Code', format: (v) => v || '' },
    { key: 'total_stays', label: 'Total Stays' },
    { key: 'total_revenue', label: 'Total Revenue', format: (v) => `$${Number(v || 0).toFixed(2)}` },
  ];

  const exportFilters: ExportFilter[] = [
    { 
      key: 'min_stays', 
      label: 'Min Stays', 
      type: 'select', 
      options: [
        { value: 'all', label: 'All' },
        { value: '1', label: '1+ stays' },
        { value: '3', label: '3+ stays' },
        { value: '5', label: '5+ stays' },
        { value: '10', label: '10+ stays' },
      ]
    },
  ];

  const handleApplyExportFilters = (filters: Record<string, string>) => {
    let result = guests;
    if (filters.min_stays && filters.min_stays !== 'all') {
      const minStays = parseInt(filters.min_stays, 10);
      result = result.filter(g => g.total_stays >= minStays);
    }
    return result;
  };

  const handleOpenGuest = useCallback((id: string) => {
    navigate(`/guests/${id}`);
  }, [navigate]);

  // Reset page when property or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProperty?.id, pageSize]);

  useEffect(() => {
    if (selectedProperty?.id) {
      loadGuests();
    }
  }, [selectedProperty?.id, currentPage, pageSize]);

  const loadGuests = async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    
    try {
      // First get unique guest IDs with reservations at this property
      const { data: reservationsData, error: reservationsError } = await supabase
        .from("reservations")
        .select("guest_id, total_price, status")
        .eq("property_id", selectedProperty.id);

      if (reservationsError) throw reservationsError;

      const guestIds = [...new Set(reservationsData?.map(r => r.guest_id) || [])];
      setTotalCount(guestIds.length);
      
      if (guestIds.length === 0) {
        setGuests([]);
        setLoading(false);
        return;
      }

      // Paginate the guest IDs
      const paginatedIds = guestIds.slice(from, to + 1);
      
      if (paginatedIds.length === 0) {
        setGuests([]);
        setLoading(false);
        return;
      }

      const { data: guestData, error: guestError } = await supabase
        .from("guests")
        .select("id, first_name, last_name, email, phone, street_address, city, state, zipcode")
        .in("id", paginatedIds)
        .order("last_name");


      if (guestError) throw guestError;

      const guestsWithStats: GuestWithStats[] = (guestData || []).map(guest => {
        // All non-cancelled reservations count as stays
        const guestReservations = reservationsData?.filter(r => r.guest_id === guest.id && r.status !== "CANCELLED") || [];
        // Only checked-out reservations count toward revenue
        const checkedOutReservations = reservationsData?.filter(r => r.guest_id === guest.id && r.status === "CHECKED_OUT") || [];
        const total_stays = guestReservations.length;
        const total_revenue = checkedOutReservations.reduce((sum, r) => sum + parseFloat(String(r.total_price)), 0);
        
        return {
          ...guest,
          total_stays,
          total_revenue,
        };
      });

      setGuests(guestsWithStats);
    } catch (error) {
      console.error("Failed to load guests:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGuests = useMemo(() => {
    let result = guests.filter((guest) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        guest.first_name.toLowerCase().includes(searchLower) ||
        guest.last_name.toLowerCase().includes(searchLower) ||
        guest.email.toLowerCase().includes(searchLower) ||
        (guest.phone && guest.phone.includes(searchTerm)) ||
        (guest.city && guest.city.toLowerCase().includes(searchLower))
      );
    });

    // Apply sorting
    result = [...result].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'last_name':
          const nameA = (a.last_name || '').toLowerCase();
          const nameB = (b.last_name || '').toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        case 'total_stays':
          comparison = a.total_stays - b.total_stays;
          break;
        case 'total_revenue':
          comparison = a.total_revenue - b.total_revenue;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [guests, searchTerm, sortBy, sortOrder]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Guest Profiles</h1>
            <p className="text-sm text-muted-foreground">
              View and manage guest information and stay history
            </p>
          </div>
        </div>

        <Card className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <div>
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Name, email, phone, city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9"
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
                    <SelectItem value="total_stays">Stays</SelectItem>
                    <SelectItem value="total_revenue">Revenue</SelectItem>
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
              <Button onClick={loadGuests} variant="outline" size="sm" className="h-9">
                Refresh
              </Button>
              <Button 
                onClick={() => setExportDialogOpen(true)} 
                variant="outline" 
                size="sm"
                className="h-9"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground py-6 text-center">Loading guests...</p>
          ) : filteredGuests.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">
              {searchTerm ? "No guests match your search" : "No guests found"}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-center">Stays</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGuests.map((guest) => (
                    <GuestRow
                      key={guest.id}
                      guest={guest}
                      isMobile={isMobile}
                      onOpen={handleOpenGuest}
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
          title="Export Guest Profiles"
          filenameBase="guest-profiles"
          data={guests}
          columns={exportColumns}
          filters={exportFilters}
          onApplyFilters={handleApplyExportFilters}
        />
      </div>
    </DashboardLayout>
  );
};

// Separate component to use hooks per row for long press
interface GuestRowProps {
  guest: GuestWithStats;
  isMobile: boolean;
  onOpen: (id: string) => void;
}

const GuestRow = ({ guest, isMobile, onOpen }: GuestRowProps) => {
  const navigate = useNavigate();
  const longPressHandlers = useLongPress(() => onOpen(guest.id), 500);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onDoubleClick={() => !isMobile && onOpen(guest.id)}
      {...(isMobile ? longPressHandlers : {})}
    >
      <TableCell className="font-medium">
        {guest.first_name} {guest.last_name}
      </TableCell>
      <TableCell className="text-sm">{guest.email}</TableCell>
      <TableCell className="text-sm">{guest.phone || "—"}</TableCell>
      <TableCell className="text-sm">
        {guest.city && guest.state ? `${guest.city}, ${guest.state}` : guest.city || guest.state || "—"}
      </TableCell>
      <TableCell className="text-center">{guest.total_stays}</TableCell>
      <TableCell className="text-right font-medium">
        <span className="flex items-center justify-end gap-0.5">
          <DollarSign className="h-3 w-3 text-primary" />
          {guest.total_revenue.toFixed(2)}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => { e.stopPropagation(); navigate(`/guests/${guest.id}`); }}
        >
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default GuestProfiles;
