import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminAccessState {
  isAdminAccess: boolean;
  sessionId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  adminUserName: string | null;
  adminRole: string | null;
  startedAt: string | null;
}

const STORAGE_KEYS = {
  IS_ADMIN_ACCESS: "roommaster_admin_access",
  SESSION_ID: "roommaster_admin_session_id",
  PROPERTY_ID: "roommaster_admin_property_id",
  PROPERTY_NAME: "roommaster_admin_property_name",
  ORGANIZATION_ID: "roommaster_admin_organization_id",
  ORGANIZATION_NAME: "roommaster_admin_organization_name",
  ADMIN_USER_NAME: "roommaster_admin_user_name",
  ADMIN_ROLE: "roommaster_admin_role",
  STARTED_AT: "roommaster_admin_started_at",
};

export const useAdminAccess = () => {
  const [state, setState] = useState<AdminAccessState>({
    isAdminAccess: false,
    sessionId: null,
    propertyId: null,
    propertyName: null,
    organizationId: null,
    organizationName: null,
    adminUserName: null,
    adminRole: null,
    startedAt: null,
  });

  // Load state from localStorage on mount
  useEffect(() => {
    const isAdminAccess = localStorage.getItem(STORAGE_KEYS.IS_ADMIN_ACCESS) === "true";
    if (isAdminAccess) {
      setState({
        isAdminAccess: true,
        sessionId: localStorage.getItem(STORAGE_KEYS.SESSION_ID),
        propertyId: localStorage.getItem(STORAGE_KEYS.PROPERTY_ID),
        propertyName: localStorage.getItem(STORAGE_KEYS.PROPERTY_NAME),
        organizationId: localStorage.getItem(STORAGE_KEYS.ORGANIZATION_ID),
        organizationName: localStorage.getItem(STORAGE_KEYS.ORGANIZATION_NAME),
        adminUserName: localStorage.getItem(STORAGE_KEYS.ADMIN_USER_NAME),
        adminRole: localStorage.getItem(STORAGE_KEYS.ADMIN_ROLE),
        startedAt: localStorage.getItem(STORAGE_KEYS.STARTED_AT),
      });
    }
  }, []);

  const logAuditAction = async (
    action: "access_started" | "access_ended",
    sessionId: string,
    adminUserId: string,
    adminUserName: string,
    adminRole: string,
    propertyId: string,
    propertyName: string,
    organizationId: string | null,
    organizationName: string | null
  ) => {
    try {
      await supabase.from("admin_access_audit").insert({
        admin_user_id: adminUserId,
        admin_user_name: adminUserName,
        admin_role: adminRole,
        property_id: propertyId,
        property_name: propertyName,
        organization_id: organizationId,
        organization_name: organizationName,
        action,
        session_id: sessionId,
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error("Failed to log admin access audit:", error);
    }
  };

  const startAdminAccess = useCallback(async (
    propertyId: string,
    propertyName: string,
    organizationId: string | null,
    organizationName: string | null
  ) => {
    try {
      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Unable to verify user session");
        return false;
      }

      // Get user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["super_admin", "internal_admin"])
        .single();

      if (!roleData) {
        toast.error("You don't have permission to use Admin Access");
        return false;
      }

      const adminUserName = user.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
        : user.email || "Unknown Admin";

      const sessionId = crypto.randomUUID();
      const startedAt = new Date().toISOString();

      // Store in localStorage
      localStorage.setItem(STORAGE_KEYS.IS_ADMIN_ACCESS, "true");
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
      localStorage.setItem(STORAGE_KEYS.PROPERTY_ID, propertyId);
      localStorage.setItem(STORAGE_KEYS.PROPERTY_NAME, propertyName);
      localStorage.setItem(STORAGE_KEYS.ORGANIZATION_ID, organizationId || "");
      localStorage.setItem(STORAGE_KEYS.ORGANIZATION_NAME, organizationName || "");
      localStorage.setItem(STORAGE_KEYS.ADMIN_USER_NAME, adminUserName);
      localStorage.setItem(STORAGE_KEYS.ADMIN_ROLE, roleData.role);
      localStorage.setItem(STORAGE_KEYS.STARTED_AT, startedAt);

      // Update state
      setState({
        isAdminAccess: true,
        sessionId,
        propertyId,
        propertyName,
        organizationId,
        organizationName,
        adminUserName,
        adminRole: roleData.role,
        startedAt,
      });

      // Log to audit table
      await logAuditAction(
        "access_started",
        sessionId,
        user.id,
        adminUserName,
        roleData.role,
        propertyId,
        propertyName,
        organizationId,
        organizationName
      );

      toast.success(`roomMaster Admin Access enabled for ${propertyName}`);
      return true;
    } catch (error) {
      console.error("Error starting admin access:", error);
      toast.error("Failed to start Admin Access");
      return false;
    }
  }, []);

  const endAdminAccess = useCallback(async () => {
    try {
      const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
      const propertyId = localStorage.getItem(STORAGE_KEYS.PROPERTY_ID);
      const propertyName = localStorage.getItem(STORAGE_KEYS.PROPERTY_NAME);
      const organizationId = localStorage.getItem(STORAGE_KEYS.ORGANIZATION_ID);
      const organizationName = localStorage.getItem(STORAGE_KEYS.ORGANIZATION_NAME);
      const adminUserName = localStorage.getItem(STORAGE_KEYS.ADMIN_USER_NAME);
      const adminRole = localStorage.getItem(STORAGE_KEYS.ADMIN_ROLE);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Log end action if we have session info
      if (sessionId && propertyId && user) {
        await logAuditAction(
          "access_ended",
          sessionId,
          user.id,
          adminUserName || "Unknown",
          adminRole || "unknown",
          propertyId,
          propertyName || "Unknown",
          organizationId || null,
          organizationName || null
        );
      }

      // Clear localStorage
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });

      // Reset state
      setState({
        isAdminAccess: false,
        sessionId: null,
        propertyId: null,
        propertyName: null,
        organizationId: null,
        organizationName: null,
        adminUserName: null,
        adminRole: null,
        startedAt: null,
      });

      toast.success("roomMaster Admin Access ended");
      return true;
    } catch (error) {
      console.error("Error ending admin access:", error);
      toast.error("Failed to end Admin Access");
      return false;
    }
  }, []);

  // Helper function to get the admin access label for change journal
  const getAdminAccessLabel = useCallback((baseName: string): string => {
    if (state.isAdminAccess && state.adminUserName) {
      return `roomMaster Admin (${state.adminUserName})`;
    }
    return baseName;
  }, [state.isAdminAccess, state.adminUserName]);

  return {
    ...state,
    startAdminAccess,
    endAdminAccess,
    getAdminAccessLabel,
  };
};

// Static helper function for use outside of React components (e.g., in changeJournal.ts)
export const isInAdminAccessMode = (): boolean => {
  return localStorage.getItem("roommaster_admin_access") === "true";
};

export const getAdminAccessUserName = (): string | null => {
  return localStorage.getItem("roommaster_admin_user_name");
};
