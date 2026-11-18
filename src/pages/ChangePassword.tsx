import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrengthIndicator, validatePassword } from "@/components/PasswordStrengthIndicator";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

const ChangePassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requirements, setRequirements] = useState({
    minLength: 12,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: true,
  });
  const [isForced, setIsForced] = useState(false);

  useEffect(() => {
    // Check if this is a forced password change
    const forced = new URLSearchParams(window.location.search).get('forced');
    setIsForced(forced === 'true');

    // Load password requirements from property settings
    loadRequirements();
  }, []);

  const loadRequirements = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's property access to determine requirements
      const { data: access } = await supabase
        .from('user_property_access')
        .select('property_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (access?.property_id) {
        const { data: property } = await supabase
          .from('properties')
          .select('password_min_length, password_require_uppercase, password_require_number, password_require_special')
          .eq('id', access.property_id)
          .single();

        if (property) {
          setRequirements({
            minLength: property.password_min_length || 12,
            requireUppercase: property.password_require_uppercase ?? true,
            requireNumber: property.password_require_number ?? true,
            requireSpecial: property.password_require_special ?? true,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load password requirements:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    const { isValid } = validatePassword(newPassword, requirements);
    if (!isValid) {
      toast.error("Password does not meet requirements");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Record password change
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_password_history').insert({
          user_id: user.id,
          password_changed_at: new Date().toISOString(),
        });

        await supabase.from('security_audit_logs').insert({
          user_id: user.id,
          event_type: 'password_changed',
          event_description: isForced ? 'User changed expired password' : 'User changed password',
        });
      }

      toast.success("Password changed successfully");
      navigate('/');
    } catch (error: any) {
      toast.error("Failed to change password: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle>
            {isForced ? "Password Expired" : "Change Password"}
          </CardTitle>
          <CardDescription>
            {isForced
              ? "Your password has expired and must be changed to continue."
              : "Enter your current password and choose a new one."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isForced && (
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required={!isForced}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <PasswordStrengthIndicator
                password={newPassword}
                requirements={requirements}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-destructive">Passwords do not match</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Change Password
            </Button>

            {!isForced && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword;
