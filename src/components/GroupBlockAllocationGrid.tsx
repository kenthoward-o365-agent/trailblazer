import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Trash2, Copy, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { toast } from "sonner";
import { format, eachDayOfInterval, parseISO, addDays } from "date-fns";

interface SiteType {
  id: string;
  name: string;
  code: string | null;
}

interface Site {
  id: string;
  site_number: string;
  site_type_id: string;
}

interface Rate {
  id: string;
  rate_code: string;
  description: string | null;
}

interface Allocation {
  id?: string;
  allocation_date: string;
  site_type_id: string | null;
  site_id: string | null;
  rooms_blocked: number;
  rate_id: string | null;
  override_rate: number | null;
}

interface NewTypeAllocation {
  startDate: string;
  endDate: string;
  site_type_id: string;
  rooms_blocked: number;
  rate_id: string | null;
  override_rate: number | null;
}

interface NewSpecificAllocation {
  startDate: string;
  endDate: string;
  site_id: string;
  rate_id: string | null;
  override_rate: number | null;
}

interface GroupReservation {
  site_id: string | null;
  check_in_date: string;
  check_out_date: string;
}

interface GroupBlockAllocationGridProps {
  groupBlockId: string | null;
  propertyId: string;
  startDate: string;
  endDate: string;
  onAllocationsChange: (allocations: Allocation[]) => void;
  allocations: Allocation[];
  reservations?: GroupReservation[];
}

export function GroupBlockAllocationGrid({
  groupBlockId,
  propertyId,
  startDate,
  endDate,
  onAllocationsChange,
  allocations,
  reservations = [],
}: GroupBlockAllocationGridProps) {
  const terminology = usePropertyTerminology();
  const [siteTypes, setSiteTypes] = useState<SiteType[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state for adding new allocations
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [showSpecificForm, setShowSpecificForm] = useState(false);
  const [newTypeAllocation, setNewTypeAllocation] = useState<NewTypeAllocation | null>(null);
  const [newSpecificAllocation, setNewSpecificAllocation] = useState<NewSpecificAllocation | null>(null);

  // Separate allocations by type
  const typeAllocations = allocations.filter((a) => a.site_type_id && !a.site_id);
  const specificAllocations = allocations.filter((a) => a.site_id);

  useEffect(() => {
    if (propertyId) {
      loadData();
    }
  }, [propertyId]);

  const loadData = async () => {
    setLoading(true);
    const [typesRes, sitesRes, ratesRes] = await Promise.all([
      supabase
        .from("site_types")
        .select("id, name, code")
        .eq("property_id", propertyId)
        .order("name"),
      supabase
        .from("sites")
        .select("id, site_number, site_type_id")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("site_number"),
      supabase
        .from("rates")
        .select("id, rate_code, description")
        .eq("property_id", propertyId)
        .order("rate_code"),
    ]);

    if (typesRes.data) setSiteTypes(typesRes.data);
    if (sitesRes.data) setSites(sitesRes.data);
    if (ratesRes.data) setRates(ratesRes.data);
    setLoading(false);
  };

  // Get nights for the date range (check-in dates, not including last checkout date)
  const getNights = () => {
    if (!startDate || !endDate) return [];
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      // Include all nights from start_date to end_date - 1 (last night before checkout)
      return eachDayOfInterval({ start, end: addDays(end, -1) });
    } catch {
      return [];
    }
  };

  // Get nights for a specific date range
  const getNightsForRange = (rangeStart: string, rangeEnd: string) => {
    try {
      const start = parseISO(rangeStart);
      const end = parseISO(rangeEnd);
      return eachDayOfInterval({ start, end: addDays(end, -1) });
    } catch {
      return [];
    }
  };

  const nights = getNights();

  // Check if a specific allocation (site_id + date) has a reservation
  const isAllocationReserved = (siteId: string | null, allocationDate: string): boolean => {
    if (!siteId) return false;
    return reservations.some(res => {
      if (res.site_id !== siteId) return false;
      const allocDate = parseISO(allocationDate);
      const checkIn = parseISO(res.check_in_date);
      const checkOut = parseISO(res.check_out_date);
      // Allocation date must be >= check_in and < check_out
      return allocDate >= checkIn && allocDate < checkOut;
    });
  };

  // Initialize the type allocation form
  const openTypeForm = () => {
    if (!startDate || !endDate || siteTypes.length === 0) {
      toast.error(`Set date range and ensure ${terminology.siteTypes.toLowerCase()} exist first`);
      return;
    }
    setNewTypeAllocation({
      startDate: startDate,
      endDate: endDate,
      site_type_id: siteTypes[0].id,
      rooms_blocked: 1,
      rate_id: rates.length > 0 ? rates[0].id : null,
      override_rate: null,
    });
    setShowTypeForm(true);
  };

  // Initialize the specific allocation form
  const openSpecificForm = () => {
    if (!startDate || !endDate || sites.length === 0) {
      toast.error(`Set date range and ensure ${terminology.sites.toLowerCase()} exist first`);
      return;
    }
    setNewSpecificAllocation({
      startDate: startDate,
      endDate: endDate,
      site_id: sites[0].id,
      rate_id: rates.length > 0 ? rates[0].id : null,
      override_rate: null,
    });
    setShowSpecificForm(true);
  };

  // Add type allocations for the date range
  const addTypeAllocations = () => {
    if (!newTypeAllocation) return;

    const rangeNights = getNightsForRange(newTypeAllocation.startDate, newTypeAllocation.endDate);
    if (rangeNights.length === 0) {
      toast.error("Invalid date range");
      return;
    }

    const newAllocations: Allocation[] = rangeNights.map((night) => ({
      allocation_date: format(night, "yyyy-MM-dd"),
      site_type_id: newTypeAllocation.site_type_id,
      site_id: null,
      rooms_blocked: newTypeAllocation.rooms_blocked,
      rate_id: newTypeAllocation.rate_id,
      override_rate: newTypeAllocation.override_rate,
    }));

    onAllocationsChange([...allocations, ...newAllocations]);
    toast.success(`Added ${rangeNights.length} ${terminology.siteType.toLowerCase()} allocation(s)`);
    setShowTypeForm(false);
    setNewTypeAllocation(null);
  };

  // Add specific allocations for the date range
  const addSpecificAllocations = () => {
    if (!newSpecificAllocation) return;

    const rangeNights = getNightsForRange(newSpecificAllocation.startDate, newSpecificAllocation.endDate);
    if (rangeNights.length === 0) {
      toast.error("Invalid date range");
      return;
    }

    const site = sites.find((s) => s.id === newSpecificAllocation.site_id);

    const newAllocations: Allocation[] = rangeNights.map((night) => ({
      allocation_date: format(night, "yyyy-MM-dd"),
      site_type_id: site?.site_type_id || null,
      site_id: newSpecificAllocation.site_id,
      rooms_blocked: 1,
      rate_id: newSpecificAllocation.rate_id,
      override_rate: newSpecificAllocation.override_rate,
    }));

    onAllocationsChange([...allocations, ...newAllocations]);
    toast.success(`Added ${rangeNights.length} specific ${terminology.site.toLowerCase()} allocation(s)`);
    setShowSpecificForm(false);
    setNewSpecificAllocation(null);
  };

  const updateAllocation = (index: number, updates: Partial<Allocation>) => {
    const updated = [...allocations];
    
    // Enforce mutual exclusivity: clear override_rate when rate_id is set, and vice versa
    if ('rate_id' in updates && updates.rate_id && updates.rate_id !== 'none') {
      updates.override_rate = null;
    }
    if ('override_rate' in updates && updates.override_rate !== null && updates.override_rate !== undefined) {
      updates.rate_id = null;
    }
    
    updated[index] = { ...updated[index], ...updates };
    onAllocationsChange(updated);
  };

  const removeAllocation = (index: number) => {
    const updated = allocations.filter((_, i) => i !== index);
    onAllocationsChange(updated);
  };

  const applyToAllNights = (index: number) => {
    const allocation = allocations[index];
    if (!allocation || nights.length === 0) return;

    // Remove existing allocations of the same type/site for all dates
    const filtered = allocations.filter((a, i) => {
      if (i === index) return false;
      if (allocation.site_id) {
        return a.site_id !== allocation.site_id;
      } else if (allocation.site_type_id) {
        return a.site_type_id !== allocation.site_type_id || a.site_id !== null;
      }
      return true;
    });

    // Add new allocations for all nights
    const newAllocations = nights.map((night) => ({
      ...allocation,
      id: undefined,
      allocation_date: format(night, "yyyy-MM-dd"),
    }));

    onAllocationsChange([...filtered, ...newAllocations]);
    toast.success(`Applied to all ${nights.length} nights`);
  };

  const getSiteTypeName = (id: string | null) => {
    if (!id) return "";
    const type = siteTypes.find((t) => t.id === id);
    return type ? (type.code || type.name) : "";
  };

  const getSiteNumber = (id: string | null) => {
    if (!id) return "";
    const site = sites.find((s) => s.id === id);
    return site?.site_number || "";
  };

  const getRateName = (id: string | null) => {
    if (!id) return "No Rate";
    const rate = rates.find((r) => r.id === id);
    return rate?.rate_code || "";
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading allocation data...</p>;
  }

  if (!startDate || !endDate) {
    return (
      <p className="text-muted-foreground">
        Set the date range above to configure room allocations.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* By Room Type Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">By {terminology.siteType}</Label>
          {!showTypeForm && (
            <Button variant="outline" size="sm" onClick={openTypeForm}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Add Type Allocation Form */}
        {showTypeForm && newTypeAllocation && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Add {terminology.siteType} Allocation</Label>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setShowTypeForm(false);
                  setNewTypeAllocation(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Select
                  value={newTypeAllocation.startDate}
                  onValueChange={(value) =>
                    setNewTypeAllocation({ ...newTypeAllocation, startDate: value })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nights.map((night) => (
                      <SelectItem key={night.toISOString()} value={format(night, "yyyy-MM-dd")}>
                        {format(night, "MMM d")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Select
                  value={newTypeAllocation.endDate}
                  onValueChange={(value) =>
                    setNewTypeAllocation({ ...newTypeAllocation, endDate: value })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nights.map((night, idx) => (
                      <SelectItem key={night.toISOString()} value={format(addDays(night, 1), "yyyy-MM-dd")}>
                        {format(addDays(night, 1), "MMM d")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{terminology.siteType}</Label>
                <Select
                  value={newTypeAllocation.site_type_id}
                  onValueChange={(value) =>
                    setNewTypeAllocation({ ...newTypeAllocation, site_type_id: value })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {siteTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.code || type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Qty</Label>
                <Input
                  type="number"
                  min={1}
                  value={newTypeAllocation.rooms_blocked}
                  onChange={(e) =>
                    setNewTypeAllocation({
                      ...newTypeAllocation,
                      rooms_blocked: parseInt(e.target.value) || 1,
                    })
                  }
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Rate</Label>
                <Select
                  value={newTypeAllocation.rate_id || "none"}
                  onValueChange={(value) =>
                    setNewTypeAllocation({
                      ...newTypeAllocation,
                      rate_id: value === "none" ? null : value,
                      override_rate: value !== "none" ? null : newTypeAllocation.override_rate,
                    })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Rate</SelectItem>
                    {rates.map((rate) => (
                      <SelectItem key={rate.id} value={rate.id}>
                        {rate.rate_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Override $</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Override"
                  value={newTypeAllocation.override_rate ?? ""}
                  onChange={(e) =>
                    setNewTypeAllocation({
                      ...newTypeAllocation,
                      override_rate: e.target.value ? parseFloat(e.target.value) : null,
                      rate_id: e.target.value ? null : newTypeAllocation.rate_id,
                    })
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowTypeForm(false);
                  setNewTypeAllocation(null);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={addTypeAllocations}>
                <Check className="h-4 w-4 mr-1" />
                Add to Block
              </Button>
            </div>
          </div>
        )}

        {typeAllocations.length === 0 && !showTypeForm ? (
          <p className="text-sm text-muted-foreground">
            No {terminology.siteType.toLowerCase()} allocations yet. Click "Add" to block{" "}
            {terminology.sites.toLowerCase()} by type.
          </p>
        ) : typeAllocations.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Date</TableHead>
                <TableHead>{terminology.siteType}</TableHead>
                <TableHead className="w-[80px]">Qty</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead className="w-[120px]">Override $</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map((allocation, index) => {
                if (!allocation.site_type_id || allocation.site_id) return null;
                return (
                  <TableRow key={index}>
                    <TableCell>
                      <Select
                        value={allocation.allocation_date}
                        onValueChange={(value) =>
                          updateAllocation(index, { allocation_date: value })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {nights.map((night) => (
                            <SelectItem key={night.toISOString()} value={format(night, "yyyy-MM-dd")}>
                              {format(night, "MMM d")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={allocation.site_type_id || ""}
                        onValueChange={(value) =>
                          updateAllocation(index, { site_type_id: value })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {siteTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.code || type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        value={allocation.rooms_blocked}
                        onChange={(e) =>
                          updateAllocation(index, {
                            rooms_blocked: parseInt(e.target.value) || 1,
                          })
                        }
                        className="h-8 w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={allocation.rate_id || "none"}
                        onValueChange={(value) =>
                          updateAllocation(index, {
                            rate_id: value === "none" ? null : value,
                          })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Rate</SelectItem>
                          {rates.map((rate) => (
                            <SelectItem key={rate.id} value={rate.id}>
                              {rate.rate_code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Override"
                        value={allocation.override_rate ?? ""}
                        onChange={(e) =>
                          updateAllocation(index, {
                            override_rate: e.target.value ? parseFloat(e.target.value) : null,
                          })
                        }
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => applyToAllNights(index)}
                          title="Apply to all nights"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeAllocation(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* By Specific Room Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">By Specific {terminology.site}</Label>
          {!showSpecificForm && (
            <Button variant="outline" size="sm" onClick={openSpecificForm}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Add Specific Allocation Form */}
        {showSpecificForm && newSpecificAllocation && (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Add Specific {terminology.site} Allocation</Label>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setShowSpecificForm(false);
                  setNewSpecificAllocation(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Select
                  value={newSpecificAllocation.startDate}
                  onValueChange={(value) =>
                    setNewSpecificAllocation({ ...newSpecificAllocation, startDate: value })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nights.map((night) => (
                      <SelectItem key={night.toISOString()} value={format(night, "yyyy-MM-dd")}>
                        {format(night, "MMM d")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Select
                  value={newSpecificAllocation.endDate}
                  onValueChange={(value) =>
                    setNewSpecificAllocation({ ...newSpecificAllocation, endDate: value })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nights.map((night) => (
                      <SelectItem key={night.toISOString()} value={format(addDays(night, 1), "yyyy-MM-dd")}>
                        {format(addDays(night, 1), "MMM d")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{terminology.site} #</Label>
                <Select
                  value={newSpecificAllocation.site_id}
                  onValueChange={(value) =>
                    setNewSpecificAllocation({ ...newSpecificAllocation, site_id: value })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.site_number} ({getSiteTypeName(site.site_type_id)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Rate</Label>
                <Select
                  value={newSpecificAllocation.rate_id || "none"}
                  onValueChange={(value) =>
                    setNewSpecificAllocation({
                      ...newSpecificAllocation,
                      rate_id: value === "none" ? null : value,
                      override_rate: value !== "none" ? null : newSpecificAllocation.override_rate,
                    })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Rate</SelectItem>
                    {rates.map((rate) => (
                      <SelectItem key={rate.id} value={rate.id}>
                        {rate.rate_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Override $</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Override"
                  value={newSpecificAllocation.override_rate ?? ""}
                  onChange={(e) =>
                    setNewSpecificAllocation({
                      ...newSpecificAllocation,
                      override_rate: e.target.value ? parseFloat(e.target.value) : null,
                      rate_id: e.target.value ? null : newSpecificAllocation.rate_id,
                    })
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSpecificForm(false);
                  setNewSpecificAllocation(null);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={addSpecificAllocations}>
                <Check className="h-4 w-4 mr-1" />
                Add to Block
              </Button>
            </div>
          </div>
        )}

        {specificAllocations.length === 0 && !showSpecificForm ? (
          <p className="text-sm text-muted-foreground">
            No specific {terminology.site.toLowerCase()} allocations yet. Click "Add" to block
            specific {terminology.sites.toLowerCase()}.
          </p>
        ) : specificAllocations.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Date</TableHead>
                <TableHead>{terminology.site} #</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead className="w-[120px]">Override $</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map((allocation, index) => {
                if (!allocation.site_id) return null;
                const isReserved = isAllocationReserved(allocation.site_id, allocation.allocation_date);
                return (
                  <TableRow key={index} className={isReserved ? "opacity-50 bg-muted/50" : ""}>
                    <TableCell>
                      <Select
                        value={allocation.allocation_date}
                        onValueChange={(value) =>
                          updateAllocation(index, { allocation_date: value })
                        }
                        disabled={isReserved}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {nights.map((night) => (
                            <SelectItem key={night.toISOString()} value={format(night, "yyyy-MM-dd")}>
                              {format(night, "MMM d")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={allocation.site_id || ""}
                        onValueChange={(value) => {
                          const site = sites.find((s) => s.id === value);
                          updateAllocation(index, {
                            site_id: value,
                            site_type_id: site?.site_type_id || null,
                          });
                        }}
                        disabled={isReserved}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {sites.map((site) => (
                            <SelectItem key={site.id} value={site.id}>
                              {site.site_number} ({getSiteTypeName(site.site_type_id)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={allocation.rate_id || "none"}
                        onValueChange={(value) =>
                          updateAllocation(index, {
                            rate_id: value === "none" ? null : value,
                          })
                        }
                        disabled={isReserved}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Rate</SelectItem>
                          {rates.map((rate) => (
                            <SelectItem key={rate.id} value={rate.id}>
                              {rate.rate_code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Override"
                        value={allocation.override_rate ?? ""}
                        onChange={(e) =>
                          updateAllocation(index, {
                            override_rate: e.target.value ? parseFloat(e.target.value) : null,
                          })
                        }
                        className="h-8 w-24"
                        disabled={isReserved}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => applyToAllNights(index)}
                          title="Apply to all nights"
                          disabled={isReserved}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeAllocation(index)}
                          disabled={isReserved}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Summary */}
      {(typeAllocations.length > 0 || specificAllocations.length > 0) && (
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="text-sm font-medium">
            Total: {typeAllocations.reduce((sum, a) => sum + a.rooms_blocked, 0)} {terminology.sites.toLowerCase()} by type,{" "}
            {specificAllocations.length} specific {terminology.sites.toLowerCase()}
          </p>
        </div>
      )}
    </div>
  );
}
