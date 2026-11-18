import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, UserCog, Trash2, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EditUserDialog } from "@/components/EditUserDialog";

// Internal roles for Aspire Software staff
type InternalRole = "super_admin" | "internal_admin" | "sales" | "support" | "finance";

interface InternalUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: InternalRole;
}

const INTERNAL_ROLES: { value: InternalRole; label: string; description: string }[] = [
  { value: "super_admin", label: "Super Admin", description: "Full system access - manages all organizations and internal users" },
  { value: "internal_admin", label: "Admin", description: "Manages organizations, properties, and subscriptions" },
  { value: "sales", label: "Sales", description: "Views organizations, creates new customers, manages subscriptions" },
  { value: "support", label: "Support", description: "Views customer data, helps with issues (read-only)" },
  { value: "finance", label: "Finance", description: "Views subscriptions and billing information" },
];

const getRoleBadgeVariant = (role: InternalRole) => {
  switch (role) {
    case "super_admin": return "destructive";
    case "internal_admin": return "default";
    case "sales": return "secondary";
    case "support": return "outline";
    case "finance": return "secondary";
    default: return "outline";
  }
};

export default function AdminUsers() {
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<InternalUser | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [userToEdit, setUserToEdit] = useState<InternalUser | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "support" as InternalRole,
  });

  useEffect(() => {
    if (!superAdminLoading && isSuperAdmin) {
      loadInternalUsers();
    }
  }, [superAdminLoading, isSuperAdmin]);

  const loadInternalUsers = async () => {
    try {
      setLoading(true);
      
      // Get users with internal roles (super_admin, internal_admin, sales, support, finance)
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["super_admin", "internal_admin", "sales", "support", "finance"]);

      if (roleError) throw roleError;

      if (!roleData || roleData.length === 0) {
        setUsers([]);
        return;
      }

      // Get staff profiles for these users
      const userIds = roleData.map(r => r.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from("staff_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);

      if (profileError) throw profileError;

      // Combine data
      const internalUsers: InternalUser[] = roleData.map(role => {
        const profile = profileData?.find(p => p.user_id === role.user_id);
        return {
          userId: role.user_id,
          email: "", // Will be populated later if needed
          firstName: profile?.first_name || "Unknown",
          lastName: profile?.last_name || "User",
          role: role.role as InternalRole,
        };
      });

      setUsers(internalUsers);
    } catch (error) {
      console.error("Error loading internal users:", error);
      toast.error("Failed to load internal users");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.firstName || !newUserForm.lastName || !newUserForm.email || !newUserForm.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (newUserForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setCreating(true);

      // Call edge function to create internal user
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newUserForm.email,
          password: newUserForm.password,
          firstName: newUserForm.firstName,
          lastName: newUserForm.lastName,
          role: newUserForm.role,
          isInternalUser: true, // Flag to indicate this is an internal Aspire Software user
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Internal user created successfully");
      setCreateDialogOpen(false);
      setNewUserForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        role: "support",
      });
      loadInternalUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // Remove the user's role (this doesn't delete the user, just removes their internal role)
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userToDelete.userId)
        .in("role", ["super_admin", "internal_admin", "sales", "support", "finance"]);

      if (error) throw error;

      toast.success("Internal role removed. Their login account still exists.");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadInternalUsers();
    } catch (error: any) {
      console.error("Error removing user:", error);
      toast.error(error.message || "Failed to remove user");
    }
  };

  const handleDeleteAccount = async () => {
    if (!userToDelete) return;

    setDeletingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { action: "delete-user", userId: userToDelete.userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Login account deleted permanently");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadInternalUsers();
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error(error.message || "Failed to delete account");
    } finally {
      setDeletingAccount(false);
    }
  };


  const handleRoleChange = async (userId: string, newRole: InternalRole) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Role updated successfully");
      loadInternalUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error(error.message || "Failed to update role");
    }
  };

  if (superAdminLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-destructive">Access denied. Super admin privileges required.</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <UserCog className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" />
              <span className="truncate">Internal User Management</span>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage Aspire Software staff accounts and roles
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="self-start sm:self-auto">
            <Plus className="h-4 w-4 mr-2" />
            New User
          </Button>
        </div>


        {/* Role Descriptions */}
        <Card>
          <CardHeader>
            <CardTitle>Internal Roles</CardTitle>
            <CardDescription>Role permissions for Aspire Software staff</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {INTERNAL_ROLES.map((role) => (
                <div key={role.value} className="p-3 border rounded-lg">
                  <Badge variant={getRoleBadgeVariant(role.value)} className="mb-2">
                    {role.label}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Members ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No internal users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.userId, value as InternalRole)}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INTERNAL_ROLES.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setUserToEdit(user);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setUserToDelete(user);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setUserToDelete(user);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create User Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Internal User</DialogTitle>
            <DialogDescription>
              Add a new Aspire Software staff member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={newUserForm.firstName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, firstName: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={newUserForm.lastName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, lastName: e.target.value })}
                  placeholder="Smith"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="john@roommaster.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password</Label>
              <Input
                id="password"
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="Min 6 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(value) => setNewUserForm({ ...newUserForm, role: value as InternalRole })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERNAL_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {userToDelete?.firstName} {userToDelete?.lastName}</AlertDialogTitle>
            <AlertDialogDescription>
              Choose what to remove:
              <br />
              <br />
              <strong>Remove internal role</strong> — revokes their access to internal admin
              functions, but their login account and email stay in the system (so the same email
              can't be used to create a brand-new account).
              <br />
              <br />
              <strong>Delete login account</strong> — permanently deletes the account and frees up
              the email address. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>
              Remove internal role
            </AlertDialogAction>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAccount();
              }}
              disabled={deletingAccount}
              className="bg-destructive text-destructive-foreground"
            >
              {deletingAccount ? "Deleting..." : "Delete login account"}
            </AlertDialogAction>
          </AlertDialogFooter>

        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Dialog */}
      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={userToEdit ? {
          userId: userToEdit.userId,
          firstName: userToEdit.firstName,
          lastName: userToEdit.lastName,
          email: userToEdit.email,
        } : null}
        onSaved={loadInternalUsers}
      />
    </DashboardLayout>
  );
}
