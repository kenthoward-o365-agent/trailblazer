import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";

interface MFAVerificationProps {
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const MFAVerification = ({ factorId, onSuccess, onCancel }: MFAVerificationProps) => {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    if (code.length !== 6) return;

    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) throw verifyError;

      // Log successful MFA verification
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('security_audit_logs').insert({
          user_id: user.id,
          event_type: 'mfa_verified',
          event_description: 'User completed MFA verification',
        });
      }

      onSuccess();
    } catch (error: any) {
      toast.error("Verification failed: " + error.message);
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Verification Code</Label>
            <Input
              id="mfa-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="text-center text-2xl tracking-[0.5em] font-mono"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && verify()}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={verify}
              disabled={verifying || code.length !== 6}
            >
              {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verify
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
