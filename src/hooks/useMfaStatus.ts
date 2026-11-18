import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MfaState = "loading" | "verified" | "needs_challenge" | "needs_enrollment" | "error";

/**
 * PCI DSS Requirement 8.4: multi-factor auth for all access to the CDE
 * (cardholder data environment). We enforce aal2 before rendering any
 * component that shows stored card metadata.
 */
export function useMfaStatus() {
  const [state, setState] = useState<MfaState>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const { data, error: err } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (err) throw err;
      if (data.currentLevel === "aal2") {
        setState("verified");
        return;
      }
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const verifiedTotp = (factors.data.totp ?? []).some(
        (f) => f.status === "verified",
      );
      setState(verifiedTotp ? "needs_challenge" : "needs_enrollment");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setState("error");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { state, error, refresh };
}
