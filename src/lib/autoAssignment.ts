import { supabase } from "@/integrations/supabase/client";
import { logMultipleChanges, getCurrentUserInfo } from "@/lib/changeJournal";

interface AssignmentCandidate {
  reservationId: string;
  siteTypeId: string;
  checkIn: string;
  checkOut: string;
  currentSiteId: string | null;
  confirmationNumber: string;
  guestName: string;
}

interface RoomOccupancy {
  siteId: string;
  siteNumber: string;
  siteTypeId: string;
  occupiedDates: Set<string>;
}

interface AssignmentResult {
  reservationId: string;
  confirmationNumber: string;
  guestName: string;
  oldSiteNumber: string | null;
  newSiteNumber: string;
  newSiteId: string;
}

export interface AutoAssignmentResult {
  success: boolean;
  message: string;
  assignments: AssignmentResult[];
  skipped: number;
  errors: string[];
}

// Get all dates between check-in and check-out (exclusive of check-out)
function getDateRange(checkIn: string, checkOut: string): string[] {
  const dates: string[] = [];
  const current = new Date(checkIn);
  const end = new Date(checkOut);
  
  while (current < end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

// Calculate number of nights
function getNights(checkIn: string, checkOut: string): number {
  return getDateRange(checkIn, checkOut).length;
}

// Check if a room can accommodate the reservation dates
function canFitReservation(
  room: RoomOccupancy,
  checkIn: string,
  checkOut: string
): boolean {
  const dates = getDateRange(checkIn, checkOut);
  return dates.every(date => !room.occupiedDates.has(date));
}

// Score a potential assignment - higher is better
function scoreAssignment(
  room: RoomOccupancy,
  checkIn: string,
  checkOut: string,
  allRooms: RoomOccupancy[]
): number {
  let score = 0;
  const dates = getDateRange(checkIn, checkOut);
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  // Check day before check-in - does this connect to an existing booking?
  const dayBefore = new Date(checkInDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayBeforeStr = dayBefore.toISOString().split("T")[0];
  
  if (room.occupiedDates.has(dayBeforeStr)) {
    score += 10; // Fills a gap on arrival side
  }
  
  // Check day of check-out - does this connect to an existing booking?
  const checkOutStr = checkOut;
  if (room.occupiedDates.has(checkOutStr)) {
    score += 10; // Fills a gap on departure side
  }
  
  // Check if this would create 1-night gaps
  // Look at day after the reservation ends
  const dayAfter = new Date(checkOutDate);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const dayAfterStr = dayAfter.toISOString().split("T")[0];
  
  // If check-out day is free but day after is occupied, we'd create a 1-night gap
  if (!room.occupiedDates.has(checkOutStr) && room.occupiedDates.has(dayAfterStr)) {
    score -= 5;
  }
  
  // Check for 2-night gaps
  const twoDaysAfter = new Date(checkOutDate);
  twoDaysAfter.setDate(twoDaysAfter.getDate() + 2);
  const twoDaysAfterStr = twoDaysAfter.toISOString().split("T")[0];
  
  if (!room.occupiedDates.has(checkOutStr) && !room.occupiedDates.has(dayAfterStr) && room.occupiedDates.has(twoDaysAfterStr)) {
    score -= 3;
  }
  
  // Prefer rooms that are already being used (reduces fragmentation)
  if (room.occupiedDates.size > 0) {
    score += 2;
  }
  
  return score;
}

export async function runAutoAssignment(
  propertyId: string,
  startDate: string,
  endDate: string,
  previewOnly: boolean = false
): Promise<AutoAssignmentResult> {
  const errors: string[] = [];
  const assignments: AssignmentResult[] = [];
  let skipped = 0;

  try {
    // Campground PMS: floating inventory is not supported. Auto-assignment is disabled.
    return {
      success: false,
      message: "Auto-assignment is not available in this version.",
      assignments: [],
      skipped: 0,
      errors: [],
    };

    // 2. Get group blocks that are booked "by room number" (have site_id allocations)
    const { data: roomSpecificGroupBlocks } = await supabase
      .from("group_block_room_allocations")
      .select("group_block_id")
      .not("site_id", "is", null);

    const roomSpecificGroupBlockIds = new Set(
      (roomSpecificGroupBlocks || []).map(g => g.group_block_id)
    );

    // 3. Fetch moveable reservations (arrivals within date range)
    const { data: candidateReservations, error: resError } = await supabase
      .from("reservations")
      .select(`
        id, 
        site_type_id, 
        site_id, 
        check_in_date, 
        check_out_date, 
        confirmation_number, 
        assignment_locked,
        group_block_id,
        guests (first_name, last_name),
        sites (site_number)
      `)
      .eq("property_id", propertyId)
      .in("status", ["CONFIRMED", "CHECKED_IN"])
      .gte("check_in_date", startDate)
      .lte("check_in_date", endDate)
      .not("site_type_id", "is", null);

    if (resError) {
      return {
        success: false,
        message: "Failed to load reservations",
        assignments: [],
        skipped: 0,
        errors: [resError.message],
      };
    }

    // Filter out locked and room-specific group reservations
    const moveableReservations: AssignmentCandidate[] = [];
    
    for (const res of candidateReservations || []) {
      // Skip locked assignments
      if (res.assignment_locked) {
        skipped++;
        continue;
      }

      // Skip reservations in room-specific group blocks
      if (res.group_block_id && roomSpecificGroupBlockIds.has(res.group_block_id)) {
        skipped++;
        continue;
      }

      moveableReservations.push({
        reservationId: res.id,
        siteTypeId: res.site_type_id!,
        checkIn: res.check_in_date,
        checkOut: res.check_out_date,
        currentSiteId: res.site_id,
        confirmationNumber: res.confirmation_number || "",
        guestName: `${res.guests?.first_name || ""} ${res.guests?.last_name || ""}`.trim(),
      });
    }

    if (moveableReservations.length === 0) {
      return {
        success: true,
        message: skipped > 0 
          ? `No eligible reservations to assign. ${skipped} reservation(s) were skipped (locked or group-specific).`
          : "No reservations found in the selected date range.",
        assignments: [],
        skipped,
        errors: [],
      };
    }

    // 4. Get all active sites grouped by site type
    const siteTypeIds = [...new Set(moveableReservations.map(r => r.siteTypeId))];
    
    const { data: sites, error: sitesError } = await supabase
      .from("sites")
      .select("id, site_number, site_type_id")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .in("site_type_id", siteTypeIds);

    if (sitesError || !sites || sites.length === 0) {
      return {
        success: false,
        message: "No active rooms found for the room types",
        assignments: [],
        skipped,
        errors: [sitesError?.message || "No sites available"],
      };
    }

    // 5. Get ALL reservations that will occupy these sites during the relevant period
    // We need to look at a wider window to understand occupancy
    const earliestCheckIn = moveableReservations.reduce(
      (min, r) => r.checkIn < min ? r.checkIn : min,
      moveableReservations[0].checkIn
    );
    const latestCheckOut = moveableReservations.reduce(
      (max, r) => r.checkOut > max ? r.checkOut : max,
      moveableReservations[0].checkOut
    );

    // Extend window to see context
    const windowStart = new Date(earliestCheckIn);
    windowStart.setDate(windowStart.getDate() - 7);
    const windowEnd = new Date(latestCheckOut);
    windowEnd.setDate(windowEnd.getDate() + 7);

    const { data: allReservations } = await supabase
      .from("reservations")
      .select("id, site_id, check_in_date, check_out_date, assignment_locked, group_block_id")
      .eq("property_id", propertyId)
      .in("status", ["CONFIRMED", "CHECKED_IN"])
      .gte("check_out_date", windowStart.toISOString().split("T")[0])
      .lte("check_in_date", windowEnd.toISOString().split("T")[0])
      .not("site_id", "is", null);

    // Build occupancy map for each room (only from non-moveable reservations)
    const moveableIds = new Set(moveableReservations.map(r => r.reservationId));
    const roomOccupancy = new Map<string, RoomOccupancy>();

    for (const site of sites) {
      roomOccupancy.set(site.id, {
        siteId: site.id,
        siteNumber: site.site_number,
        siteTypeId: site.site_type_id,
        occupiedDates: new Set(),
      });
    }

    // Mark dates occupied by NON-moveable reservations
    for (const res of allReservations || []) {
      if (!res.site_id || moveableIds.has(res.id)) continue;

      // Check if this is a locked or group-specific reservation
      const isLocked = res.assignment_locked;
      const isGroupSpecific = res.group_block_id && roomSpecificGroupBlockIds.has(res.group_block_id);

      if (isLocked || isGroupSpecific || !moveableIds.has(res.id)) {
        const room = roomOccupancy.get(res.site_id);
        if (room) {
          const dates = getDateRange(res.check_in_date, res.check_out_date);
          dates.forEach(d => room.occupiedDates.add(d));
        }
      }
    }

    // 6. Sort reservations by length (longer stays first - harder to fit)
    moveableReservations.sort((a, b) => {
      const nightsA = getNights(a.checkIn, a.checkOut);
      const nightsB = getNights(b.checkIn, b.checkOut);
      return nightsB - nightsA;
    });

    // 7. Assign each reservation to best available room
    const pendingUpdates: { id: string; site_id: string }[] = [];
    const siteNumberMap = new Map(sites.map(s => [s.id, s.site_number]));
    const allRooms = Array.from(roomOccupancy.values());

    for (const reservation of moveableReservations) {
      // Get rooms of the same type
      const availableRooms = allRooms.filter(
        room => room.siteTypeId === reservation.siteTypeId && 
                canFitReservation(room, reservation.checkIn, reservation.checkOut)
      );

      if (availableRooms.length === 0) {
        errors.push(`No available room for reservation #${reservation.confirmationNumber}`);
        continue;
      }

      // Score each room and pick the best
      let bestRoom: RoomOccupancy | null = null;
      let bestScore = -Infinity;

      for (const room of availableRooms) {
        const score = scoreAssignment(room, reservation.checkIn, reservation.checkOut, allRooms);
        if (score > bestScore) {
          bestScore = score;
          bestRoom = room;
        }
      }

      if (!bestRoom) {
        errors.push(`Could not find suitable room for reservation #${reservation.confirmationNumber}`);
        continue;
      }

      // Only record if assignment changed
      if (bestRoom.siteId !== reservation.currentSiteId) {
        pendingUpdates.push({
          id: reservation.reservationId,
          site_id: bestRoom.siteId,
        });

        assignments.push({
          reservationId: reservation.reservationId,
          confirmationNumber: reservation.confirmationNumber,
          guestName: reservation.guestName,
          oldSiteNumber: reservation.currentSiteId ? siteNumberMap.get(reservation.currentSiteId) || null : null,
          newSiteNumber: bestRoom.siteNumber,
          newSiteId: bestRoom.siteId,
        });
      }

      // Mark this room as occupied for these dates (for subsequent assignments)
      const dates = getDateRange(reservation.checkIn, reservation.checkOut);
      dates.forEach(d => bestRoom!.occupiedDates.add(d));
    }

    // 8. Execute updates (only if not preview mode)
    if (previewOnly) {
      return {
        success: true,
        message: assignments.length > 0
          ? `Preview: ${assignments.length} reservation(s) would be reassigned.`
          : "No changes needed - all reservations are already optimally assigned.",
        assignments,
        skipped,
        errors,
      };
    }

    if (pendingUpdates.length > 0) {
      const changeLogEntries = [];

      for (const update of pendingUpdates) {
        const { error: updateError } = await supabase
          .from("reservations")
          .update({ site_id: update.site_id })
          .eq("id", update.id);

        if (updateError) {
          errors.push(`Failed to update reservation: ${updateError.message}`);
        } else {
          const assignment = assignments.find(a => a.reservationId === update.id);
          if (assignment) {
            changeLogEntries.push({
              propertyId,
              recordType: "reservation",
              recordId: update.id,
              recordIdentifier: `#${assignment.confirmationNumber}`,
              fieldName: "site_id (Auto-Assign)",
              oldValue: assignment.oldSiteNumber || "Unassigned",
              newValue: assignment.newSiteNumber,
            });
          }
        }
      }

      // Log changes
      if (changeLogEntries.length > 0) {
        await logMultipleChanges(changeLogEntries);
      }
    }

    const successCount = assignments.length - errors.filter(e => e.includes("Failed to update")).length;

    return {
      success: true,
      message: successCount > 0
        ? `Successfully reassigned ${successCount} reservation(s) to optimize room allocation.`
        : "No changes needed - all reservations are already optimally assigned.",
      assignments,
      skipped,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      message: "An unexpected error occurred during auto-assignment",
      assignments: [],
      skipped,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

export async function getEligibleReservationCount(
  propertyId: string,
  startDate: string,
  endDate: string
): Promise<{ count: number; skipped: number; isFloating: boolean }> {
  // Campground PMS: floating inventory is not supported.
  return { count: 0, skipped: 0, isFloating: false };
}

