import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OrgAdminState {
  isOrgAdmin: boolean;
  organizationId: string | null;
  organizationName: string | null;
  loading: boolean;
  properties: { id: string; name: string }[];
}

export const useOrgAdmin = () => {
  const [state, setState] = useState<OrgAdminState>({
    isOrgAdmin: false,
    organizationId: null,
    organizationName: null,
    loading: true,
    properties: [],
  });

  useEffect(() => {
    checkOrgAdminStatus();
  }, []);

  const checkOrgAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // Check if user is an org_admin in user_property_access
      const { data: accessData, error: accessError } = await supabase
        .from("user_property_access")
        .select(`
          organization_id,
          is_org_admin,
          organizations (id, name)
        `)
        .eq("user_id", user.id)
        .eq("is_org_admin", true)
        .maybeSingle();

      if (accessError || !accessData) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      const orgId = accessData.organization_id;
      const orgName = (accessData.organizations as any)?.name || null;

      // Get all properties in this organization
      const { data: propertiesData } = await supabase
        .from("properties")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name");

      setState({
        isOrgAdmin: true,
        organizationId: orgId,
        organizationName: orgName,
        loading: false,
        properties: propertiesData || [],
      });
    } catch (error) {
      console.error("Error checking org admin status:", error);
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  return state;
};
