import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VerifiedMembership {
  member_account_id: string;
  member_number: string;
  program: { name: string; code: string | null; currency: string } | null;
  tier: { name: string; discount_percent: number; free_nights_per_year: number; points_multiplier: number; priority: number } | null;
  discount_percent: number;
  points_balance: number;
}

export function useMembershipVerify() {
  const [loading, setLoading] = useState(false);
  const [membership, setMembership] = useState<VerifiedMembership | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async (member_number: string, last_name: string, property_id?: string) => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("membership-verify", {
        body: { member_number, last_name, property_id },
      });
      if (error) throw error;
      if (!data?.verified) {
        setMembership(null);
        setError(data?.reason ?? "not_verified");
        return null;
      }
      setMembership(data as VerifiedMembership);
      return data as VerifiedMembership;
    } catch (e: any) {
      setError(e.message ?? "error");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => { setMembership(null); setError(null); }, []);

  return { verify, membership, loading, error, clear };
}
