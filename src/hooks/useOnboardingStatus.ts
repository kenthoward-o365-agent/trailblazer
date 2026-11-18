import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Checks whether the current user's primary property is still in onboarding.
 * Returns { needsOnboarding, propertyId, loading }.
 */
export function useOnboardingStatus() {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Super admins never see onboarding
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        if (roles?.some((r) => r.role === "super_admin")) {
          if (!cancelled) setLoading(false);
          return;
        }

        const { data: access } = await supabase
          .from("user_property_access")
          .select("property_id, is_org_admin")
          .eq("user_id", user.id)
          .eq("is_org_admin", true)
          .limit(1);

        if (!access || access.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }

        const pid = access[0].property_id;
        if (!pid) {
          if (!cancelled) setLoading(false);
          return;
        }

        const { data: prop } = await supabase
          .from("properties")
          .select("id, setup_completed")
          .eq("id", pid)
          .maybeSingle();

        if (!cancelled) {
          setPropertyId(pid);
          setNeedsOnboarding(!!prop && prop.setup_completed === false);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { needsOnboarding, propertyId, loading };
}
