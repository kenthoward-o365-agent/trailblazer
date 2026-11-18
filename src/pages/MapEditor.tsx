import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Save, Plus, Edit, Trash2, X, Check, RotateCcw, RotateCw, Droplet, Trash, Zap, Wifi, Trees, Flame, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SiteFormDialog } from "@/components/SiteFormDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as LucideIcons from "lucide-react";
import { resolveMapImageUrl } from "@/lib/mapImage";

interface Site {
  id: string;
  site_number: string;
  description: string | null;
  map_x: number | null;
  map_y: number | null;
  rotation: number;
  map_width: number | null;
  map_height: number | null;
  max_occupancy: number;
  max_vehicle_length: number | null;
  site_access_type: string;
  has_towed_vehicle_parking: boolean;
  has_towing_vehicle_parking: boolean;
  amenities: string[] | null;
  site_type_id: string;
  site_types: {
    id: string;
    name: string;
    icon: string;
  };
}

interface Property {
  id: string;
  map_image_url: string | null;
  map_width: number;
  map_height: number;
}

interface SiteType {
  id: string;
  name: string;
  icon: string;
}

const siteTypeColors: Record<string, string> = {
  "Tent Camping": "bg-green-500",
  "Class A RV": "bg-blue-500",
  "Class B RV": "bg-purple-500",
  "Class C RV": "bg-orange-500",
  "Towable RV": "bg-red-500",
};

const amenityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "Water": Droplet,
  "Sewer": Trash,
  "Electric 30-amp": () => <span className="text-[10px] font-bold">E30</span>,
  "Electric 50-amp": () => <span className="text-[10px] font-bold">E50</span>,
  "Wi-Fi": Wifi,
  "Picnic Area": Trees,
  "BBQ Grill": UtensilsCrossed,
  "Fire Pit": Flame,
};

export default function MapEditor() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteTypes, setSiteTypes] = useState<SiteType[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [mapImageSrc, setMapImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggedSite, setDraggedSite] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [draggingPlacedSite, setDraggingPlacedSite] = useState<{ site: Site; offsetX: number; offsetY: number } | null>(null);
  const [resizingHandle, setResizingHandle] = useState<{ site: Site; handle: string; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deletingSite, setDeletingSite] = useState<Site | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showOnlyUnplaced, setShowOnlyUnplaced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMapData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedSite) return;
      
      let rotationChange = 0;
      if (e.key === "ArrowLeft") {
        rotationChange = -15;
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        rotationChange = 15;
        e.preventDefault();
      }

      if (rotationChange !== 0) {
        setSites(sites.map(site => 
          site.id === selectedSite 
            ? { ...site, rotation: (site.rotation + rotationChange + 360) % 360 }
            : site
        ));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSite, sites]);

  const fetchMapData = async () => {
    try {
      setLoading(true);

      // Fetch property
      const { data: propertyData, error: propertyError } = await supabase
        .from("properties")
        .select("*")
        .single();

      if (propertyError) throw propertyError;
      setProperty(propertyData);
      setMapImageSrc(await resolveMapImageUrl(propertyData?.map_image_url));

      // Fetch site types
      const { data: typesData, error: typesError } = await supabase
        .from("site_types")
        .select("id, name, icon")
        .order("name");

      if (typesError) throw typesError;
      setSiteTypes(typesData);

      // Fetch all active sites
      const { data: sitesData, error: sitesError } = await supabase
        .from("sites")
        .select(`
          id,
          site_number,
          description,
          map_x,
          map_y,
          rotation,
          max_occupancy,
          max_vehicle_length,
          site_access_type,
          has_towed_vehicle_parking,
          has_towing_vehicle_parking,
          amenities,
          slideouts,
          is_shaded,
          has_fire_pit,
          has_picnic_table,
          allows_bump_outs,
          has_50amp,
          has_30amp,
          custom_attributes,
          site_type_id,
          site_types (
            id,
            name,
            icon
          )
        `)
        .eq("is_active", true)
        .order("site_number");

      if (sitesError) throw sitesError;
      setSites(sitesData as unknown as Site[]);
    } catch (error: any) {
      console.error("Error fetching map data:", error);
      toast.error("Failed to load map data");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
      setSelectedFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const confirmUpload = async () => {
    if (!selectedFile || !property) return;

    try {
      setUploading(true);

      // Upload to Supabase Storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${property.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("campground-maps")
        .upload(fileName, selectedFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("campground-maps")
        .getPublicUrl(fileName);

      // Update property with map URL
      const { error: updateError } = await supabase
        .from("properties")
        .update({ map_image_url: urlData.publicUrl })
        .eq("id", property.id);

      if (updateError) throw updateError;

      setProperty({ ...property, map_image_url: urlData.publicUrl });
      setMapImageSrc(await resolveMapImageUrl(urlData.publicUrl));
      toast.success("Map image uploaded successfully");
      setPreviewImage(null);
      setSelectedFile(null);
    } catch (error: any) {
      console.error("Error uploading map:", error);
      toast.error("Failed to upload map image");
    } finally {
      setUploading(false);
    }
  };

  const cancelUpload = () => {
    setPreviewImage(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRotate = (siteId: string, angle: number) => {
    setSites(sites.map(site =>
      site.id === siteId
        ? { ...site, rotation: (site.rotation + angle + 360) % 360 }
        : site
    ));
  };

  const handleDragStart = (siteId: string) => {
    setDraggedSite(siteId);
  };

  const handleDragEnd = () => {
    setDraggedSite(null);
  };

  const handleMapDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleMapDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggedSite || !mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setSites(
      sites.map((site) =>
        site.id === draggedSite ? { ...site, map_x: x, map_y: y } : site
      )
    );
    setDraggedSite(null);
  };

  const handlePlacedSiteMouseDown = (e: React.MouseEvent, site: Site) => {
    e.stopPropagation();
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    setDraggingPlacedSite({ site, offsetX, offsetY });
    setSelectedSite(site.id);
  };

  const handleMapMouseMove = (e: React.MouseEvent) => {
    if (draggingPlacedSite && mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      setSites(sites.map(s =>
        s.id === draggingPlacedSite.site.id
          ? { ...s, map_x: x, map_y: y }
          : s
      ));
    } else if (resizingHandle) {
      const deltaX = e.clientX - resizingHandle.startX;
      const deltaY = e.clientY - resizingHandle.startY;
      
      let newWidth = resizingHandle.startWidth;
      let newHeight = resizingHandle.startHeight;

      if (resizingHandle.handle.includes('right')) {
        newWidth = Math.max(30, resizingHandle.startWidth + deltaX);
      } else if (resizingHandle.handle.includes('left')) {
        newWidth = Math.max(30, resizingHandle.startWidth - deltaX);
      }

      if (resizingHandle.handle.includes('bottom')) {
        newHeight = Math.max(30, resizingHandle.startHeight + deltaY);
      } else if (resizingHandle.handle.includes('top')) {
        newHeight = Math.max(30, resizingHandle.startHeight - deltaY);
      }

      setSites(sites.map(s =>
        s.id === resizingHandle.site.id
          ? { ...s, map_width: newWidth, map_height: newHeight }
          : s
      ));
    }
  };

  const handleMapMouseUp = () => {
    setDraggingPlacedSite(null);
    setResizingHandle(null);
  };

  const handleResizeHandleMouseDown = (e: React.MouseEvent, site: Site, handle: string) => {
    e.stopPropagation();
    const defaultWidth = site.site_access_type === 'pull_through' ? 60 : 48;
    const defaultHeight = site.site_access_type === 'pull_through' ? 32 : 48;
    
    setResizingHandle({
      site,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: site.map_width || defaultWidth,
      startHeight: site.map_height || defaultHeight,
    });
    setSelectedSite(site.id);
  };

  const handleResetSize = (siteId: string) => {
    setSites(sites.map(s =>
      s.id === siteId
        ? { ...s, map_width: null, map_height: null }
        : s
    ));
  };

  const handleSavePositions = async () => {
    try {
      setSaving(true);

      // Update all sites with their new positions, rotations, and sizes
      const updates = sites.map((site) =>
        supabase
          .from("sites")
          .update({ 
            map_x: site.map_x, 
            map_y: site.map_y, 
            rotation: site.rotation,
            map_width: site.map_width,
            map_height: site.map_height
          })
          .eq("id", site.id)
      );

      await Promise.all(updates);
      toast.success("Site positions saved successfully");
    } catch (error: any) {
      console.error("Error saving positions:", error);
      toast.error("Failed to save site positions");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSite = async (data: any) => {
    try {
      if (!property) return;

      const { error } = await supabase.from("sites").insert({
        ...data,
        property_id: property.id,
        is_active: true,
        map_x: null,
        map_y: null,
      });

      if (error) throw error;

      toast.success("Site created successfully");
      await fetchMapData();
    } catch (error: any) {
      console.error("Error creating site:", error);
      toast.error("Failed to create site");
      throw error;
    }
  };

  const handleUpdateSite = async (data: any) => {
    try {
      if (!editingSite) return;

      const { error } = await supabase
        .from("sites")
        .update(data)
        .eq("id", editingSite.id);

      if (error) throw error;

      toast.success("Site updated successfully");
      setEditingSite(null);
      await fetchMapData();
    } catch (error: any) {
      console.error("Error updating site:", error);
      toast.error("Failed to update site");
      throw error;
    }
  };

  const handleDeleteSite = async () => {
    try {
      if (!deletingSite) return;

      const { error } = await supabase
        .from("sites")
        .delete()
        .eq("id", deletingSite.id);

      if (error) throw error;

      toast.success("Site deleted successfully");
      setDeletingSite(null);
      await fetchMapData();
    } catch (error: any) {
      console.error("Error deleting site:", error);
      toast.error("Failed to delete site");
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Map Editor</h1>
            <p className="text-muted-foreground">Drag sites to position them, click to select and use ← → arrow keys to rotate</p>
          </div>
          <Button onClick={handleSavePositions} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Positions
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Site List */}
        <Card className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold mb-3">Upload Map Image</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-1">
                Drag & drop your map here
              </p>
              <p className="text-xs text-muted-foreground">or click to browse</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Sites</h3>
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Drag sites onto the map to position them</p>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyUnplaced}
                  onChange={(e) => setShowOnlyUnplaced(e.target.checked)}
                  className="rounded border-muted-foreground/25"
                />
                <span className="text-muted-foreground">Show only unplaced</span>
              </label>
              <span className="ml-auto text-xs text-muted-foreground">
                {sites.filter(s => s.map_x !== null).length}/{sites.length} placed
              </span>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {sites
                .filter(site => !showOnlyUnplaced || site.map_x === null)
                .map((site) => {
                const IconComponent = (LucideIcons as any)[
                  site.site_types.icon.charAt(0).toUpperCase() +
                    site.site_types.icon.slice(1).replace(/-./g, (x) => x[1].toUpperCase())
                ];
                return (
                  <div
                    key={site.id}
                    draggable
                    onDragStart={() => handleDragStart(site.id)}
                    onDragEnd={handleDragEnd}
                    className={`p-2 rounded flex items-center gap-2 transition-colors cursor-move ${
                      draggedSite === site.id
                        ? "bg-primary text-primary-foreground opacity-50"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    <div className="flex-1 flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${siteTypeColors[site.site_types.name]}`}>
                        <span className="text-[6px] font-bold text-white">{site.site_number}</span>
                      </div>
                      <div className="flex flex-col flex-1 gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Site {site.site_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {site.site_access_type === 'pull_through' ? 'Pull Through' : 'Back In'}
                          </span>
                          {site.rotation !== 0 && (
                            <span className="text-xs text-primary font-mono">
                              {site.rotation}°
                            </span>
                          )}
                          {site.map_x !== null && (
                            <span className="ml-auto flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <Check className="h-3 w-3" />
                              <span>On Map</span>
                            </span>
                          )}
                        </div>
                        {site.amenities && site.amenities.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {site.amenities.map((amenity) => {
                              const AmenityIcon = amenityIcons[amenity];
                              if (!AmenityIcon) return null;
                              return (
                                <div key={amenity} className="w-4 h-4 flex items-center justify-center text-muted-foreground">
                                  <AmenityIcon className="h-3 w-3" />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingSite(site)}
                      className="h-7 w-7 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingSite(site)}
                      className="h-7 w-7 p-0 text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Map Canvas */}
        <Card className="lg:col-span-3 p-4">
          {property?.map_image_url ? (
            <div
              ref={mapRef}
              onDragOver={handleMapDragOver}
              onDrop={handleMapDrop}
              onMouseMove={handleMapMouseMove}
              onMouseUp={handleMapMouseUp}
              onClick={() => setSelectedSite(null)}
              className="relative"
              style={{ width: "100%", paddingBottom: `${(property.map_height / property.map_width) * 100}%` }}
            >
              <div className="absolute inset-0">
                <img
                  src={mapImageSrc ?? undefined}
                  alt="Campground Map"
                  className="w-full h-full object-contain pointer-events-none"
                />
                {sites
                  .filter((site) => site.map_x !== null && site.map_y !== null)
                  .map((site) => {
                    const IconComponent = (LucideIcons as any)[
                      site.site_types.icon.charAt(0).toUpperCase() +
                        site.site_types.icon.slice(1).replace(/-./g, (x) => x[1].toUpperCase())
                    ];
                    const isPullThrough = site.site_access_type === 'pull_through';
                    const defaultWidth = isPullThrough ? 60 : 48;
                    const defaultHeight = isPullThrough ? 32 : 48;
                    const siteWidth = site.map_width || defaultWidth;
                    const siteHeight = site.map_height || defaultHeight;
                    const isSelected = selectedSite === site.id;
                    
                    return (
                      <div key={site.id}>
                        <div
                          onMouseDown={(e) => handlePlacedSiteMouseDown(e, site)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSite(isSelected ? null : site.id);
                          }}
                          className={`absolute transform -translate-x-1/2 -translate-y-1/2 border-2 border-white shadow-lg flex items-center justify-center cursor-move transition-all ${
                            siteTypeColors[site.site_types.name]
                          } ${draggedSite === site.id ? "ring-4 ring-primary" : ""} ${
                            isSelected ? "ring-4 ring-yellow-400" : ""
                          } ${
                            isPullThrough ? "rounded-lg" : "rounded"
                          }`}
                          style={{
                            left: `${site.map_x}%`,
                            top: `${site.map_y}%`,
                            width: `${siteWidth}px`,
                            height: `${siteHeight}px`,
                            transform: `translate(-50%, -50%) rotate(${site.rotation}deg)`,
                          }}
                          title={`Site ${site.site_number} - ${isPullThrough ? 'Pull Through' : 'Back In'}`}
                        >
                          <div className="flex flex-col items-center justify-center pointer-events-none">
                            {IconComponent && <IconComponent className="h-4 w-4 text-white" />}
                            <span className="text-[10px] font-bold text-white">
                              {site.site_number}
                            </span>
                          </div>
                        </div>
                        
                        {isSelected && (
                          <>
                            {/* Resize handles */}
                            {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(handle => {
                              const isTop = handle.includes('top');
                              const isLeft = handle.includes('left');
                              const leftPercent = site.map_x!;
                              const topPercent = site.map_y!;
                              const offsetX = isLeft ? -(siteWidth / 2 + 6) : (siteWidth / 2 - 6);
                              const offsetY = isTop ? -(siteHeight / 2 + 6) : (siteHeight / 2 - 6);
                              
                              return (
                                <div
                                  key={handle}
                                  className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full hover:scale-125 transition-transform z-10"
                                  style={{
                                    left: `calc(${leftPercent}% + ${offsetX}px)`,
                                    top: `calc(${topPercent}% + ${offsetY}px)`,
                                    cursor: handle.includes('top-left') || handle.includes('bottom-right') ? 'nwse-resize' : 'nesw-resize',
                                  }}
                                  onMouseDown={(e) => handleResizeHandleMouseDown(e, site, handle)}
                                />
                              );
                            })}

                            <div
                              className="absolute transform -translate-x-1/2 bg-background border border-border rounded-lg shadow-lg p-2 flex gap-1"
                              style={{
                                left: `${site.map_x}%`,
                                top: `calc(${site.map_y}% + ${siteHeight / 2 + 20}px)`,
                                zIndex: 1000,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-xs text-muted-foreground px-2 border-r flex items-center">
                                {Math.round(siteWidth)} × {Math.round(siteHeight)}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRotate(site.id, -15)}
                                className="h-8 w-8 p-0"
                                title="Rotate left (←)"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <div className="flex items-center px-2 text-sm font-mono">
                                {site.rotation}°
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRotate(site.id, 15)}
                                className="h-8 w-8 p-0"
                                title="Rotate right (→)"
                              >
                                <RotateCw className="h-4 w-4" />
                              </Button>
                              {(site.map_width !== null || site.map_height !== null) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResetSize(site.id)}
                                  className="h-8 text-xs"
                                  title="Reset to default size"
                                >
                                  Reset Size
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 text-muted-foreground">
              <div className="text-center">
                <Upload className="h-16 w-16 mx-auto mb-4" />
                <p>Upload a campground map image to get started</p>
              </div>
            </div>
          )}
          </Card>
        </div>
      </div>

      <SiteFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateSite}
        siteTypes={siteTypes}
        mode="create"
      />

      {editingSite && (
        <SiteFormDialog
          open={!!editingSite}
          onOpenChange={(open) => !open && setEditingSite(null)}
          onSubmit={handleUpdateSite}
          siteTypes={siteTypes}
          initialData={{
            site_number: editingSite.site_number,
            site_type_id: editingSite.site_type_id,
            description: editingSite.description || "",
            max_occupancy: editingSite.max_occupancy,
            max_vehicle_length: editingSite.max_vehicle_length,
            site_access_type: editingSite.site_access_type,
            has_towed_vehicle_parking: editingSite.has_towed_vehicle_parking,
            has_towing_vehicle_parking: editingSite.has_towing_vehicle_parking,
            amenities: editingSite.amenities || [],
            slideouts: (editingSite as any).slideouts ?? null,
            is_shaded: (editingSite as any).is_shaded ?? false,
            has_fire_pit: (editingSite as any).has_fire_pit ?? false,
            has_picnic_table: (editingSite as any).has_picnic_table ?? false,
            allows_bump_outs: (editingSite as any).allows_bump_outs ?? false,
            has_50amp: (editingSite as any).has_50amp ?? false,
            has_30amp: (editingSite as any).has_30amp ?? false,
            custom_attributes: (editingSite as any).custom_attributes ?? {},
          }}
          mode="edit"
        />

      )}

      <AlertDialog open={!!deletingSite} onOpenChange={(open) => !open && setDeletingSite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete site {deletingSite?.site_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSite} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && cancelUpload()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Preview Map Image</DialogTitle>
            <DialogDescription>
              Review the image before uploading it as your campground map.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center bg-muted rounded-lg p-4 max-h-[60vh] overflow-auto">
            {previewImage && (
              <img
                src={previewImage}
                alt="Map preview"
                className="max-w-full h-auto rounded"
              />
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={cancelUpload}
              disabled={uploading}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={confirmUpload}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Upload Map
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
