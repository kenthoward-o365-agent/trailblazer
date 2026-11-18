import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Shield, Clock, Lock, Key } from "lucide-react";

interface SecuritySettings {
  sessionTimeoutMinutes: number;
  requireMfa: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  passwordRotationDays: number;
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
}

interface SecuritySettingsCardProps {
  settings: SecuritySettings;
  onChange: (settings: SecuritySettings) => void;
  disabled?: boolean;
}

export const SecuritySettingsCard = ({
  settings,
  onChange,
  disabled = false,
}: SecuritySettingsCardProps) => {
  const updateSetting = <K extends keyof SecuritySettings>(
    key: K,
    value: SecuritySettings[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Settings
        </CardTitle>
        <CardDescription>
          Configure PCI-compliant security settings for this property
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Session Timeout */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Session Timeout</Label>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              value={[settings.sessionTimeoutMinutes]}
              onValueChange={([v]) => updateSetting("sessionTimeoutMinutes", v)}
              min={5}
              max={60}
              step={5}
              disabled={disabled}
              className="flex-1"
            />
            <span className="w-24 text-sm text-muted-foreground">
              {settings.sessionTimeoutMinutes} minutes
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Users will be logged out after this period of inactivity (PCI requires max 15 min for payment terminals)
          </p>
        </div>

        {/* MFA Requirement */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="font-medium flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              Require Multi-Factor Authentication
            </Label>
            <p className="text-xs text-muted-foreground">
              All users must enable MFA to access this property
            </p>
          </div>
          <Switch
            checked={settings.requireMfa}
            onCheckedChange={(v) => updateSetting("requireMfa", v)}
            disabled={disabled}
          />
        </div>

        {/* Password Requirements */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Password Requirements</Label>
          </div>

          <div className="grid gap-3 pl-6">
            <div className="flex items-center gap-4">
              <Label className="w-40 text-sm">Minimum Length</Label>
              <Input
                type="number"
                value={settings.passwordMinLength}
                onChange={(e) => updateSetting("passwordMinLength", Math.max(8, parseInt(e.target.value) || 12))}
                min={8}
                max={32}
                disabled={disabled}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">characters (min 8)</span>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Require Uppercase Letter</Label>
              <Switch
                checked={settings.passwordRequireUppercase}
                onCheckedChange={(v) => updateSetting("passwordRequireUppercase", v)}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Require Number</Label>
              <Switch
                checked={settings.passwordRequireNumber}
                onCheckedChange={(v) => updateSetting("passwordRequireNumber", v)}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Require Special Character</Label>
              <Switch
                checked={settings.passwordRequireSpecial}
                onCheckedChange={(v) => updateSetting("passwordRequireSpecial", v)}
                disabled={disabled}
              />
            </div>

            <div className="flex items-center gap-4">
              <Label className="w-40 text-sm">Password Expiry</Label>
              <Input
                type="number"
                value={settings.passwordRotationDays}
                onChange={(e) => updateSetting("passwordRotationDays", Math.max(30, parseInt(e.target.value) || 90))}
                min={30}
                max={365}
                disabled={disabled}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">days (PCI requires max 90)</span>
            </div>
          </div>
        </div>

        {/* Account Lockout */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Account Lockout</Label>
          </div>

          <div className="grid gap-3 pl-6">
            <div className="flex items-center gap-4">
              <Label className="w-40 text-sm">Max Failed Attempts</Label>
              <Input
                type="number"
                value={settings.maxFailedLoginAttempts}
                onChange={(e) => updateSetting("maxFailedLoginAttempts", Math.max(3, parseInt(e.target.value) || 5))}
                min={3}
                max={10}
                disabled={disabled}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">attempts (PCI requires max 6)</span>
            </div>

            <div className="flex items-center gap-4">
              <Label className="w-40 text-sm">Lockout Duration</Label>
              <Input
                type="number"
                value={settings.lockoutDurationMinutes}
                onChange={(e) => updateSetting("lockoutDurationMinutes", Math.max(15, parseInt(e.target.value) || 30))}
                min={15}
                max={1440}
                disabled={disabled}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">minutes (PCI requires min 30)</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
