import { useMemo } from "react";
import { format, eachDayOfInterval, parseISO, isWithinInterval, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Allocation {
  allocation_date: string;
  site_type_id: string | null;
  site_id: string | null;
  rooms_blocked: number;
}

interface GroupReservation {
  site_id: string | null;
  site_type_id: string | null;
  check_in_date: string;
  check_out_date: string;
}

interface SiteType {
  id: string;
  name: string;
}

interface Site {
  id: string;
  site_type_id: string;
}

interface GroupBlockAvailabilityGridProps {
  startDate: string;
  endDate: string;
  allocations: Allocation[];
  reservations: GroupReservation[];
  siteTypes: SiteType[];
  sites: Site[];
}

export const GroupBlockAvailabilityGrid = ({
  startDate,
  endDate,
  allocations,
  reservations,
  siteTypes,
  sites,
}: GroupBlockAvailabilityGridProps) => {
  // Generate date columns (nights in the group block)
  const dates = useMemo(() => {
    if (!startDate || !endDate) return [];
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      // Last checkout date is not a night, so subtract 1 day
      const lastNight = new Date(end);
      lastNight.setDate(lastNight.getDate() - 1);
      if (isBefore(lastNight, start)) return [];
      return eachDayOfInterval({ start, end: lastNight });
    } catch {
      return [];
    }
  }, [startDate, endDate]);

  // Create a map of site_id -> site_type_id for lookups
  const siteToTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((site) => {
      map.set(site.id, site.site_type_id);
    });
    return map;
  }, [sites]);

  // Determine which room types are blocked by this group
  const blockedSiteTypeIds = useMemo(() => {
    const typeIds = new Set<string>();
    allocations.forEach((alloc) => {
      if (alloc.site_type_id) {
        typeIds.add(alloc.site_type_id);
      } else if (alloc.site_id) {
        const typeId = siteToTypeMap.get(alloc.site_id);
        if (typeId) typeIds.add(typeId);
      }
    });
    return Array.from(typeIds);
  }, [allocations, siteToTypeMap]);

  // Filter to only room types that are blocked
  const relevantSiteTypes = useMemo(() => {
    return siteTypes.filter((st) => blockedSiteTypeIds.includes(st.id));
  }, [siteTypes, blockedSiteTypeIds]);

  // Calculate blocked count for a given date and room type
  const getBlockedCount = (date: Date, siteTypeId: string): number => {
    const dateStr = format(date, "yyyy-MM-dd");
    return allocations
      .filter((alloc) => alloc.allocation_date === dateStr)
      .filter((alloc) => {
        if (alloc.site_type_id === siteTypeId) return true;
        if (alloc.site_id) {
          return siteToTypeMap.get(alloc.site_id) === siteTypeId;
        }
        return false;
      })
      .reduce((sum, alloc) => sum + alloc.rooms_blocked, 0);
  };

  // Calculate booked count for a given date and room type
  const getBookedCount = (date: Date, siteTypeId: string): number => {
    const dateStr = format(date, "yyyy-MM-dd");
    return reservations.filter((res) => {
      // Check if this date is within the reservation stay (check_in <= date < check_out)
      const checkIn = parseISO(res.check_in_date);
      const checkOut = parseISO(res.check_out_date);
      const targetDate = parseISO(dateStr);
      
      // Date must be >= check_in and < check_out
      if (targetDate < checkIn || targetDate >= checkOut) return false;

      // Determine the room type of this reservation
      let resTypeId: string | null = res.site_type_id;
      if (!resTypeId && res.site_id) {
        resTypeId = siteToTypeMap.get(res.site_id) || null;
      }
      
      return resTypeId === siteTypeId;
    }).length;
  };

  // Calculate totals for a date
  const getTotals = (date: Date): { blocked: number; booked: number } => {
    let blocked = 0;
    let booked = 0;
    relevantSiteTypes.forEach((st) => {
      blocked += getBlockedCount(date, st.id);
      booked += getBookedCount(date, st.id);
    });
    return { blocked, booked };
  };

  // Calculate row totals for a specific room type across all dates
  const getRowTotals = (siteTypeId: string): { blocked: number; booked: number } => {
    let blocked = 0;
    let booked = 0;
    dates.forEach((date) => {
      blocked += getBlockedCount(date, siteTypeId);
      booked += getBookedCount(date, siteTypeId);
    });
    return { blocked, booked };
  };

  // Calculate grand total across all room types and all dates
  const getGrandTotals = (): { blocked: number; booked: number } => {
    let blocked = 0;
    let booked = 0;
    relevantSiteTypes.forEach((st) => {
      const rowTotals = getRowTotals(st.id);
      blocked += rowTotals.blocked;
      booked += rowTotals.booked;
    });
    return { blocked, booked };
  };

  // Get occupancy color class
  const getOccupancyColor = (percentage: number): string => {
    if (percentage <= 50) return "text-green-600 dark:text-green-400";
    if (percentage <= 80) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getOccupancyBgColor = (percentage: number): string => {
    if (percentage <= 50) return "bg-green-50 dark:bg-green-950/30";
    if (percentage <= 80) return "bg-amber-50 dark:bg-amber-950/30";
    return "bg-red-50 dark:bg-red-950/30";
  };

  if (!startDate || !endDate) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Set date range to see availability
      </div>
    );
  }

  if (dates.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Invalid date range
      </div>
    );
  }

  if (allocations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Add allocations to see occupancy
      </div>
    );
  }

  if (relevantSiteTypes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No room types found for allocations
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left p-1.5 border-b font-medium text-muted-foreground sticky left-0 bg-background min-w-[120px]">
                Room Type
              </th>
              {dates.map((date) => (
                <th
                  key={date.toISOString()}
                  className="text-center p-1 border-b font-medium text-muted-foreground min-w-[50px]"
                >
                  <div>{format(date, "EEE")}</div>
                  <div>{format(date, "M/d")}</div>
                </th>
              ))}
              <th className="text-center p-1 border-b font-medium text-muted-foreground min-w-[60px] sticky right-0 bg-muted/50">
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {relevantSiteTypes.map((siteType) => (
              <tr key={siteType.id}>
                <td className="p-1.5 border-b font-medium sticky left-0 bg-background">
                  {siteType.name}
                </td>
                {dates.map((date) => {
                  const blocked = getBlockedCount(date, siteType.id);
                  const booked = getBookedCount(date, siteType.id);
                  const percentage = blocked > 0 ? Math.round((booked / blocked) * 100) : 0;

                  if (blocked === 0) {
                    return (
                      <td
                        key={date.toISOString()}
                        className="text-center p-1 border-b text-muted-foreground"
                      >
                        -
                      </td>
                    );
                  }

                  return (
                    <td key={date.toISOString()} className="p-0.5 border-b">
                      <div
                        className={cn(
                          "text-center p-1 rounded cursor-default",
                          getOccupancyBgColor(percentage),
                          getOccupancyColor(percentage),
                          "font-semibold"
                        )}
                      >
                        <div>{booked}/{blocked}</div>
                        <div className="text-[10px]">{percentage}%</div>
                      </div>
                    </td>
                  );
                })}
                {/* Row total */}
                <td className="p-0.5 border-b sticky right-0 bg-muted/30">
                  {(() => {
                    const { blocked, booked } = getRowTotals(siteType.id);
                    const percentage = blocked > 0 ? Math.round((booked / blocked) * 100) : 0;
                    return (
                      <div
                        className={cn(
                          "text-center p-1 rounded font-semibold",
                          getOccupancyBgColor(percentage),
                          getOccupancyColor(percentage)
                        )}
                      >
                        <div>{booked}/{blocked}</div>
                        <div className="text-[10px]">{percentage}%</div>
                      </div>
                    );
                  })()}
                </td>
              </tr>
            ))}
            {/* Totals Row */}
            <tr className="font-semibold bg-muted/30">
              <td className="p-1.5 border-t-2 sticky left-0 bg-muted/30">
                TOTAL
              </td>
              {dates.map((date) => {
                const { blocked, booked } = getTotals(date);
                const percentage = blocked > 0 ? Math.round((booked / blocked) * 100) : 0;

                if (blocked === 0) {
                  return (
                    <td
                      key={date.toISOString()}
                      className="text-center p-1 border-t-2 text-muted-foreground"
                    >
                      -
                    </td>
                  );
                }

                return (
                  <td key={date.toISOString()} className="p-0.5 border-t-2">
                    <div
                      className={cn(
                        "text-center p-1 rounded cursor-default",
                        getOccupancyBgColor(percentage),
                        getOccupancyColor(percentage)
                      )}
                    >
                      <div>{booked}/{blocked}</div>
                      <div className="text-[10px]">{percentage}%</div>
                    </div>
                  </td>
                );
              })}
              {/* Grand total */}
              <td className="p-0.5 border-t-2 sticky right-0 bg-muted/50">
                {(() => {
                  const { blocked, booked } = getGrandTotals();
                  const percentage = blocked > 0 ? Math.round((booked / blocked) * 100) : 0;
                  return (
                    <div
                      className={cn(
                        "text-center p-1 rounded font-bold",
                        getOccupancyBgColor(percentage),
                        getOccupancyColor(percentage)
                      )}
                    >
                      <div>{booked}/{blocked}</div>
                      <div className="text-[10px]">{percentage}%</div>
                    </div>
                  );
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
};
