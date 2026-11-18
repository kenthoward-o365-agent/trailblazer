import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Users, RefreshCw, Trash2, Building2, Shield, Pencil, UserPlus } from "lucide-react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

interface OrgAdmin {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  organizationName: string;
}

interface Organization {
  id: string;
  name: string;
}

interface StaffUser {
  user_id: string;
  first_name: string;
  last_name: string;
}

export const AdminUserAccess = () => {
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgAdmins, setOrgAdmins] = useState<OrgAdmin[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<OrgAdmin | null>(null);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [activeTab, setActiveTab] = useState("create");
  const [creating, setCreating] = useState(false);
  
  // New user form state
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");

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

      // Load all org admin access records with organization info
      const { data: orgAdminAccess } = await supabase
        .from("user_property_access")
        .select(`
          id,
          user_id,
          organization_id,
          organizations (name)
        `)
        .eq("is_org_admin", true);

      // Get user names for org admins
      const orgAdminUserIds = [...new Set((orgAdminAccess || []).map((a) => a.user_id))];
      const { data: staffData } = await supabase
        .from("staff_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", orgAdminUserIds);

      const staffMap = new Map(
        (staffData || []).map((s) => [s.user_id, { firstName: s.first_name, lastName: s.last_name }])
      );

      // Build org admins list
      const admins: OrgAdmin[] = (orgAdminAccess || []).map((access) => {
        const staff = staffMap.get(access.user_id);
        return {
          id: access.id,
          userId: access.user_id,
          firstName: staff?.firstName || "",
          lastName: staff?.lastName || "",
          organizationId: access.organization_id,
          organizationName: (access.organizations as any)?.name || "",
        };
      });

      setOrgAdmins(admins);

      // Load all staff users for the select dropdown
      const { data: allStaff } = await supabase
        .from("staff_profiles")
        .select("user_id, first_name, last_name")
        .order("first_name");

      setStaffUsers(allStaff || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrgAdmin = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }
    if (!selectedOrgId) {
      toast.error("Please select an organization");
      return;
    }

    try {
      // Check if user already has org admin access to this org
      const { data: existing } = await supabase
        .from("user_property_access")
        .select("id")
        .eq("user_id", selectedUserId)
        .eq("organization_id", selectedOrgId)
        .eq("is_org_admin", true)
        .maybeSingle();

      if (existing) {
        toast.error("This user is already an Org Admin for this organization");
        return;
      }

      const { error } = await supabase.from("user_property_access").insert({
        user_id: selectedUserId,
        organization_id: selectedOrgId,
        property_id: null,
        is_org_admin: true,
      });

      if (error) throw error;

      toast.success("Organization Admin assigned successfully");
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error adding org admin:", error);
      toast.error("Failed to assign Organization Admin");
    }
  };

  const handleRemoveOrgAdmin = async (accessId: string) => {
    if (!confirm("Are you sure you want to remove this Organization Admin? They will no longer be able to manage this organization.")) return;

    try {
      const { error } = await supabase
        .from("user_property_access")
        .delete()
        .eq("id", accessId);

      if (error) throw error;

      toast.success("Organization Admin removed");
      loadData();
    } catch (error) {
      console.error("Error removing org admin:", error);
      toast.error("Failed to remove Organization Admin");
    }
  };

  const handleEditAdmin = (admin: OrgAdmin) => {
    setEditingAdmin(admin);
    setSelectedOrgId(admin.organizationId);
    setDialogOpen(true);
  };

  const handleUpdateOrgAdmin = async () => {
    if (!editingAdmin || !selectedOrgId) return;

    try {
      // If org changed, update the record
      if (selectedOrgId !== editingAdmin.organizationId) {
        const { error } = await supabase
          .from("user_property_access")
          .update({ organization_id: selectedOrgId })
          .eq("id", editingAdmin.id);

        if (error) throw error;
      }

      toast.success("Organization Admin updated");
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Error updating org admin:", error);
      toast.error("Failed to update Organization Admin");
    }
  };

  const handleCreateAndAssignOrgAdmin = async () => {
    if (!selectedOrgId) {
      toast.error("Please select an organization");
      return;
    }
    if (!newUserEmail || !newUserPassword || !newUserFirstName || !newUserLastName) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newUserPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setCreating(true);

      // Create the user via edge function
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          firstName: newUserFirstName,
          lastName: newUserLastName,
          role: "admin",
          organizationId: selectedOrgId,
          isOrgAdmin: true,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // The edge function created the user, now add org admin access
      const { error: accessError } = await supabase.from("user_property_access").insert({
        user_id: data.user.id,
        organization_id: selectedOrgId,
        property_id: null,
        is_org_admin: true,
      });

      if (accessError) throw accessError;

      toast.success(`Organization Admin created: ${newUserEmail}`);
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error("Error creating org admin:", error);
      toast.error(error.message || "Failed to create Organization Admin");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setSelectedUserId("");
    setSelectedOrgId("");
    setActiveTab("create");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserFirstName("");
    setNewUserLastName("");
    setEditingAdmin(null);
  };

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
              <Shield className="h-6 w-6" />
              Organization Admin Setup
            </h1>
            <p className="text-muted-foreground">
              Create and manage Organization Admins who can self-manage property access.
            </p>
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
                  New User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingAdmin ? "Edit Organization Admin" : "New Organization Admin"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Organization *</Label>
                    <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
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

                  {editingAdmin ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm">
                          <strong>Current User:</strong> {editingAdmin.firstName} {editingAdmin.lastName}
                        </p>
                      </div>
                      <Button onClick={handleUpdateOrgAdmin} className="w-full" disabled={!selectedOrgId}>
                        Update Organization
                      </Button>
                    </div>
                  ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="create">
                          <UserPlus className="h-4 w-4 mr-2" />
                          Create New
                        </TabsTrigger>
                        <TabsTrigger value="existing">
                          <Users className="h-4 w-4 mr-2" />
                          Existing User
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="create" className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>First Name *</Label>
                            <Input
                              value={newUserFirstName}
                              onChange={(e) => setNewUserFirstName(e.target.value)}
                              placeholder="John"
                            />
                          </div>
                          <div>
                            <Label>Last Name *</Label>
                            <Input
                              value={newUserLastName}
                              onChange={(e) => setNewUserLastName(e.target.value)}
                              placeholder="Smith"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            placeholder="john@example.com"
                          />
                        </div>
                        <div>
                          <Label>Temporary Password *</Label>
                          <Input
                            type="password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Share this with the customer. They should change it on first login.
                          </p>
                        </div>
                        <Button 
                          onClick={handleCreateAndAssignOrgAdmin} 
                          className="w-full" 
                          disabled={creating || !selectedOrgId || !newUserEmail || !newUserPassword || !newUserFirstName || !newUserLastName}
                        >
                          {creating ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-4 w-4 mr-2" />
                              Create User
                            </>
                          )}
                        </Button>
                      </TabsContent>

                      <TabsContent value="existing" className="space-y-4 mt-4">
                        <div>
                          <Label>Select User *</Label>
                          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select user to become Org Admin" />
                            </SelectTrigger>
                            <SelectContent>
                              {staffUsers.map((user) => (
                                <SelectItem key={user.user_id} value={user.user_id}>
                                  {user.first_name} {user.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {staffUsers.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              No existing users found. Use "Create New" tab.
                            </p>
                          )}
                        </div>
                        <Button onClick={handleAddOrgAdmin} className="w-full" disabled={!selectedUserId || !selectedOrgId}>
                          Assign as Organization Admin
                        </Button>
                      </TabsContent>
                    </Tabs>
                  )}

                  <Card className="p-3 bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      <strong>Note:</strong> Organization Admins can:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Access all properties in their organization</li>
                      <li>• Grant/revoke property access for other users</li>
                      <li>• Promote other users to Organization Admin</li>
                    </ul>
                  </Card>
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
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Admin Name</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgAdmins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{admin.organizationName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {admin.firstName} {admin.lastName}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAdmin(admin)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveOrgAdmin(admin.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {orgAdmins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No Organization Admins created yet. Click "New User" to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        <Card className="p-4 bg-muted/50">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Self-Service Model
          </h3>
          <p className="text-sm text-muted-foreground">
            Once an Organization Admin is assigned, they can manage their own property access through{" "}
            <strong>Settings → Users → Property Access</strong> tab. This enables customers to self-serve
            without contacting roomMaster support.
          </p>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminUserAccess;
