import { supabase } from "@/integrations/supabase/client";
import { isInAdminAccessMode, getAdminAccessUserName } from "@/hooks/useAdminAccess";

export interface ChangeLogParams {
  propertyId: string;
  recordType: "reservation" | "housekeeping";
  recordId: string;
  recordIdentifier: string; // confirmation_number or site_number
  fieldName: string;
  oldValue: string | number | null | undefined;
  newValue: string | number | null | undefined;
  userId?: string;
  userName?: string;
}

export async function logChange({
  propertyId,
  recordType,
  recordId,
  recordIdentifier,
  fieldName,
  oldValue,
  newValue,
  userId,
  userName,
}: ChangeLogParams): Promise<void> {
  // Only log if value actually changed
  const oldStr = oldValue != null ? String(oldValue) : null;
  const newStr = newValue != null ? String(newValue) : null;
  
  if (oldStr === newStr) return;

  try {
    await supabase.from("change_journal").insert({
      property_id: propertyId,
      record_type: recordType,
      record_id: recordId,
      record_identifier: recordIdentifier,
      field_name: fieldName,
      old_value: oldStr,
      new_value: newStr,
      changed_by: userId || null,
      changed_by_name: userName || null,
    });
  } catch (error) {
    // Log but don't throw - change journal should never block operations
    console.error("Failed to log change:", error);
  }
}

export async function logMultipleChanges(
  changes: ChangeLogParams[]
): Promise<void> {
  const validChanges = changes.filter((c) => {
    const oldStr = c.oldValue != null ? String(c.oldValue) : null;
    const newStr = c.newValue != null ? String(c.newValue) : null;
    return oldStr !== newStr;
  });

  if (validChanges.length === 0) return;

  try {
    const inserts = validChanges.map((c) => ({
      property_id: c.propertyId,
      record_type: c.recordType,
      record_id: c.recordId,
      record_identifier: c.recordIdentifier,
      field_name: c.fieldName,
      old_value: c.oldValue != null ? String(c.oldValue) : null,
      new_value: c.newValue != null ? String(c.newValue) : null,
      changed_by: c.userId || null,
      changed_by_name: c.userName || null,
    }));

    await supabase.from("change_journal").insert(inserts);
  } catch (error) {
    console.error("Failed to log changes:", error);
  }
}

// Helper to get current user info for logging
// This automatically prefixes with "roomMaster Admin" when in admin access mode
export async function getCurrentUserInfo(): Promise<{ userId?: string; userName?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  
  // Check if in admin access mode
  const isAdminAccess = isInAdminAccessMode();
  const adminUserName = getAdminAccessUserName();
  
  const regularName = user.user_metadata?.first_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
    : user.email || "Unknown";
  
  // If in admin access mode, prefix with "roomMaster Admin"
  const userName = isAdminAccess && adminUserName
    ? `roomMaster Admin (${adminUserName})`
    : regularName;
    
  return { userId: user.id, userName };
}
