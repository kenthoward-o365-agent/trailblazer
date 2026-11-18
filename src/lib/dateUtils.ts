import { format, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

/**
 * Parses a date-only string (YYYY-MM-DD) as local time, avoiding timezone shifts.
 * Use this for date-only fields from the database (check_in_date, check_out_date, posting_date, etc.)
 * 
 * @param dateStr - A date string in YYYY-MM-DD format
 * @returns A Date object in local time, or null if invalid
 */
export function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // For date-only strings, split and create as local date to avoid UTC interpretation
  const [year, month, day] = dateStr.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return new Date(year, month - 1, day);
}

/**
 * Formats a date-only string for display, using local timezone.
 * Wrapper around date-fns format that handles the timezone issue.
 * 
 * @param dateStr - A date string in YYYY-MM-DD format
 * @param formatStr - date-fns format string (default: "MMM d, yyyy")
 * @returns Formatted date string, or empty string if invalid
 */
export function formatLocalDate(
  dateStr: string | null | undefined, 
  formatStr: string = "MMM d, yyyy"
): string {
  const date = parseLocalDate(dateStr);
  if (!date) return "";
  return format(date, formatStr);
}

/**
 * Gets today's date as a YYYY-MM-DD string in local timezone.
 * Use this instead of new Date().toISOString().split('T')[0] which can be wrong near midnight.
 * 
 * @returns Today's date in YYYY-MM-DD format
 */
export function getTodayString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// ============================================================================
// Property Timezone Functions
// These functions use the property's configured timezone for accurate date/time
// ============================================================================

const DEFAULT_TIMEZONE = "America/New_York";

/**
 * Gets the current date in the property's timezone as YYYY-MM-DD.
 * Use this for determining "today" for business operations.
 * 
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Today's date in YYYY-MM-DD format in the property's timezone
 */
export function getPropertyTodayString(timezone: string | null | undefined): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    return formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  } catch (error) {
    console.warn(`Invalid timezone "${tz}", falling back to default`, error);
    return formatInTimeZone(new Date(), DEFAULT_TIMEZONE, "yyyy-MM-dd");
  }
}

/**
 * Gets the current Date object adjusted to the property's timezone.
 * 
 * @param timezone - IANA timezone string
 * @returns Date object representing current time in property's timezone
 */
export function getPropertyNow(timezone: string | null | undefined): Date {
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    return toZonedTime(new Date(), tz);
  } catch (error) {
    console.warn(`Invalid timezone "${tz}", falling back to default`, error);
    return toZonedTime(new Date(), DEFAULT_TIMEZONE);
  }
}

/**
 * Formats a UTC timestamp for display in the property's timezone.
 * Use this for timestamps like created_at, updated_at, etc.
 * 
 * @param isoString - ISO 8601 timestamp string (from database)
 * @param timezone - IANA timezone string
 * @param formatStr - date-fns format string (default: "MMM d, yyyy h:mm a")
 * @returns Formatted date/time string in property's timezone
 */
export function formatPropertyDateTime(
  isoString: string | null | undefined,
  timezone: string | null | undefined,
  formatStr: string = "MMM d, yyyy h:mm a"
): string {
  if (!isoString) return "";
  const tz = timezone || DEFAULT_TIMEZONE;
  try {
    return formatInTimeZone(parseISO(isoString), tz, formatStr);
  } catch (error) {
    console.warn(`Error formatting datetime`, error);
    return "";
  }
}

/**
 * Formats a UTC timestamp for display in the property's timezone (date only).
 * 
 * @param isoString - ISO 8601 timestamp string (from database)
 * @param timezone - IANA timezone string
 * @param formatStr - date-fns format string (default: "MMM d, yyyy")
 * @returns Formatted date string in property's timezone
 */
export function formatPropertyDate(
  isoString: string | null | undefined,
  timezone: string | null | undefined,
  formatStr: string = "MMM d, yyyy"
): string {
  return formatPropertyDateTime(isoString, timezone, formatStr);
}

/**
 * For timestamp fields (created_at, updated_at, etc.), use parseISO from date-fns directly.
 * This is re-exported for convenience and documentation.
 */
export { parseISO as parseDateTime } from "date-fns";
