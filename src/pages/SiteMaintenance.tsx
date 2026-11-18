import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useProperty } from "@/contexts/PropertyContext";
import { CheckCircle, XCircle, ClipboardCheck, RefreshCw, Wrench, Plus } from "lucide-react";
import { WorkOrderFormDialog } from "@/components/work-orders/WorkOrderFormDialog";

interface Site {
  id: string;
  site_number: string;
  maintenance_status: string;
  unavailable_start_date: string | null;
  unavailable_end_date: string | null;
  unavailable_reason: string | null;
  site_types: {
    name: string;
  };
  currentReservation?: {
    id: string;
    status: string;
    guest_name: string;
  } | null;
}

type SiteStatus = 'available' | 'occupied' | 'inspection' | 'unavailable';

const SiteMaintenance = () => {
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const [sites, setSites] = useState<Site[]>([]);
  const [openWoBySite, setOpenWoBySite] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [unavailableDialogOpen, setUnavailableDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SiteStatus | null>(null);
  const [search, setSearch] = useState("");
  const [woDialogOpen, setWoDialogOpen] = useState(false);
  const [woSiteId, setWoSiteId] = useState<string | null>(null);
  const [unavailableForm, setUnavailableForm] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  });

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    // Fetch sites with their types
    const { data: sitesData, error: sitesError } = await supabase
      .from("sites")
      .select("id, site_number, maintenance_status, unavailable_start_date, unavailable_end_date, unavailable_reason, site_types(name)")
      .eq("is_active", true)
      .order("site_number", { ascending: true });

    if (sitesError) {
      toast.error("Failed to load sites");
      setLoading(false);
      return;
    }

    // Fetch current reservations for each site
    const { data: reservationsData } = await supabase
      .from("reservations")
      .select("id, site_id, status, guests(first_name, last_name)")
      .lte("check_in_date", today)
      .gte("check_out_date", today)
      .in("status", ["CONFIRMED", "CHECKED_IN"]);

    // Map reservations to sites
    const sitesWithReservations = sitesData?.map((site) => {
      const reservation = reservationsData?.find((r) => r.site_id === site.id);
      return {
        ...site,
        currentReservation: reservation
          ? {
              id: reservation.id,
              status: reservation.status,
              guest_name: `${reservation.guests?.first_name} ${reservation.guests?.last_name}`,
            }
          : null,
      };
    });

    // Sort: numeric first, then alphabetic
    const sortedSites = (sitesWithReservations || []).sort((a, b) => {
      const aNum = parseInt(a.site_number);
      const bNum = parseInt(b.site_number);
      const aIsNum = !isNaN(aNum);
      const bIsNum = !isNaN(bNum);

      if (aIsNum && bIsNum) return aNum - bNum;
      if (aIsNum) return -1;
      if (bIsNum) return 1;
      return a.site_number.localeCompare(b.site_number);
    });

    setSites(sortedSites);

    // Load open work order counts per site
    if (selectedProperty?.id) {
      const { data: woData } = await supabase
        .from("work_orders")
        .select("id, site_id")
        .eq("property_id", selectedProperty.id)
        .is("deleted_at", null)
        .in("status", ["open", "in_progress", "on_hold"])
        .not("site_id", "is", null)
        .order("created_at", { ascending: false });
      const counts = new Map<string, string[]>();
      for (const w of woData || []) {
        if (w.site_id) {
          const arr = counts.get(w.site_id) || [];
          arr.push(w.id);
          counts.set(w.site_id, arr);
        }
      }
      setOpenWoBySite(counts);
    }

    setLoading(false);
  };

  const getSiteStatus = (site: Site): SiteStatus => {
    // If there's a current reservation, it's occupied
    if (site.currentReservation) {
      return 'occupied';
    }
    // Check maintenance status
    if (site.maintenance_status === 'inspection') {
      return 'inspection';
    }
    if (site.maintenance_status === 'unavailable') {
      // Check if we're within the unavailable date range
      const today = new Date().toISOString().split("T")[0];
      if (site.unavailable_start_date && site.unavailable_end_date) {
        if (today >= site.unavailable_start_date && today <= site.unavailable_end_date) {
          return 'unavailable';
        }
      } else if (site.unavailable_start_date && !site.unavailable_end_date) {
        if (today >= site.unavailable_start_date) {
          return 'unavailable';
        }
      } else {
        return 'unavailable';
      }
    }
    return 'available';
  };

  const statusColors: Record<SiteStatus, string> = {
    available: 'bg-green-500/10 text-green-700 border-green-500/30',
    occupied: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
    inspection: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
    unavailable: 'bg-red-500/10 text-red-700 border-red-500/30',
  };

  const statusLabels: Record<SiteStatus, string> = {
    available: 'Available',
    occupied: 'Occupied',
    inspection: 'Waiting Inspection',
    unavailable: 'Not Available',
  };

  const handleMarkAvailable = async (site: Site) => {
    const { error } = await supabase
      .from("sites")
      .update({
        maintenance_status: "available",
        unavailable_start_date: null,
        unavailable_end_date: null,
        unavailable_reason: null,
      })
      .eq("id", site.id);

    if (error) {
      toast.error("Failed to update site status");
    } else {
      toast.success(`Site ${site.site_number} marked as available`);
      loadSites();
    }
  };

  const handleOpenUnavailableDialog = (site: Site) => {
    setSelectedSite(site);
    setUnavailableForm({
      startDate: site.unavailable_start_date || new Date().toISOString().split("T")[0],
      endDate: site.unavailable_end_date || "",
      reason: site.unavailable_reason || "",
    });
    setUnavailableDialogOpen(true);
  };

  const handleMarkUnavailable = async () => {
    if (!selectedSite) return;

    if (!unavailableForm.startDate) {
      toast.error("Start date is required");
      return;
    }

    const { error } = await supabase
      .from("sites")
      .update({
        maintenance_status: "unavailable",
        unavailable_start_date: unavailableForm.startDate,
        unavailable_end_date: unavailableForm.endDate || null,
        unavailable_reason: unavailableForm.reason || null,
      })
      .eq("id", selectedSite.id);

    if (error) {
      toast.error("Failed to update site status");
    } else {
      toast.success(`Site ${selectedSite.site_number} marked as unavailable`);
      setUnavailableDialogOpen(false);
      loadSites();
    }
  };

  const handleCompleteInspection = async (site: Site) => {
    const { error } = await supabase
      .from("sites")
      .update({ maintenance_status: "available" })
      .eq("id", site.id);

    if (error) {
      toast.error("Failed to complete inspection");
    } else {
      toast.success(`Site ${site.site_number} inspection complete - now available`);
      loadSites();
    }
  };

  const filteredSites = sites.filter((site) => {
    if (activeFilter && getSiteStatus(site) !== activeFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${site.site_number} ${site.site_types?.name ?? ""} ${
        site.currentReservation?.guest_name ?? ""
      }`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Site Turnover</h1>
            <p className="text-sm text-muted-foreground">
              Manage site inspections, turnover, and maintenance work orders
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => navigate("/site-turnover/work-orders")}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Work Orders
            </Button>
            <Button onClick={loadSites} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tabs strip */}
        <div className="inline-flex items-center gap-1 rounded-lg border bg-card p-1 text-sm">
          <button className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold">
            Sites
          </button>
          <button
            className="px-3 py-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => navigate("/site-turnover/work-orders")}
          >
            Work Orders
          </button>
        </div>

        {/* Search */}
        <Input
          placeholder="Search site number, type or guest…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11"
        />

        {/* Status Legend with counts + filtering */}
        <Card className="p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {(Object.keys(statusLabels) as SiteStatus[]).map((status) => {
              const count = sites.filter((s) => getSiteStatus(s) === status).length;
              const isActive = activeFilter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setActiveFilter(isActive ? null : status)}
                  className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-all min-h-11 ${
                    isActive
                      ? "ring-2 ring-primary border-primary"
                      : "hover:bg-muted/50 border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-3 h-3 rounded shrink-0 ${statusColors[status].split(" ")[0]}`} />
                    <span className="truncate">{statusLabels[status]}</span>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </button>
              );
            })}
          </div>
          {activeFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full sm:w-auto"
              onClick={() => setActiveFilter(null)}
            >
              Clear filter
            </Button>
          )}
        </Card>

        {loading ? (
          <Card className="p-8 text-center text-muted-foreground">Loading sites...</Card>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredSites.length === 0 && (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  No sites match your filters.
                </Card>
              )}
              {filteredSites.map((site) => {
                const status = getSiteStatus(site);
                const openIds = openWoBySite.get(site.id) || [];
                const openWos = openIds.length;
                const woHref =
                  openWos === 1
                    ? `/site-turnover/work-orders/${openIds[0]}`
                    : `/site-turnover/work-orders?site=${site.id}`;
                return (
                  <Card key={site.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold leading-tight">
                          Site {site.site_number}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {site.site_types?.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {openWos > 0 && (
                          <button
                            onClick={() => navigate(woHref)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          >
                            <Wrench className="h-3 w-3" />
                            {openWos} open
                          </button>
                        )}
                        <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
                      </div>
                    </div>

                    {(status === "occupied" || status === "unavailable") && (
                      <div className="text-sm text-muted-foreground">
                        {status === "occupied" && site.currentReservation && (
                          <span>Guest: {site.currentReservation.guest_name}</span>
                        )}
                        {status === "unavailable" && (
                          <div>
                            <div>
                              {site.unavailable_start_date} –{" "}
                              {site.unavailable_end_date || "Ongoing"}
                            </div>
                            {site.unavailable_reason && (
                              <div className="text-xs">{site.unavailable_reason}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      {status === "inspection" && (
                        <Button className="w-full h-11" onClick={() => handleCompleteInspection(site)}>
                          <ClipboardCheck className="h-4 w-4 mr-1" />
                          Complete Inspection
                        </Button>
                      )}
                      {status === "available" && (
                        <Button
                          variant="destructive"
                          className="w-full h-11"
                          onClick={() => handleOpenUnavailableDialog(site)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Mark Unavailable
                        </Button>
                      )}
                      {status === "unavailable" && (
                        <Button
                          variant="secondary"
                          className="w-full h-11"
                          onClick={() => handleMarkAvailable(site)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Available
                        </Button>
                      )}
                      {status === "occupied" && (
                        <span className="text-xs text-muted-foreground italic">
                          Move guest to set unavailable
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setWoSiteId(site.id);
                          setWoDialogOpen(true);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Report issue
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Desktop/tablet: table */}
            <Card className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSites.map((site) => {
                    const status = getSiteStatus(site);
                    const openIds = openWoBySite.get(site.id) || [];
                    const openWos = openIds.length;
                    const woHref =
                      openWos === 1
                        ? `/site-turnover/work-orders/${openIds[0]}`
                        : `/site-turnover/work-orders?site=${site.id}`;
                    return (
                      <TableRow key={site.id}>
                        <TableCell className="font-medium">{site.site_number}</TableCell>
                        <TableCell>{site.site_types?.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
                            {openWos > 0 && (
                              <button
                                onClick={() => navigate(woHref)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              >
                                <Wrench className="h-3 w-3" />
                                {openWos}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {status === "occupied" && site.currentReservation && (
                            <span>Guest: {site.currentReservation.guest_name}</span>
                          )}
                          {status === "unavailable" && (
                            <div>
                              <div>
                                {site.unavailable_start_date} –{" "}
                                {site.unavailable_end_date || "Ongoing"}
                              </div>
                              {site.unavailable_reason && (
                                <div className="text-xs">{site.unavailable_reason}</div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {status === "inspection" && (
                              <Button size="sm" onClick={() => handleCompleteInspection(site)}>
                                <ClipboardCheck className="h-4 w-4 mr-1" />
                                Complete Inspection
                              </Button>
                            )}
                            {status === "available" && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleOpenUnavailableDialog(site)}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Mark Unavailable
                              </Button>
                            )}
                            {status === "unavailable" && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleMarkAvailable(site)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Mark Available
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setWoSiteId(site.id);
                                setWoDialogOpen(true);
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Report issue
                            </Button>
                            {status === "occupied" && (
                              <span className="text-xs text-muted-foreground italic self-center">
                                Move guest to set unavailable
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>



      {/* Mark Unavailable Dialog */}
      <Dialog open={unavailableDialogOpen} onOpenChange={setUnavailableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Site {selectedSite?.site_number} as Unavailable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={unavailableForm.startDate}
                  onChange={(e) =>
                    setUnavailableForm({ ...unavailableForm, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={unavailableForm.endDate}
                  onChange={(e) =>
                    setUnavailableForm({ ...unavailableForm, endDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Enter the reason for unavailability..."
                value={unavailableForm.reason}
                onChange={(e) =>
                  setUnavailableForm({ ...unavailableForm, reason: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnavailableDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleMarkUnavailable}>
              Mark Unavailable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkOrderFormDialog
        open={woDialogOpen}
        onOpenChange={setWoDialogOpen}
        initialSiteId={woSiteId}
        onSaved={(id) => {
          loadSites();
          navigate(`/site-turnover/work-orders/${id}`);
        }}
      />
    </DashboardLayout>
  );
};

export default SiteMaintenance;