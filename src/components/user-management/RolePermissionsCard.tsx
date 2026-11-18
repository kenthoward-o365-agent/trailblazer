import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function RolePermissionsCard() {
  return (
    <Card className="p-6 bg-muted/50">
      <h3 className="font-semibold mb-2">Role Permissions</h3>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div>
          <Badge variant="destructive" className="mb-2">Admin</Badge>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Full system access</li>
            <li>• Manage user roles</li>
            <li>• All accounting functions</li>
            <li>• Configure OTA connections</li>
          </ul>
        </div>
        <div>
          <Badge variant="default" className="mb-2">Manager</Badge>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Manage rates and sites</li>
            <li>• View and post journal entries</li>
            <li>• Manage chart of accounts</li>
            <li>• View all reports</li>
          </ul>
        </div>
        <div>
          <Badge variant="secondary" className="mb-2">Front Desk</Badge>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Create reservations</li>
            <li>• Check-in/check-out guests</li>
            <li>• Post charges to ledgers</li>
            <li>• View basic reports</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
