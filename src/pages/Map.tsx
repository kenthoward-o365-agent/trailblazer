import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Upload, Settings, CheckCircle, XCircle, ClipboardCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import * as LucideIcons from "lucide-react";
import { format } from "date-fns";
import { useProperty } from "@/contexts/PropertyContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolveMapImageUrl } from "@/lib/mapImage";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Site {
  id: string;
  site_number: string;
  description: string | null;
  map_x: number | null;
  map_y: number | null;
  max_occupancy: number;
  max_vehicle_length: number | null;
  site_access_type: string;
  has_towed_vehicle_parking: boolean;
  has_towing_vehicle_parking: boolean;
  is_active: boolean;
  maintenance_status: string | null;
  unavailable_start_date: string | null;
  unavailable_end_date: string | null;
  unavailable_reason: string | null;
  site_types: {
    name: string;
    base_price: number;
    icon: string;
  };
}

interface Property {
  map_image_url: string | null;
  map_width: number;
  map_height: number;
}

type SiteStatus = "available" | "in_house" | "confirmed" | "inspection" | "unavailable";

const statusColors: Record<SiteStatus, string> = {
  available: "bg-gray-400",
  in_house: "bg-emerald-600",
  confirmed: "bg-blue-500",
  inspection: "bg-yellow-500",
  unavailable: "bg-red-500",
};

const statusLabels: Record<SiteStatus, string> = {
  available: "Available",
  in_house: "In-Park",
  confirmed: "Confirmed",
  inspection: "Waiting on Inspection",
  unavailable: "Not Available",
};

export default function Map() {
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const isMobile = useIsMobile();
  const [sites, setSites] = useState<Site[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [mapImageSrc, setMapImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [inHouseSites, setInHouseSites] = useState<Set<string>>(new Set());
  const [inHouseReservations, setInHouseReservations] = useState<Record<string, string>>({}); // site_id -> reservation_id
  const [confirmedSites, setConfirmedSites] = useState<Set<string>>(new Set());
  const [confirmedReservations, setConfirmedReservations] = useState<Record<string, string>>({}); // site_id -> reservation_id
  const [highlightedStatuses, setHighlightedStatuses] = useState<Set<SiteStatus>>(new Set());
  const [unavailableDialogOpen, setUnavailableDialogOpen] = useState(false);
  const [unavailableForm, setUnavailableForm] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  });

  const toggleStatus = (status: SiteStatus) => {
    setHighlightedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (selectedProperty?.id) {
      fetchMapData();
    }
  }, [selectedProperty?.id]);

  const getSiteStatus = (site: Site): SiteStatus => {
    // If there's a checked-in reservation, it's in-house
    if (inHouseSites.has(site.id)) return "in_house";
    
    // If there's a confirmed reservation for today, it's confirmed
    if (confirmedSites.has(site.id)) return "confirmed";
    
    // Check maintenance_status from database
    if (site.maintenance_status === "inspection") return "inspection";
    
    if (site.maintenance_status === "unavailable") {
      // Check if we're within the unavailable date range
      const today = format(new Date(), "yyyy-MM-dd");
      if (site.unavailable_start_date && site.unavailable_end_date) {
        if (today >= site.unavailable_start_date && today <= site.unavailable_end_date) {
          return "unavailable";
        }
      } else if (site.unavailable_start_date && !site.unavailable_end_date) {
        if (today >= site.unavailable_start_date) {
          return "unavailable";
        }
      } else {
        return "unavailable";
      }
    }
    
    // Legacy check for is_active
    if (!site.is_active) return "unavailable";
    
    return "available";
  };

  const getStatusCounts = (): Record<SiteStatus, number> => {
    const counts: Record<SiteStatus, number> = {
      available: 0,
      in_house: 0,
      confirmed: 0,
      inspection: 0,
      unavailable: 0,
    };
    sites.forEach(site => {
      counts[getSiteStatus(site)]++;
    });
    return counts;
  };

  const fetchMapData = async () => {
    if (!selectedProperty?.id) return;
    
    try {
      setLoading(true);
      const today = format(new Date(), "yyyy-MM-dd");

      // Fetch property with map settings
      const { data: propertyData, error: propertyError } = await supabase
        .from("properties")
        .select("map_image_url, map_width, map_height")
        .eq("id", selectedProperty.id)
        .single();

      if (propertyError) throw propertyError;
      setProperty(propertyData);
      setMapImageSrc(await resolveMapImageUrl(propertyData?.map_image_url));

      // Fetch sites with their types, positions, and maintenance status
      const { data: sitesData, error: sitesError } = await supabase
        .from("sites")
        .select(`
          id,
          site_number,
          description,
          map_x,
          map_y,
          max_occupancy,
          max_vehicle_length,
          site_access_type,
          has_towed_vehicle_parking,
          has_towing_vehicle_parking,
          is_active,
          maintenance_status,
          unavailable_start_date,
          unavailable_end_date,
          unavailable_reason,
          site_types (
            name,
            base_price,
            icon
          )
        `)
        .eq("property_id", selectedProperty.id)
        .not("map_x", "is", null)
        .not("map_y", "is", null);

      if (sitesError) throw sitesError;
      setSites(sitesData as Site[]);

      // Fetch currently in-house sites (checked in)
      const { data: inHouseData, error: inHouseError } = await supabase
        .from("reservations")
        .select("id, site_id")
        .eq("property_id", selectedProperty.id)
        .eq("status", "CHECKED_IN");

      if (inHouseError) throw inHouseError;
      setInHouseSites(new Set(inHouseData?.map(r => r.site_id) || []));
      
      // Map site_id -> reservation_id for in-house guests
      const reservationMap: Record<string, string> = {};
      inHouseData?.forEach(r => {
        reservationMap[r.site_id] = r.id;
      });
      setInHouseReservations(reservationMap);

      // Fetch confirmed reservations arriving today
      const { data: confirmedData, error: confirmedError } = await supabase
        .from("reservations")
        .select("id, site_id")
        .eq("property_id", selectedProperty.id)
        .eq("status", "CONFIRMED")
        .eq("check_in_date", today);

      if (confirmedError) throw confirmedError;
      setConfirmedSites(new Set(confirmedData?.map(r => r.site_id) || []));
      
      // Map site_id -> reservation_id for confirmed reservations
      const confirmedMap: Record<string, string> = {};
      confirmedData?.forEach(r => {
        confirmedMap[r.site_id] = r.id;
      });
      setConfirmedReservations(confirmedMap);

    } catch (error: any) {
      console.error("Error fetching map data:", error);
      toast.error("Failed to load map data");
    } finally {
      setLoading(false);
    }
  };

  const handleSiteClick = (site: Site) => {
    // If site has an in-house guest, go directly to folio
    if (inHouseReservations[site.id]) {
      navigate(`/reservation/edit?id=${inHouseReservations[site.id]}&focus=folio`);
      return;
    }
    // If site has a confirmed reservation arriving today, go directly to edit page
    if (confirmedReservations[site.id]) {
      navigate(`/reservation/edit?id=${confirmedReservations[site.id]}`);
      return;
    }
    setSelectedSite(site);
  };

  const handleCreateReservation = () => {
    if (selectedSite) {
      navigate(`/book?site=${selectedSite.id}`);
    }
  };

  const handleViewFolio = () => {
    if (selectedSite && inHouseReservations[selectedSite.id]) {
      navigate(`/reservation/edit?id=${inHouseReservations[selectedSite.id]}&focus=folio`);
    }
  };

  const handleViewReservation = () => {
    if (selectedSite && confirmedReservations[selectedSite.id]) {
      navigate(`/reservation/edit?id=${confirmedReservations[selectedSite.id]}`);
    }
  };

  const handleMarkAvailable = async () => {
    if (!selectedSite) return;
    
    const { error } = await supabase
      .from("sites")
      .update({
        maintenance_status: "available",
        unavailable_start_date: null,
        unavailable_end_date: null,
        unavailable_reason: null,
      })
      .eq("id", selectedSite.id);

    if (error) {
      toast.error("Failed to update site status");
    } else {
      toast.success(`Site ${selectedSite.site_number} marked as available`);
      // Update local state
      setSites(prev => prev.map(s => 
        s.id === selectedSite.id 
          ? { ...s, maintenance_status: "available", unavailable_start_date: null, unavailable_end_date: null, unavailable_reason: null }
          : s
      ));
      setSelectedSite(prev => prev ? { ...prev, maintenance_status: "available", unavailable_start_date: null, unavailable_end_date: null, unavailable_reason: null } : null);
    }
  };

  const handleOpenUnavailableDialog = () => {
    if (!selectedSite) return;
    setUnavailableForm({
      startDate: selectedSite.unavailable_start_date || format(new Date(), "yyyy-MM-dd"),
      endDate: selectedSite.unavailable_end_date || "",
      reason: selectedSite.unavailable_reason || "",
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
      // Update local state
      setSites(prev => prev.map(s => 
        s.id === selectedSite.id 
          ? { ...s, maintenance_status: "unavailable", unavailable_start_date: unavailableForm.startDate, unavailable_end_date: unavailableForm.endDate || null, unavailable_reason: unavailableForm.reason || null }
          : s
      ));
      setSelectedSite(prev => prev ? { ...prev, maintenance_status: "unavailable", unavailable_start_date: unavailableForm.startDate, unavailable_end_date: unavailableForm.endDate || null, unavailable_reason: unavailableForm.reason || null } : null);
    }
  };

  const handleSetInspection = async () => {
    if (!selectedSite) return;
    
    const { error } = await supabase
      .from("sites")
      .update({ maintenance_status: "inspection" })
      .eq("id", selectedSite.id);

    if (error) {
      toast.error("Failed to update site status");
    } else {
      toast.success(`Site ${selectedSite.site_number} set to Waiting on Inspection`);
      setSites(prev => prev.map(s => 
        s.id === selectedSite.id ? { ...s, maintenance_status: "inspection" } : s
      ));
      setSelectedSite(prev => prev ? { ...prev, maintenance_status: "inspection" } : null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!property?.map_image_url) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
          <Upload className="h-16 w-16 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">No Map Configured</h2>
          <p className="text-muted-foreground">Upload a campground map to get started</p>
          <Button onClick={() => navigate("/map-editor")}>
            <Settings className="mr-2 h-4 w-4" />
            Configure Map
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const detailsContent = selectedSite ? (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Site {selectedSite.site_number}</h2>
        <Badge className="mt-2">{selectedSite.site_types.name}</Badge>
        {selectedSite.description && (
          <p className="text-sm text-muted-foreground mt-2">{selectedSite.description}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base Price:</span>
          <span className="font-semibold">${selectedSite.site_types.base_price}/night</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Access Type:</span>
          <span className="font-semibold capitalize">
            {selectedSite.site_access_type.replace("_", " ")}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Max Occupancy:</span>
          <span className="font-semibold">{selectedSite.max_occupancy} guests</span>
        </div>
        {selectedSite.max_vehicle_length && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Max Vehicle Length:</span>
            <span className="font-semibold">{selectedSite.max_vehicle_length} ft</span>
          </div>
        )}
        {selectedSite.has_towed_vehicle_parking && (
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-sm">Towed vehicle parking available</span>
          </div>
        )}
        {selectedSite.has_towing_vehicle_parking && (
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-sm">Towing vehicle parking available</span>
          </div>
        )}
      </div>

      {getSiteStatus(selectedSite) === "in_house" ? (
        <Button className="w-full h-11" onClick={handleViewFolio}>
          View Folio
        </Button>
      ) : getSiteStatus(selectedSite) === "confirmed" ? (
        <Button className="w-full h-11" onClick={handleViewReservation}>
          View Reservation
        </Button>
      ) : getSiteStatus(selectedSite) === "inspection" ? (
        <div className="space-y-3">
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">Awaiting inspection after checkout</p>
          </div>
          <Button className="w-full h-11" onClick={handleMarkAvailable}>
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Complete Inspection
          </Button>
          <Button variant="outline" className="w-full h-11" onClick={handleOpenUnavailableDialog}>
            <XCircle className="h-4 w-4 mr-2" />
            Set Unavailable
          </Button>
        </div>
      ) : getSiteStatus(selectedSite) === "unavailable" ? (
        <div className="space-y-3">
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Not Available</p>
            {selectedSite.unavailable_start_date && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedSite.unavailable_start_date} - {selectedSite.unavailable_end_date || "Ongoing"}
              </p>
            )}
            {selectedSite.unavailable_reason && (
              <p className="text-xs text-muted-foreground mt-1">{selectedSite.unavailable_reason}</p>
            )}
          </div>
          <Button className="w-full h-11" onClick={handleMarkAvailable}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark Available
          </Button>
          <Button variant="outline" className="w-full h-11" onClick={handleOpenUnavailableDialog}>
            Edit Unavailability
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button className="w-full h-11" onClick={handleCreateReservation}>
            Create Reservation
          </Button>
          <Button variant="outline" className="w-full h-11" onClick={handleSetInspection}>
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Set Waiting on Inspection
          </Button>
          <Button variant="outline" className="w-full h-11" onClick={handleOpenUnavailableDialog}>
            <XCircle className="h-4 w-4 mr-2" />
            Set Unavailable
          </Button>
        </div>
      )}
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
      <p>Select a site on the map to view details and create a reservation</p>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Campground Map</h1>
            <p className="text-sm text-muted-foreground">Tap a site to view details or create a reservation</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/map-editor")} className="w-full sm:w-auto">
            <Settings className="mr-2 h-4 w-4" />
            Edit Map
          </Button>
        </div>

        {/* Legend & Filter with Counts */}
        <Card className="p-3 sm:p-4">
          <h3 className="font-semibold mb-3 text-sm sm:text-base">Filter by Status</h3>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            {(() => {
              const counts = getStatusCounts();
              return (Object.keys(statusColors) as SiteStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`flex items-center justify-between sm:justify-start gap-2 px-3 py-2 sm:py-1.5 rounded-full border transition-all min-h-11 sm:min-h-0 ${
                    highlightedStatuses.size === 0 || highlightedStatuses.has(status)
                      ? "border-primary bg-primary/10"
                      : "border-muted bg-muted/30 opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${statusColors[status]}`} />
                    <span className="text-sm truncate">{statusLabels[status]}</span>
                  </div>
                  <Badge variant="secondary" className="ml-1">{counts[status]}</Badge>
                </button>
              ));
            })()}
            <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:border-l sm:pl-3 sm:ml-1">
              <span className="text-sm font-medium text-muted-foreground">Total:</span>
              <Badge variant="outline">{sites.length}</Badge>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Map Display */}
          <Card className="lg:col-span-2 p-2 sm:p-4">
            <div className="relative" style={{ width: "100%", paddingBottom: `${(property.map_height / property.map_width) * 100}%` }}>
              <div className="absolute inset-0">
                <img
                  src={mapImageSrc ?? undefined}
                  alt="Campground Map"
                  className="w-full h-full object-contain"
                />
                {sites.map((site) => {
                  const IconComponent = (LucideIcons as any)[
                    site.site_types.icon.charAt(0).toUpperCase() +
                      site.site_types.icon.slice(1).replace(/-./g, (x) => x[1].toUpperCase())
                  ];
                  const status = getSiteStatus(site);

                  const isDimmed = highlightedStatuses.size > 0 && !highlightedStatuses.has(status);

                  const getTooltipContent = () => {
                    let content = `${site.site_number} - ${statusLabels[status]}`;
                    if (status === 'unavailable' && site.unavailable_reason) {
                      content += `\n${site.unavailable_reason}`;
                      if (site.unavailable_start_date) {
                        content += `\n${site.unavailable_start_date}`;
                        if (site.unavailable_end_date) {
                          content += ` to ${site.unavailable_end_date}`;
                        } else {
                          content += ' - Ongoing';
                        }
                      }
                    }
                    if (status === 'inspection') {
                      content += '\nAwaiting inspection after checkout';
                    }
                    return content;
                  };

                  return (
                    <Tooltip key={site.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleSiteClick(site)}
                          className={`absolute transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 sm:w-5 sm:h-5 rounded-full border border-white shadow-md transition-all hover:scale-150 active:scale-125 flex items-center justify-center ${
                            statusColors[status]
                          } ${selectedSite?.id === site.id ? "ring-2 ring-primary scale-150" : ""} ${isDimmed ? "opacity-20" : "opacity-100"}`}
                          style={{
                            left: `${site.map_x}%`,
                            top: `${site.map_y}%`,
                          }}
                        >
                          <span className="text-[7px] sm:text-[6px] font-bold text-white">{site.site_number}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
                        {getTooltipContent()}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Site Details — sidebar on desktop */}
          {!isMobile && (
            <Card className="p-6">
              {detailsContent}
            </Card>
          )}
        </div>

      </div>

      {/* Site Details — bottom sheet on mobile */}
      {isMobile && (
        <Sheet open={!!selectedSite} onOpenChange={(open) => !open && setSelectedSite(null)}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader className="text-left mb-2">
              <SheetTitle>Site Details</SheetTitle>
            </SheetHeader>
            {detailsContent}
          </SheetContent>
        </Sheet>
      )}

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
    </DashboardLayout>
  );
}
