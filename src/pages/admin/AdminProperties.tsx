import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, MapPin, RefreshCw, Pencil, Rocket } from "lucide-react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useInternalUser } from "@/hooks/useInternalUser";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useProperty } from "@/contexts/PropertyContext";
import { COUNTRIES, getCountryName } from "@/lib/countries";

interface Organization {
  id: string;
  name: string;
}

interface PropertyGroup {
  id: string;
  name: string;
  organization_id: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  organization_id: string | null;
  organization_name: string | null;
  property_group_id: string | null;
  property_group_name: string | null;
  is_active: boolean;
  site_count: number;
  customer_id: number | null;
  max_sites: number | null;
  country: string | null;
}

export const AdminProperties = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const { isInternalUser, loading: internalLoading } = useInternalUser();
  const { startAdminAccess } = useAdminAccess();
  const { setSelectedPropertyId } = useProperty();
  const [properties, setProperties] = useState<Property[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [propertyGroups, setPropertyGroups] = useState<PropertyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  const canUseAdminAccess = isSuperAdmin || isInternalUser;

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("US");
  const [organizationId, setOrganizationId] = useState("");
  const [propertyGroupId, setPropertyGroupId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [maxSites, setMaxSites] = useState("50");

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [isSuperAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load organizations
      const { data: orgs } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      setOrganizations(orgs || []);

      // Load property groups
      const { data: groups } = await supabase
        .from("property_groups")
        .select("id, name, organization_id")
        .order("name");
      setPropertyGroups(groups || []);

      // Load properties with counts
      const { data: propsData, error } = await supabase
        .from("properties")
        .select(`
          *,
          organizations (name),
          property_groups (name)
        `)
        .order("name");

      if (error) throw error;

      const propsWithCounts = await Promise.all(
        (propsData || []).map(async (p) => {
          const { count } = await supabase
            .from("sites")
            .select("*", { count: "exact", head: true })
            .eq("property_id", p.id);

          return {
            id: p.id,
            name: p.name,
            address: p.address,
            organization_id: p.organization_id,
            organization_name: p.organizations?.name || null,
            property_group_id: p.property_group_id,
            property_group_name: p.property_groups?.name || null,
            is_active: p.is_active,
            site_count: count || 0,
            customer_id: p.customer_id,
            max_sites: p.max_sites,
            country: p.country || 'US',
          };
        })
      );

      setProperties(propsWithCounts);
    } catch (error) {
      console.error("Error loading properties:", error);
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Property name is required");
      return;
    }
    if (!address.trim()) {
      toast.error("Address is required");
      return;
    }
    if (!editingProperty && !organizationId) {
      toast.error("Organization is required");
      return;
    }

    try {
      if (editingProperty) {
        const { error } = await supabase
          .from("properties")
          .update({
            name: name.trim(),
            address: address.trim(),
            country: country,
            organization_id: organizationId || null,
            property_group_id: propertyGroupId || null,
            is_active: isActive,
            max_sites: parseInt(maxSites) || 50,
          })
          .eq("id", editingProperty.id);

        if (error) throw error;
        toast.success("Property updated");
      } else {
        const { error } = await supabase.from("properties").insert({
          name: name.trim(),
          address: address.trim(),
          country: country,
          organization_id: organizationId,
          property_group_id: propertyGroupId || null,
          is_active: isActive,
          max_sites: parseInt(maxSites) || 50,
        });

        if (error) throw error;
        toast.success("Property created");
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error saving property:", error);
      toast.error("Failed to save property");
    }
  };

  const openEditDialog = (property: Property) => {
    setEditingProperty(property);
    setName(property.name);
    setAddress(property.address);
    setCountry(property.country || "US");
    setOrganizationId(property.organization_id || "");
    setPropertyGroupId(property.property_group_id || "");
    setIsActive(property.is_active);
    setMaxSites(property.max_sites?.toString() || "50");
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProperty(null);
    setName("");
    setAddress("");
    setCountry("US");
    setOrganizationId("");
    setPropertyGroupId("");
    setIsActive(true);
    setMaxSites("50");
  };

  const handleAdminAccess = async (property: Property) => {
    const success = await startAdminAccess(
      property.id,
      property.name,
      property.organization_id,
      property.organization_name
    );
    if (success) {
      setSelectedPropertyId(property.id);
      navigate("/");
    }
  };

  // Filter property groups by selected organization
  const filteredGroups = propertyGroups.filter(
    (g) => g.organization_id === organizationId
  );

  if (superAdminLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-destructive">Access Denied</h2>
          <p className="text-muted-foreground mt-2">You do not have permission to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="h-6 w-6" />
              Properties
            </h1>
            <p className="text-muted-foreground">Provision and manage customer properties</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{editingProperty ? "Edit Property" : "Add Property"}</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  {editingProperty && editingProperty.customer_id && (
                    <div className="mb-4">
                      <Label>Customer ID</Label>
                      <div className="mt-1">
                        <Badge variant="outline" className="font-mono text-base px-3 py-1">
                          {editingProperty.customer_id}
                        </Badge>
                      </div>
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left Column - Property Details */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="organization">Organization *</Label>
                        <Select value={organizationId} onValueChange={(v) => { setOrganizationId(v); setPropertyGroupId(""); }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select organization" />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations.map((org) => (
                              <SelectItem key={org.id} value={org.id}>
                                {org.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="name">Property Name *</Label>
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Pine Valley RV Park"
                        />
                      </div>
                      <div>
                        <Label htmlFor="address">Address *</Label>
                        <Input
                          id="address"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="123 Campground Rd, State, ZIP"
                        />
                      </div>
                      <div>
                        <Label htmlFor="country">Country *</Label>
                        <Select value={country} onValueChange={setCountry}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="property_group">Property Group (Optional)</Label>
                        <Select value={propertyGroupId || "none"} onValueChange={(v) => setPropertyGroupId(v === "none" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="No group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No group</SelectItem>
                            {filteredGroups.map((group) => {
                              const org = organizations.find(o => o.id === group.organization_id);
                              return (
                                <SelectItem key={group.id} value={group.id}>
                                  {group.name} <span className="text-muted-foreground">({org?.name || "Unknown"})</span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        {organizationId && filteredGroups.length === 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            No property groups exist for this organization.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right Column - Configuration */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="max_sites">Max Sites Allowed *</Label>
                        <Input
                          id="max_sites"
                          type="number"
                          min="1"
                          value={maxSites}
                          onChange={(e) => setMaxSites(e.target.value)}
                          placeholder="50"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Maximum number of sites this property can create
                        </p>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <Label htmlFor="is_active">Active</Label>
                        <Switch
                          id="is_active"
                          checked={isActive}
                          onCheckedChange={setIsActive}
                        />
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleSave} className="w-full mt-6">
                    {editingProperty ? "Update Property" : "Create Property"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer ID</TableHead>
                <TableHead>Property</TableHead>
                
                <TableHead>Organization</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Max</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {property.customer_id || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{property.name}</div>
                      <div className="text-sm text-muted-foreground">{property.address}</div>
                    </div>
                  </TableCell>
                  <TableCell>{property.organization_name || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>{property.property_group_name || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>{property.site_count}</TableCell>
                  <TableCell>{property.max_sites || 50}</TableCell>
                  <TableCell>
                    {property.is_active ? (
                      <Badge className="bg-green-500">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {canUseAdminAccess && property.is_active && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleAdminAccess(property)}
                          className="text-amber-600 border-amber-600 hover:bg-amber-50 hover:text-amber-700"
                        >
                          <Rocket className="h-4 w-4 mr-1" />
                          Admin Access
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(property)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {properties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No properties found. Create your first property to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminProperties;
