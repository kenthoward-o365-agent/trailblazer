import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useMfaStatus } from "@/hooks/useMfaStatus";

interface MfaGuardProps {
  /** Rendered once the current session reaches aal2. */
  children: React.ReactNode;
  /** Human label for the gated resource, shown in the challenge UI. */
  resourceLabel?: string;
}

/**
 * Wraps sensitive UI (payment cards, chargeback tools, etc.) with an MFA gate.
 * PCI DSS 8.4 requires MFA for all access to the cardholder data environment.
 */
export function MfaGuard({ children, resourceLabel = "payment data" }: MfaGuardProps) {
  const { state, error, refresh } = useMfaStatus();

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Verifying access…
      </div>
    );
  }

  if (state === "verified") return <>{children}</>;

  if (state === "error") {
    return (
      <Card className="p-4 border-destructive/40 bg-destructive/5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Unable to verify MFA</p>
            <p className="text-muted-foreground mt-1">{error}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={refresh}>
              Retry
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (state === "needs_enrollment") return <EnrollTotp onEnrolled={refresh} resourceLabel={resourceLabel} />;
  return <ChallengeTotp onVerified={refresh} resourceLabel={resourceLabel} />;
}

function EnrollTotp({ onEnrolled, resourceLabel }: { onEnrolled: () => void; resourceLabel: string }) {
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const startEnroll = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setEnrolling(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
  };

  const verify = async () => {
    if (!factorId) return;
    setVerifying(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setVerifying(false);
      toast.error(challenge.error.message);
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    setVerifying(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("MFA enrolled");
    onEnrolled();
  };

  return (
    <Card className="p-5 border-amber-500/40 bg-amber-500/5">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-3">
          <div>
            <p className="font-medium">MFA required to access {resourceLabel}</p>
            <p className="text-sm text-muted-foreground mt-1">
              PCI DSS requires multi-factor authentication for all access to the
              cardholder data environment. Enroll a TOTP authenticator app
              (1Password, Authy, Google Authenticator) to continue.
            </p>
          </div>
          {!qr ? (
            <Button onClick={startEnroll} disabled={enrolling} size="sm">
              {enrolling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Set up authenticator app
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                <img src={qr} alt="MFA QR code" className="w-40 h-40 border rounded bg-white p-2" />
                <div className="text-xs">
                  <p className="text-muted-foreground">Or enter this secret manually:</p>
                  <code className="block mt-1 p-2 bg-muted rounded break-all">{secret}</code>
                </div>
              </div>
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="totp-code">6-digit code</Label>
                <Input
                  id="totp-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                />
                <Button onClick={verify} disabled={verifying || code.length !== 6} size="sm">
                  {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Verify and enable
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function ChallengeTotp({ onVerified, resourceLabel }: { onVerified: () => void; resourceLabel: string }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const factors = await supabase.auth.mfa.listFactors();
      const totp = factors.data?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        toast.error("No verified TOTP factor found");
        return;
      }
      const challenge = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (challenge.error) throw challenge.error;
      const { error } = await supabase.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (error) throw error;
      onVerified();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1 space-y-3">
          <div>
            <p className="font-medium">Verify MFA to access {resourceLabel}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>
          <div className="flex gap-2 max-w-xs">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && submit()}
            />
            <Button onClick={submit} disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verify
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
