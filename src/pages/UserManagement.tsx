import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, RefreshCw, UserCog, Building2 } from "lucide-react";
import { PropertyAccessManager } from "@/components/PropertyAccessManager";
import { useOrgAdmin } from "@/hooks/useOrgAdmin";
import { EditUserDialog } from "@/components/EditUserDialog";
import { CustomRoleManager } from "@/components/CustomRoleManager";
import { useUserManagement, getRoleBadgeVariant } from "@/hooks/useUserManagement";
import { useUserManagementDialogs } from "@/hooks/useUserManagementDialogs";
import { StaffRolesCard } from "@/components/user-management/StaffRolesCard";
import { CreateUserDialog } from "@/components/user-management/CreateUserDialog";
import { RoleChangeDialog } from "@/components/user-management/RoleChangeDialog";
import { DeleteUserDialog } from "@/components/user-management/DeleteUserDialog";
import { RemoveAccessDialog } from "@/components/user-management/RemoveAccessDialog";
import { RolePermissionsCard } from "@/components/user-management/RolePermissionsCard";

const UserManagement = () => {
  const {
    users,
    loading,
    updating,
    currentUserId,
    isAdmin,
    creatingUser,
    newUserForm,
    setNewUserForm,
    loadUsers,
    updateUserRole,
    deleteUser,
    removeUserFromProperty,
    createNewUser,
    resetNewUserForm,
    selectedProperty,
  } = useUserManagement();

  const {
    addUserDialogOpen,
    setAddUserDialogOpen,
    confirmDialog,
    openRoleChangeDialog,
    closeRoleChangeDialog,
    deleteAccessDialog,
    openDeleteAccessDialog,
    closeDeleteAccessDialog,
    deleteUserDialog,
    openDeleteUserDialog,
    closeDeleteUserDialog,
    editUserDialog,
    openEditUserDialog,
    closeEditUserDialog,
  } = useUserManagementDialogs();

  const { isOrgAdmin, organizationId, organizationName, properties, loading: orgAdminLoading } = useOrgAdmin();

  const hasAccess = isAdmin || isOrgAdmin;
  const canManageUsers = isAdmin || isOrgAdmin;

  const handleConfirmRoleChange = async () => {
    if (confirmDialog) {
      await updateUserRole(confirmDialog.userId, confirmDialog.newRole);
      closeRoleChangeDialog();
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (deleteUserDialog) {
      const success = await deleteUser(deleteUserDialog.userId);
      if (success) closeDeleteUserDialog();
    }
  };

  const handleConfirmRemoveAccess = async () => {
    if (deleteAccessDialog) {
      const success = await removeUserFromProperty(deleteAccessDialog.accessId);
      if (success) closeDeleteAccessDialog();
    }
  };

  if (!hasAccess && !loading && !orgAdminLoading) {
    return (
      <DashboardLayout>
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You need admin or organization admin privileges to access user management.
          </p>
        </Card>
      </DashboardLayout>
    );
  }

  const staffRolesCardProps = {
    users,
    loading,
    updating,
    currentUserId,
    canManageUsers,
    canChangeRoles: isAdmin || isOrgAdmin,
    onRoleChange: openRoleChangeDialog,
    getRoleBadgeVariant,
    onAddUser: () => setAddUserDialogOpen(true),
    onEditUser: openEditUserDialog,
    onDeleteUser: openDeleteUserDialog,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <UserCog className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" />
              User Management
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage staff roles and property access
              {selectedProperty && (
                <span className="ml-1">for <strong>{selectedProperty.name}</strong></span>
              )}
            </p>
          </div>
          <Button variant="outline" onClick={loadUsers} disabled={loading} className="self-start sm:self-auto">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {isOrgAdmin && organizationId ? (
          <Tabs defaultValue="roles" className="space-y-4">
            <TabsList className="w-full flex overflow-x-auto sm:inline-flex sm:w-auto">
              <TabsTrigger value="roles" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Staff Roles
              </TabsTrigger>
              <TabsTrigger value="custom-roles" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Custom Roles
              </TabsTrigger>
              <TabsTrigger value="access" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                All Property Access
              </TabsTrigger>
            </TabsList>


            <TabsContent value="roles">
              <StaffRolesCard {...staffRolesCardProps} />
            </TabsContent>

            <TabsContent value="custom-roles">
              {selectedProperty?.id && (
                <CustomRoleManager propertyId={selectedProperty.id} />
              )}
            </TabsContent>

            <TabsContent value="access">
              <PropertyAccessManager
                organizationId={organizationId}
                organizationName={organizationName || "Organization"}
                properties={properties}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <StaffRolesCard {...staffRolesCardProps} />
        )}

        <RolePermissionsCard />
      </div>

      <RoleChangeDialog
        dialog={confirmDialog}
        onClose={closeRoleChangeDialog}
        onConfirm={handleConfirmRoleChange}
      />

      <CreateUserDialog
        open={addUserDialogOpen}
        onOpenChange={setAddUserDialogOpen}
        form={newUserForm}
        onFormChange={setNewUserForm}
        onSubmit={createNewUser}
        creating={creatingUser}
        onReset={resetNewUserForm}
      />

      <RemoveAccessDialog
        dialog={deleteAccessDialog}
        onClose={closeDeleteAccessDialog}
        onConfirm={handleConfirmRemoveAccess}
      />

      <DeleteUserDialog
        dialog={deleteUserDialog}
        onClose={closeDeleteUserDialog}
        onConfirm={handleConfirmDeleteUser}
      />

      <EditUserDialog
        open={editUserDialog.open}
        onOpenChange={(open) => open ? undefined : closeEditUserDialog()}
        user={editUserDialog.user}
        onSaved={loadUsers}
      />
    </DashboardLayout>
  );
};

export default UserManagement;
