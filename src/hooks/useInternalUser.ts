import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type InternalRole = "super_admin" | "internal_admin" | "sales" | "support" | "finance";

const INTERNAL_ROLES: InternalRole[] = ["super_admin", "internal_admin", "sales", "support", "finance"];

const QUERY_KEY = ["internal-user"] as const;

interface InternalUserData {
  isInternalUser: boolean;
  internalRole: InternalRole | null;
}

export const useInternalUser = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<InternalUserData>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { isInternalUser: false, internalRole: null };

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", INTERNAL_ROLES)
        .maybeSingle();

      if (roleData && INTERNAL_ROLES.includes(roleData.role as InternalRole)) {
        return {
          isInternalUser: true,
          internalRole: roleData.role as InternalRole,
        };
      }
      return { isInternalUser: false, internalRole: null };
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      } else if (event === "SIGNED_OUT") {
        queryClient.removeQueries({ queryKey: QUERY_KEY });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  return {
    isInternalUser: data?.isInternalUser ?? false,
    internalRole: data?.internalRole ?? null,
    loading: isLoading,
  };
};
