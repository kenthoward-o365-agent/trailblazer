import * as React from "react";
import { Input } from "@/components/ui/input";
import { isNANPCountry, formatNANPPhone, stripPhoneFormatting } from "@/lib/utils";

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  countryCode?: string;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, countryCode, className, ...props }, ref) => {
    const isNANP = isNANPCountry(countryCode || '');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      if (isNANP) {
        // For NANP countries, format the phone number
        const digits = stripPhoneFormatting(inputValue);
        if (digits.length <= 10) {
          onChange(formatNANPPhone(inputValue));
        }
      } else {
        // For non-NANP countries, allow free-format input
        onChange(inputValue);
      }
    };

    // Format existing value if switching to NANP country
    const displayValue = React.useMemo(() => {
      if (isNANP && value) {
        const digits = stripPhoneFormatting(value);
        if (digits.length > 0 && digits.length <= 10) {
          return formatNANPPhone(value);
        }
      }
      return value;
    }, [value, isNANP]);

    return (
      <Input
        ref={ref}
        type="tel"
        value={displayValue}
        onChange={handleChange}
        className={className}
        maxLength={isNANP ? 14 : undefined} // (XXX) XXX-XXXX = 14 chars
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";
