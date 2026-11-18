import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EnterpriseAccess {
  loading: boolean;
  isSuperAdmin: boolean;
  organizationId: string | null;
  isOrgAdmin: boolean;
  brandIds: string[];
  regionIds: string[];
}

export function useEnterpriseAccess(): EnterpriseAccess {
  const [state, setState] = useState<EnterpriseAccess>({
    loading: true,
    isSuperAdmin: false,
    organizationId: null,
    isOrgAdmin: false,
    brandIds: [],
    regionIds: [],
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState((s) => ({ ...s, loading: false })); return; }

      const [{ data: roles }, { data: upa }, { data: uba }, { data: ura }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("user_property_access").select("organization_id,is_org_admin").eq("user_id", user.id),
        supabase.from("user_brand_access").select("brand_id,organization_id"),
        supabase.from("user_region_access").select("region_id,organization_id"),
      ]);

      const isSuperAdmin = (roles ?? []).some((r: any) => r.role === "super_admin");
      const orgRow = (upa ?? []).find((r: any) => r.is_org_admin) ?? (upa ?? [])[0];
      setState({
        loading: false,
        isSuperAdmin,
        organizationId: orgRow?.organization_id ?? null,
        isOrgAdmin: !!orgRow?.is_org_admin,
        brandIds: (uba ?? []).map((r: any) => r.brand_id),
        regionIds: (ura ?? []).map((r: any) => r.region_id),
      });
    })();
  }, []);

  return state;
}
