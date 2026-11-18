import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  requirements: PasswordRequirements;
  showIndicator?: boolean;
}

export const validatePassword = (password: string, requirements: PasswordRequirements) => {
  const checks = {
    length: password.length >= requirements.minLength,
    uppercase: !requirements.requireUppercase || /[A-Z]/.test(password),
    number: !requirements.requireNumber || /[0-9]/.test(password),
    special: !requirements.requireSpecial || /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const isValid = Object.values(checks).every(Boolean);
  const strength = Object.values(checks).filter(Boolean).length;

  return { checks, isValid, strength };
};

export const PasswordStrengthIndicator = ({
  password,
  requirements,
  showIndicator = true,
}: PasswordStrengthIndicatorProps) => {
  const { checks, strength } = validatePassword(password, requirements);

  const getStrengthColor = () => {
    if (strength <= 1) return "bg-destructive";
    if (strength <= 2) return "bg-orange-500";
    if (strength <= 3) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStrengthLabel = () => {
    if (strength <= 1) return "Weak";
    if (strength <= 2) return "Fair";
    if (strength <= 3) return "Good";
    return "Strong";
  };

  if (!showIndicator || !password) return null;

  return (
    <div className="space-y-2 mt-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", getStrengthColor())}
            style={{ width: `${(strength / 4) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground w-12">{getStrengthLabel()}</span>
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-1 text-sm">
        <RequirementItem
          met={checks.length}
          text={`At least ${requirements.minLength} characters`}
        />
        {requirements.requireUppercase && (
          <RequirementItem
            met={checks.uppercase}
            text="At least one uppercase letter"
          />
        )}
        {requirements.requireNumber && (
          <RequirementItem
            met={checks.number}
            text="At least one number"
          />
        )}
        {requirements.requireSpecial && (
          <RequirementItem
            met={checks.special}
            text="At least one special character (!@#$%^&*)"
          />
        )}
      </ul>
    </div>
  );
};

const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
  <li className={cn("flex items-center gap-2", met ? "text-green-600" : "text-muted-foreground")}>
    {met ? (
      <Check className="h-3.5 w-3.5" />
    ) : (
      <X className="h-3.5 w-3.5" />
    )}
    <span>{text}</span>
  </li>
);
