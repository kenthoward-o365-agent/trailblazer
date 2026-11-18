import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

// NANP countries that use (XXX) XXX-XXXX format
const NANP_COUNTRIES = ['US', 'CA', 'PR', 'JM', 'DO'];

export function isNANPCountry(countryCode: string): boolean {
  return NANP_COUNTRIES.includes(countryCode?.toUpperCase() || '');
}

export function stripPhoneFormatting(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatNANPPhone(value: string): string {
  const digits = stripPhoneFormatting(value).slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
