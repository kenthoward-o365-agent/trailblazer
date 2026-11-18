import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProperty } from "@/contexts/PropertyContext";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface UserWithRole {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: AppRole | null;
  role_id: string | null;
  hasPropertyAccess?: boolean;
  accessId?: string;
}

export interface StaffUser {
  user_id: string;
  first_name: string;
  last_name: string;
}

export interface NewUserForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: AppRole;
}

const initialNewUserForm: NewUserForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  role: "front_desk",
};


export function useUserManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState<NewUserForm>(initialNewUserForm);

  const { selectedProperty, organization } = useProperty();

  const checkAdminStatus = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      
      setIsAdmin(data?.role === "admin" || data?.role === "super_admin");
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("staff_profiles")
        .select("id, user_id, first_name, last_name, phone")
        .order("first_name");

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role");

      if (rolesError) throw rolesError;

      let propertyAccessMap = new Map<string, string>();
      if (selectedProperty?.id && organization?.id) {
        const { data: accessData } = await supabase
          .from("user_property_access")
          .select("id, user_id")
          .eq("organization_id", organization.id)
          .or(`property_id.eq.${selectedProperty.id},is_org_admin.eq.true`);

        (accessData || []).forEach(a => {
          propertyAccessMap.set(a.user_id, a.id);
        });
      }

      const usersWithRoles: UserWithRole[] = (profiles || [])
        .filter(profile => propertyAccessMap.has(profile.user_id))
        .map((profile) => {
          const userRole = roles?.find((r) => r.user_id === profile.user_id);
          return {
            id: profile.id,
            user_id: profile.user_id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: (profile as any).phone ?? null,
            role: userRole?.role || null,
            role_id: userRole?.id || null,
            hasPropertyAccess: true,
            accessId: propertyAccessMap.get(profile.user_id),
          };
        });


      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [selectedProperty?.id, organization?.id]);

  const updateUserRole = useCallback(async (userId: string, newRole: AppRole) => {
    setUpdating(userId);

    try {
      const user = users.find((u) => u.user_id === userId);
      
      if (user?.role_id) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("id", user.role_id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });

        if (error) throw error;
      }

      toast.success(`Role updated to ${newRole}`);
      loadUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role. Make sure you have admin permissions.");
    } finally {
      setUpdating(null);
    }
  }, [users, loadUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          action: "delete-user",
          userId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("User deleted successfully");
      loadUsers();
      return true;
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
      return false;
    }
  }, [loadUsers]);

  const removeUserFromProperty = useCallback(async (accessId: string) => {
    try {
      const { error } = await supabase
        .from("user_property_access")
        .delete()
        .eq("id", accessId);

      if (error) throw error;

      toast.success("User removed from property");
      loadUsers();
      return true;
    } catch (error) {
      console.error("Error removing user:", error);
      toast.error("Failed to remove user from property");
      return false;
    }
  }, [loadUsers]);

  const createNewUser = useCallback(async () => {
    if (!newUserForm.firstName || !newUserForm.lastName || !newUserForm.email || !newUserForm.password) {
      toast.error("Please fill in all fields");
      return false;
    }

    if (newUserForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return false;
    }

    if (!selectedProperty?.id || !organization?.id) {
      toast.error("No property selected");
      return false;
    }

    setCreatingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in");
        return false;
      }

      const response = await supabase.functions.invoke("create-user", {
        body: {
          email: newUserForm.email,
          password: newUserForm.password,
          firstName: newUserForm.firstName,
          lastName: newUserForm.lastName,
          phone: newUserForm.phone?.trim() || null,
          role: newUserForm.role,
          propertyId: selectedProperty.id,
          organizationId: organization.id,
        },
      });


      if (response.error) {
        // Surface the real message from the function instead of "non-2xx status code"
        let message = response.error.message || "Failed to create user";
        const ctx = (response.error as any).context;
        try {
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.clone().json();
            if (body?.error) message = body.error;
          }
        } catch {
          // ignore parse failures, keep default message
        }
        throw new Error(message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }


      toast.success(`User ${newUserForm.firstName} ${newUserForm.lastName} created successfully`);
      setNewUserForm(initialNewUserForm);
      loadUsers();
      return true;
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create user");
      return false;
    } finally {
      setCreatingUser(false);
    }
  }, [newUserForm, selectedProperty?.id, organization?.id, loadUsers]);

  const resetNewUserForm = useCallback(() => {
    setNewUserForm(initialNewUserForm);
  }, []);

  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  useEffect(() => {
    if (selectedProperty?.id) {
      loadUsers();
    }
  }, [selectedProperty?.id, loadUsers]);

  return {
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
    organization,
  };
}

export function getRoleBadgeVariant(role: AppRole | null): "destructive" | "default" | "secondary" | "outline" {
  switch (role) {
    case "admin":
      return "destructive";
    case "manager":
      return "default";
    case "front_desk":
      return "secondary";
    default:
      return "outline";
  }
}
