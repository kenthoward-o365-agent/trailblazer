import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface Permissions {
  reservations: { view: boolean; create: boolean; edit: boolean; cancel: boolean };
  guests: { view: boolean; create: boolean; edit: boolean };
  accounting: { view_folios: boolean; post_charges: boolean; view_reports: boolean; manage_chart: boolean };
  rates: { view: boolean; manage: boolean };
  site_maintenance: { view: boolean; manage: boolean };
  booking_engine: { view: boolean; manage: boolean };
  pos: { view: boolean; operate: boolean; manage: boolean };
  settings: { view: boolean; manage: boolean };
  users: { view: boolean; manage: boolean };
}

export const DEFAULT_PERMISSIONS: Permissions = {
  reservations: { view: false, create: false, edit: false, cancel: false },
  guests: { view: false, create: false, edit: false },
  accounting: { view_folios: false, post_charges: false, view_reports: false, manage_chart: false },
  rates: { view: false, manage: false },
  site_maintenance: { view: false, manage: false },
  booking_engine: { view: false, manage: false },
  pos: { view: false, operate: false, manage: false },
  settings: { view: false, manage: false },
  users: { view: false, manage: false },
};

/**
 * Merge stored permissions with defaults so newly-added categories/keys are
 * populated for older custom_roles rows. Also migrates the legacy
 * `housekeeping` key to `site_maintenance` (campground terminology).
 */
export function mergePermissions(stored: any): Permissions {
  const merged: any = { ...DEFAULT_PERMISSIONS };
  if (!stored || typeof stored !== "object") return merged;

  // Legacy migration: housekeeping -> site_maintenance
  if (stored.housekeeping && !stored.site_maintenance) {
    stored = { ...stored, site_maintenance: stored.housekeeping };
  }

  for (const category of Object.keys(DEFAULT_PERMISSIONS) as (keyof Permissions)[]) {
    merged[category] = {
      ...(DEFAULT_PERMISSIONS as any)[category],
      ...((stored as any)[category] || {}),
    };
  }
  return merged as Permissions;
}

interface PermissionGridProps {
  permissions: Permissions;
  onChange: (permissions: Permissions) => void;
  disabled?: boolean;
}

const PERMISSION_LABELS: Record<string, Record<string, string>> = {
  reservations: { view: "View", create: "Create", edit: "Edit", cancel: "Cancel" },
  guests: { view: "View", create: "Create", edit: "Edit" },
  accounting: { view_folios: "View Folios", post_charges: "Post Charges", view_reports: "View Reports", manage_chart: "Manage Chart" },
  rates: { view: "View", manage: "Manage" },
  site_maintenance: { view: "View", manage: "Manage" },
  booking_engine: { view: "View", manage: "Manage" },
  pos: { view: "View", operate: "Operate Terminal", manage: "Manage Menu & Settings" },
  settings: { view: "View", manage: "Manage" },
  users: { view: "View", manage: "Manage" },
};

const CATEGORY_LABELS: Record<string, string> = {
  reservations: "Reservations",
  guests: "Guests",
  accounting: "Accounting",
  rates: "Rates & Seasons",
  site_maintenance: "Site Maintenance",
  booking_engine: "Booking Engine",
  pos: "Point of Sale",
  settings: "Property Settings",
  users: "Users & Roles",
};

export function PermissionGrid({ permissions, onChange, disabled }: PermissionGridProps) {
  const handlePermissionChange = (category: keyof Permissions, permission: string, checked: boolean) => {
    const updatedPermissions = {
      ...permissions,
      [category]: {
        ...permissions[category],
        [permission]: checked,
      },
    };
    onChange(updatedPermissions);
  };

  return (
    <div className="grid gap-4">
      {Object.entries(permissions).map(([category, perms]) => (
        <div key={category} className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">{CATEGORY_LABELS[category] ?? category}</h4>
          <div className="flex flex-wrap gap-4">
            {Object.entries(perms).map(([perm, value]) => (
              <div key={perm} className="flex items-center gap-2">
                <Checkbox
                  id={`${category}-${perm}`}
                  checked={value as boolean}
                  onCheckedChange={(checked) =>
                    handlePermissionChange(category as keyof Permissions, perm, checked as boolean)
                  }
                  disabled={disabled}
                />
                <Label htmlFor={`${category}-${perm}`} className="text-sm cursor-pointer">
                  {PERMISSION_LABELS[category]?.[perm] || perm}
                </Label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
