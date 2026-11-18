import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoCapInput } from "@/components/ui/auto-cap-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { useProperty } from "@/contexts/PropertyContext";
import { fetchCustomAttrs, CustomAttribute } from "@/components/SiteCustomAttributesManager";

interface SiteType {
  id: string;
  name: string;
  icon: string;
}

interface SiteFormData {
  site_number: string;
  site_type_id: string;
  description: string;
  max_occupancy: number;
  // Campground-specific
  max_vehicle_length: number | null;
  site_access_type: string;
  has_towed_vehicle_parking: boolean;
  has_towing_vehicle_parking: boolean;
  amenities: string[];
  slideouts: number | null;
  // Enforceable attributes
  is_shaded: boolean;
  has_fire_pit: boolean;
  has_picnic_table: boolean;
  allows_bump_outs: boolean;
  has_50amp: boolean;
  has_30amp: boolean;
  custom_attributes: Record<string, any>;
  // Hotel-specific
  floor: string;
  view_type: string;
  bed_config: string;
  is_ada_accessible: boolean;
}

interface SiteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: SiteFormData) => Promise<void>;
  siteTypes: SiteType[];
  initialData?: Partial<SiteFormData>;
  mode: "create" | "edit";
}

const amenityOptions = [
  "Water",
  "Sewer", 
  "Electric 30-amp",
  "Electric 50-amp",
  "Wi-Fi",
  "Picnic Area",
  "BBQ Grill",
  "Fire Pit"
];

const bedConfigOptions = [
  "1 King",
  "2 Queen",
  "1 Queen",
  "2 Double",
  "1 King + Sofa",
  "2 Queen + Sofa",
  "Suite",
];

const viewTypeOptions = [
  "Ocean View",
  "Pool View",
  "Garden View",
  "City View",
  "Mountain View",
  "Courtyard",
  "Standard",
];

export function SiteFormDialog({
  open,
  onOpenChange,
  onSubmit,
  siteTypes,
  initialData,
  mode,
}: SiteFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const terminology = usePropertyTerminology();
  const { selectedProperty } = useProperty();
  const [customAttrs, setCustomAttrs] = useState<CustomAttribute[]>([]);

  useEffect(() => {
    if (selectedProperty?.id) fetchCustomAttrs(selectedProperty.id).then(setCustomAttrs);
  }, [selectedProperty?.id]);
  
  
  const [formData, setFormData] = useState<SiteFormData>({
    site_number: "",
    site_type_id: "",
    description: "",
    max_occupancy: 4,
    max_vehicle_length: null,
    site_access_type: "back_in",
    has_towed_vehicle_parking: false,
    has_towing_vehicle_parking: false,
    amenities: [],
    slideouts: null,
    is_shaded: false,
    has_fire_pit: false,
    has_picnic_table: false,
    allows_bump_outs: false,
    has_50amp: false,
    has_30amp: false,
    custom_attributes: {},
    floor: "",
    view_type: "",
    bed_config: "",
    is_ada_accessible: false,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        site_number: initialData.site_number || "",
        site_type_id: initialData.site_type_id || "",
        description: initialData.description || "",
        max_occupancy: initialData.max_occupancy || 4,
        max_vehicle_length: initialData.max_vehicle_length || null,
        site_access_type: initialData.site_access_type || "back_in",
        has_towed_vehicle_parking: initialData.has_towed_vehicle_parking || false,
        has_towing_vehicle_parking: initialData.has_towing_vehicle_parking || false,
        amenities: initialData.amenities || [],
        slideouts: initialData.slideouts ?? null,
        is_shaded: initialData.is_shaded ?? false,
        has_fire_pit: initialData.has_fire_pit ?? false,
        has_picnic_table: initialData.has_picnic_table ?? false,
        allows_bump_outs: initialData.allows_bump_outs ?? false,
        has_50amp: initialData.has_50amp ?? false,
        has_30amp: initialData.has_30amp ?? false,
        custom_attributes: initialData.custom_attributes ?? {},
        floor: initialData.floor || "",
        view_type: initialData.view_type || "",
        bed_config: initialData.bed_config || "",
        is_ada_accessible: initialData.is_ada_accessible || false,
      });
    } else {
      // Reset form when creating new site
      setFormData({
        site_number: "",
        site_type_id: "",
        description: "",
        max_occupancy: 4,
        max_vehicle_length: null,
        site_access_type: "back_in",
        has_towed_vehicle_parking: false,
        has_towing_vehicle_parking: false,
        amenities: [],
        slideouts: null,
        is_shaded: false,
        has_fire_pit: false,
        has_picnic_table: false,
        allows_bump_outs: false,
        has_50amp: false,
        has_30amp: false,
        custom_attributes: {},
        floor: "",
        view_type: "",
        bed_config: "",
        is_ada_accessible: false,
      });
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate room number for hotels (max 6 chars alphanumeric)
    if (terminology.isHotel) {
      if (formData.site_number.length > 6) {
        return;
      }
    }
    
    setLoading(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAmenityToggle = (amenity: string) => {
    setFormData((prev) => {
      const isSelected = prev.amenities.includes(amenity);
      const newAmenities = isSelected
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity];
      
      return {
        ...prev,
        amenities: newAmenities,
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? `Create New ${terminology.site}` : `Edit ${terminology.site}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="site_number">{terminology.siteNumber} *</Label>
              <Input
                id="site_number"
                value={formData.site_number}
                onChange={(e) =>
                  setFormData({ ...formData, site_number: terminology.isHotel ? e.target.value.slice(0, 6) : e.target.value })
                }
                required
                placeholder={terminology.isHotel ? "e.g., 101, 2A" : "e.g., A-101"}
                maxLength={terminology.isHotel ? 6 : undefined}
              />
              {terminology.isHotel && (
                <p className="text-xs text-muted-foreground mt-1">Max 6 characters</p>
              )}
            </div>
            <div>
              <Label htmlFor="site_type">{terminology.siteType} *</Label>
              <Select
                value={formData.site_type_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, site_type_id: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {siteTypes.map((type) => {
                    const IconComponent = (LucideIcons as any)[
                      type.icon.charAt(0).toUpperCase() +
                        type.icon.slice(1).replace(/-./g, (x) => x[1].toUpperCase())
                    ];
                    return (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          {IconComponent && <IconComponent className="h-4 w-4" />}
                          {type.name}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder={`Describe this ${terminology.site.toLowerCase()}'s features, location, or special amenities...`}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max_occupancy">Max Occupancy *</Label>
              <Input
                id="max_occupancy"
                type="number"
                min="1"
                value={formData.max_occupancy}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_occupancy: parseInt(e.target.value),
                  })
                }
                required
              />
            </div>
            
            {/* Hotel-specific: Floor */}
            {terminology.isHotel && (
              <div>
                <Label htmlFor="floor">Floor</Label>
                <Input
                  id="floor"
                  value={formData.floor}
                  onChange={(e) =>
                    setFormData({ ...formData, floor: e.target.value })
                  }
                  placeholder="e.g., 1, 2, Ground"
                />
              </div>
            )}
            
            {/* Campground-specific: Max Vehicle Length */}
            {terminology.isCampground && (
              <div>
                <Label htmlFor="max_vehicle_length">Max Vehicle Length (ft)</Label>
                <Input
                  id="max_vehicle_length"
                  type="number"
                  min="0"
                  value={formData.max_vehicle_length || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_vehicle_length: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  placeholder="Optional"
                />
              </div>
            )}
          </div>

          {/* Hotel-specific fields */}
          {terminology.isHotel && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bed_config">Bed Configuration</Label>
                  <Select
                    value={formData.bed_config}
                    onValueChange={(value) =>
                      setFormData({ ...formData, bed_config: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bed config" />
                    </SelectTrigger>
                    <SelectContent>
                      {bedConfigOptions.map((config) => (
                        <SelectItem key={config} value={config}>
                          {config}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="view_type">View Type</Label>
                  <Select
                    value={formData.view_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, view_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select view" />
                    </SelectTrigger>
                    <SelectContent>
                      {viewTypeOptions.map((view) => (
                        <SelectItem key={view} value={view}>
                          {view}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="ada_accessible">ADA Accessible</Label>
                <Switch
                  id="ada_accessible"
                  checked={formData.is_ada_accessible}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_ada_accessible: checked })
                  }
                />
              </div>
            </>
          )}

          {/* Campground-specific fields */}
          {terminology.isCampground && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="site_access_type">Site Access Type *</Label>
                  <Select
                    value={formData.site_access_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, site_access_type: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select access type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="back_in">Back In</SelectItem>
                      <SelectItem value="pull_through">Pull Through</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="slideouts">Slideouts</Label>
                  <Select
                    value={formData.slideouts?.toString() || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, slideouts: value ? parseInt(value) : null })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select slideouts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="towed_parking">Towed Vehicle Parking</Label>
                  <Switch
                    id="towed_parking"
                    checked={formData.has_towed_vehicle_parking}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, has_towed_vehicle_parking: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="towing_parking">Towing Vehicle Parking</Label>
                  <Switch
                    id="towing_parking"
                    checked={formData.has_towing_vehicle_parking}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, has_towing_vehicle_parking: checked })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 border-t pt-3">
                <Label className="text-base">Enforceable Site Attributes</Label>
                <p className="text-xs text-muted-foreground">Used to match guests to eligible sites at booking.</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { k: "has_50amp", label: "50-amp Power" },
                    { k: "has_30amp", label: "30-amp Power" },
                    { k: "is_shaded", label: "Shaded" },
                    { k: "has_fire_pit", label: "Fire Pit" },
                    { k: "has_picnic_table", label: "Picnic Table" },
                    { k: "allows_bump_outs", label: "Bump-Outs Allowed" },
                  ].map(({ k, label }) => (
                    <div key={k} className="flex items-center justify-between rounded border px-3 py-2">
                      <Label htmlFor={k} className="text-sm font-normal cursor-pointer">{label}</Label>
                      <Switch
                        id={k}
                        checked={(formData as any)[k]}
                        onCheckedChange={(v) => setFormData({ ...formData, [k]: v } as any)}
                      />
                    </div>
                  ))}
                </div>

                {customAttrs.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-sm">Custom Attributes</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {customAttrs.map((c) => {
                        const val = formData.custom_attributes?.[c.code];
                        if (c.data_type === "boolean") {
                          return (
                            <div key={c.id} className="flex items-center justify-between rounded border px-3 py-2">
                              <Label className="text-sm font-normal cursor-pointer">{c.name}</Label>
                              <Switch
                                checked={!!val}
                                onCheckedChange={(v) =>
                                  setFormData({
                                    ...formData,
                                    custom_attributes: { ...formData.custom_attributes, [c.code]: v },
                                  })
                                }
                              />
                            </div>
                          );
                        }
                        return (
                          <div key={c.id}>
                            <Label className="text-xs">{c.name}</Label>
                            <Input
                              type={c.data_type === "number" ? "number" : "text"}
                              value={val ?? ""}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  custom_attributes: {
                                    ...formData.custom_attributes,
                                    [c.code]:
                                      c.data_type === "number"
                                        ? e.target.value === "" ? null : Number(e.target.value)
                                        : e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Legacy Amenities Tags</Label>
                <div className="grid grid-cols-2 gap-3">
                  {amenityOptions.map((amenity) => {
                    const isChecked = formData.amenities.includes(amenity);
                    
                    return (
                      <div key={amenity} className="flex items-center space-x-2">
                        <Checkbox
                          id={`amenity-${amenity}`}
                          checked={isChecked}
                          onCheckedChange={() => handleAmenityToggle(amenity)}
                        />
                        <Label 
                          htmlFor={`amenity-${amenity}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {amenity}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "create" ? `Create ${terminology.site}` : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}