import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Shield, Copy, Check } from "lucide-react";

interface MFAEnrollmentProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MFAEnrollment = ({ open, onClose, onSuccess }: MFAEnrollmentProps) => {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      enrollMFA();
    } else {
      // Reset state when closed
      setFactorId(null);
      setQrCode(null);
      setSecret(null);
      setVerificationCode("");
    }
  }, [open]);

  const enrollMFA = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });

      if (error) throw error;

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (error: any) {
      toast.error("Failed to start MFA enrollment: " + error.message);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const verifyMFA = async () => {
    if (!factorId || verificationCode.length !== 6) return;

    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: verificationCode,
      });

      if (error) throw error;

      // Log the MFA enrollment
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('security_audit_logs').insert({
          user_id: user.id,
          event_type: 'mfa_enrolled',
          event_description: 'User enrolled in MFA (TOTP)',
        });
      }

      toast.success("MFA enabled successfully!");
      onSuccess();
    } catch (error: any) {
      toast.error("Verification failed: " + error.message);
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Enable Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="QR Code" className="border rounded-lg" />
              </div>
            )}

            {secret && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Can't scan? Enter this code manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                    {secret}
                  </code>
                  <Button variant="outline" size="icon" onClick={copySecret}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={verifyMFA}
            disabled={verifying || verificationCode.length !== 6}
          >
            {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Verify & Enable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
