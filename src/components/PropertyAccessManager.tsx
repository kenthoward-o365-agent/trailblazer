import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Building2, Trash2, Shield, RefreshCw } from "lucide-react";

interface PropertyAccessManagerProps {
  organizationId: string;
  organizationName: string;
  properties: { id: string; name: string }[];
}

interface UserAccess {
  id: string;
  user_id: string;
  user_name: string;
  property_id: string | null;
  property_name: string | null;
  is_org_admin: boolean;
}

interface StaffUser {
  user_id: string;
  first_name: string;
  last_name: string;
}

export const PropertyAccessManager = ({
  organizationId,
  organizationName,
  properties,
}: PropertyAccessManagerProps) => {
  const [userAccess, setUserAccess] = useState<UserAccess[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; accessId: string; userName: string } | null>(null);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all user access for this organization
      const { data: accessData, error: accessError } = await supabase
        .from("user_property_access")
        .select(`
          id,
          user_id,
          property_id,
          is_org_admin,
          properties (name)
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (accessError) throw accessError;

      // Get user IDs to fetch names
      const userIds = [...new Set((accessData || []).map((a) => a.user_id))];

      const { data: staffData } = await supabase
        .from("staff_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);

      const staffMap = new Map(
        (staffData || []).map((s) => [s.user_id, `${s.first_name} ${s.last_name}`.trim()])
      );

      const formattedAccess: UserAccess[] = (accessData || []).map((a) => ({
        id: a.id,
        user_id: a.user_id,
        user_name: staffMap.get(a.user_id) || "Unknown User",
        property_id: a.property_id,
        property_name: (a.properties as any)?.name || null,
        is_org_admin: a.is_org_admin,
      }));

      setUserAccess(formattedAccess);

      // Load all staff users for the select dropdown
      const { data: allStaff } = await supabase
        .from("staff_profiles")
        .select("user_id, first_name, last_name")
        .order("first_name");

      setStaffUsers(allStaff || []);
    } catch (error) {
      console.error("Error loading property access:", error);
      toast.error("Failed to load property access data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccess = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    if (!isOrgAdmin && selectedPropertyIds.length === 0) {
      toast.error("Please select at least one property");
      return;
    }

    try {
      if (isOrgAdmin) {
        // Check if org admin access already exists
        const { data: existing } = await supabase
          .from("user_property_access")
          .select("id")
          .eq("user_id", selectedUserId)
          .eq("organization_id", organizationId)
          .eq("is_org_admin", true)
          .maybeSingle();

        if (existing) {
          toast.error("This user is already an Org Admin");
          return;
        }

        // Add org admin access
        const { error } = await supabase.from("user_property_access").insert({
          user_id: selectedUserId,
          organization_id: organizationId,
          property_id: null,
          is_org_admin: true,
        });

        if (error) throw error;
      } else {
        // Add property-specific access for each selected property
        const inserts = selectedPropertyIds.map((propertyId) => ({
          user_id: selectedUserId,
          organization_id: organizationId,
          property_id: propertyId,
          is_org_admin: false,
        }));

        // Check for existing access
        const { data: existingAccess } = await supabase
          .from("user_property_access")
          .select("property_id")
          .eq("user_id", selectedUserId)
          .eq("organization_id", organizationId)
          .in("property_id", selectedPropertyIds);

        const existingPropertyIds = new Set((existingAccess || []).map((a) => a.property_id));
        const newInserts = inserts.filter((i) => !existingPropertyIds.has(i.property_id));

        if (newInserts.length === 0) {
          toast.error("User already has access to selected properties");
          return;
        }

        const { error } = await supabase.from("user_property_access").insert(newInserts);

        if (error) throw error;
      }

      toast.success("Access added successfully");
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error adding access:", error);
      toast.error("Failed to add access");
    }
  };

  const handleDeleteAccess = async (accessId: string) => {
    try {
      const { error } = await supabase
        .from("user_property_access")
        .delete()
        .eq("id", accessId);

      if (error) throw error;

      toast.success("Access removed");
      setDeleteDialog(null);
      loadData();
    } catch (error) {
      console.error("Error removing access:", error);
      toast.error("Failed to remove access");
    }
  };

  const resetForm = () => {
    setSelectedUserId("");
    setSelectedPropertyIds([]);
    setIsOrgAdmin(false);
  };

  const togglePropertySelection = (propertyId: string) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  // Group access by user
  const groupedByUser = userAccess.reduce((acc, access) => {
    const key = access.user_id;
    if (!acc[key]) {
      acc[key] = {
        user_id: access.user_id,
        user_name: access.user_name,
        accesses: [],
      };
    }
    acc[key].accesses.push(access);
    return acc;
  }, {} as Record<string, { user_id: string; user_name: string; accesses: UserAccess[] }>);

  // Get users not already in the access list (for adding new access)
  const availableUsers = staffUsers.filter(
    (staff) => !userAccess.some((a) => a.user_id === staff.user_id && a.is_org_admin)
  );

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Property Access</h2>
          <Badge variant="secondary">{organizationName}</Badge>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add User Access
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add User Access</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Select User *</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2 border rounded-lg px-3">
                <div>
                  <Label htmlFor="is_org_admin" className="font-medium">Organization Admin</Label>
                  <p className="text-xs text-muted-foreground">
                    Can manage all properties and user access
                  </p>
                </div>
                <Switch
                  id="is_org_admin"
                  checked={isOrgAdmin}
                  onCheckedChange={setIsOrgAdmin}
                />
              </div>

              {!isOrgAdmin && (
                <div>
                  <Label className="mb-2 block">Select Properties *</Label>
                  <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                    {properties.map((property) => (
                      <div key={property.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={property.id}
                          checked={selectedPropertyIds.includes(property.id)}
                          onCheckedChange={() => togglePropertySelection(property.id)}
                        />
                        <label
                          htmlFor={property.id}
                          className="text-sm cursor-pointer"
                        >
                          {property.name}
                        </label>
                      </div>
                    ))}
                    {properties.length === 0 && (
                      <p className="text-sm text-muted-foreground">No properties available</p>
                    )}
                  </div>
                </div>
              )}

              <Button onClick={handleAddAccess} className="w-full">
                Add Access
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {Object.keys(groupedByUser).length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No user access configured. Add users to grant them property access.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Access Type</TableHead>
              <TableHead>Properties</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.values(groupedByUser).map(({ user_id, user_name, accesses }) => {
              const isUserOrgAdmin = accesses.some((a) => a.is_org_admin);
              const propertyAccesses = accesses.filter((a) => !a.is_org_admin);

              return accesses.map((access, idx) => (
                <TableRow key={access.id}>
                  {idx === 0 && (
                    <TableCell rowSpan={accesses.length} className="align-top font-medium">
                      {user_name}
                    </TableCell>
                  )}
                  <TableCell>
                    {access.is_org_admin ? (
                      <Badge className="bg-blue-500">
                        <Shield className="h-3 w-3 mr-1" />
                        Org Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline">Property User</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {access.is_org_admin ? (
                      <span className="text-muted-foreground">All Properties</span>
                    ) : (
                      access.property_name || "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteDialog({ open: true, accessId: access.id, userName: user_name })}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={deleteDialog?.open} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this access for {deleteDialog?.userName}? They will no longer be able to access the associated property/organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog && handleDeleteAccess(deleteDialog.accessId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
