import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Shield } from "lucide-react";
import { PermissionGrid, Permissions, DEFAULT_PERMISSIONS, mergePermissions } from "./PermissionGrid";

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: Permissions;
  created_at: string;
}

interface CustomRoleManagerProps {
  propertyId: string;
}

export function CustomRoleManager({ propertyId }: CustomRoleManagerProps) {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: DEFAULT_PERMISSIONS,
  });

  useEffect(() => {
    loadRoles();
  }, [propertyId]);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("custom_roles")
        .select("*")
        .eq("property_id", propertyId)
        .order("name");

      if (error) throw error;
      
      setRoles((data || []).map(role => ({
        ...role,
        permissions: mergePermissions(role.permissions),
      })));
    } catch (error) {
      console.error("Error loading custom roles:", error);
      toast.error("Failed to load custom roles");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!formData.name.trim()) {
      toast.error("Role name is required");
      return;
    }

    setSaving(true);
    try {
      if (selectedRole) {
        // Update existing role
        const { error } = await supabase
          .from("custom_roles")
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            permissions: JSON.parse(JSON.stringify(formData.permissions)),
          })
          .eq("id", selectedRole.id);

        if (error) throw error;
        toast.success("Role updated successfully");
      } else {
        // Create new role
        const { error } = await supabase
          .from("custom_roles")
          .insert([{
            property_id: propertyId,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            permissions: JSON.parse(JSON.stringify(formData.permissions)),
          }]);

        if (error) throw error;
        toast.success("Role created successfully");
      }

      setDialogOpen(false);
      resetForm();
      loadRoles();
    } catch (error: any) {
      console.error("Error saving role:", error);
      toast.error(error.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRole) return;

    try {
      const { error } = await supabase
        .from("custom_roles")
        .delete()
        .eq("id", selectedRole.id);

      if (error) throw error;

      toast.success("Role deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedRole(null);
      loadRoles();
    } catch (error: any) {
      console.error("Error deleting role:", error);
      toast.error(error.message || "Failed to delete role");
    }
  };

  const openEditDialog = (role: CustomRole) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      permissions: role.permissions,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setSelectedRole(null);
    resetForm();
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      permissions: DEFAULT_PERMISSIONS,
    });
    setSelectedRole(null);
  };

  const countPermissions = (perms: Permissions): number => {
    let count = 0;
    Object.values(perms).forEach(category => {
      Object.values(category).forEach(value => {
        if (value) count++;
      });
    });
    return count;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Custom Roles</CardTitle>
            <Badge variant="secondary">{roles.length} roles</Badge>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading roles...</div>
        ) : roles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No custom roles defined. Click "Create Role" to add one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.description || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {countPermissions(role.permissions)} permissions
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(role)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedRole(role);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRole ? "Edit Role" : "Create Custom Role"}</DialogTitle>
            <DialogDescription>
              Define a custom role with specific permissions for your property.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roleName">Role Name</Label>
                <Input
                  id="roleName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Night Auditor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roleDescription">Description</Label>
                <Input
                  id="roleDescription"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <PermissionGrid
                permissions={formData.permissions}
                onChange={(perms) => setFormData({ ...formData, permissions: perms })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrUpdate} disabled={saving}>
              {saving ? "Saving..." : selectedRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{selectedRole?.name}"?
              This will remove the role from all users who have it assigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}