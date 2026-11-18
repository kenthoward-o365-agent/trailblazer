import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";
import { useProperty } from "@/contexts/PropertyContext";
import { getPropertyTodayString, parseLocalDate as parseLocalDateUtil } from "@/lib/dateUtils";

interface AuditDateContextType {
  auditDate: string;
  calendarDate: string;
  isAuditDateBehind: boolean;
  daysBehind: number;
  loading: boolean;
  propertyTimezone: string | null;
  refreshAuditDate: () => Promise<void>;
  advanceAuditDate: () => Promise<boolean>;
}

const AuditDateContext = createContext<AuditDateContextType | undefined>(undefined);

// Parse a date string as local date (not UTC)
const parseLocalDate = (dateStr: string): Date => {
  const parsed = parseLocalDateUtil(dateStr);
  return parsed || new Date();
};

export const AuditDateProvider = ({ children }: { children: ReactNode }) => {
  const { selectedProperty, loading: propertyLoading } = useProperty();
  const [auditDate, setAuditDate] = useState<string>("");
  // Initialize with property timezone when available
  const propertyTimezone = selectedProperty?.timezone || null;
  const [calendarDate, setCalendarDate] = useState<string>(
    getPropertyTodayString(propertyTimezone)
  );
  const [loading, setLoading] = useState(true);

  // Update calendar date when property timezone changes or periodically
  useEffect(() => {
    // Immediately update calendar date when timezone changes
    const newDate = getPropertyTodayString(propertyTimezone);
    if (newDate !== calendarDate) {
      setCalendarDate(newDate);
    }

    const checkDate = () => {
      const updatedDate = getPropertyTodayString(propertyTimezone);
      if (updatedDate !== calendarDate) {
        setCalendarDate(updatedDate);
      }
    };
    
    // Check every minute
    const interval = setInterval(checkDate, 60000);
    return () => clearInterval(interval);
  }, [propertyTimezone, calendarDate]);

  const refreshAuditDate = async () => {
    if (!selectedProperty) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("properties")
        .select("audit_date")
        .eq("id", selectedProperty.id)
        .single();

      if (error) throw error;
      
      // Use property timezone for determining "today"
      const currentCalendarDate = getPropertyTodayString(propertyTimezone);
      
      // If audit_date is null, initialize it to today in property's timezone
      if (!data.audit_date) {
        await supabase
          .from("properties")
          .update({ audit_date: currentCalendarDate })
          .eq("id", selectedProperty.id);
        setAuditDate(currentCalendarDate);
      } else {
        setAuditDate(data.audit_date);
      }
    } catch (error) {
      console.error("Error loading audit date:", error);
      // Fallback to property timezone calendar date if there's an error
      setAuditDate(getPropertyTodayString(propertyTimezone));
    } finally {
      setLoading(false);
    }
  };

  const advanceAuditDate = async (): Promise<boolean> => {
    if (!selectedProperty) return false;

    try {
      // Parse audit date as local and add one day
      const currentAuditDate = parseLocalDate(auditDate);
      const nextDate = addDays(currentAuditDate, 1);
      const nextDateStr = format(nextDate, "yyyy-MM-dd");
      
      const { error } = await supabase
        .from("properties")
        .update({ audit_date: nextDateStr })
        .eq("id", selectedProperty.id);

      if (error) throw error;
      
      setAuditDate(nextDateStr);
      return true;
    } catch (error) {
      console.error("Error advancing audit date:", error);
      return false;
    }
  };

  // Refresh audit date when selected property changes
  useEffect(() => {
    if (!propertyLoading && selectedProperty) {
      setLoading(true);
      refreshAuditDate();
    }
  }, [selectedProperty?.id, propertyLoading]);

  // Calculate days behind using local date parsing
  const auditDateLocal = auditDate ? parseLocalDate(auditDate) : new Date();
  const calendarDateLocal = parseLocalDate(calendarDate);
  const daysBehind = Math.floor(
    (calendarDateLocal.getTime() - auditDateLocal.getTime()) / (1000 * 60 * 60 * 24)
  );
  const isAuditDateBehind = daysBehind > 0;

  return (
    <AuditDateContext.Provider
      value={{
        auditDate,
        calendarDate,
        isAuditDateBehind,
        daysBehind,
        loading: loading || propertyLoading,
        propertyTimezone,
        refreshAuditDate,
        advanceAuditDate,
      }}
    >
      {children}
    </AuditDateContext.Provider>
  );
};

export const useAuditDate = () => {
  const context = useContext(AuditDateContext);
  if (context === undefined) {
    throw new Error("useAuditDate must be used within an AuditDateProvider");
  }
  return context;
};
