import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Plus, Trash2, Edit } from "lucide-react";
import type { UserWithRole, AppRole } from "@/hooks/useUserManagement";

interface StaffRolesCardProps {
  users: UserWithRole[];
  loading: boolean;
  updating: string | null;
  currentUserId: string | null;
  canManageUsers: boolean;
  canChangeRoles: boolean;
  onRoleChange: (userId: string, userName: string, newRole: AppRole) => void;
  getRoleBadgeVariant: (role: AppRole | null) => "destructive" | "default" | "secondary" | "outline";
  onAddUser: () => void;
  onEditUser: (user: { userId: string; firstName: string; lastName: string; phone?: string | null }) => void;
  onDeleteUser: (userId: string, userName: string) => void;
}


export function StaffRolesCard({
  users,
  loading,
  updating,
  currentUserId,
  canManageUsers,
  canChangeRoles,
  onRoleChange,
  getRoleBadgeVariant,
  onAddUser,
  onEditUser,
  onDeleteUser,
}: StaffRolesCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Staff Members</h2>
          <Badge variant="secondary">{users.length} users</Badge>
        </div>
        {canManageUsers && (
          <Button size="sm" onClick={onAddUser}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading users...
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No staff members have access to this property. Click "Add User" to grant access.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Current Role</TableHead>
              {canChangeRoles && <TableHead>Change Role</TableHead>}
              {canManageUsers && <TableHead className="w-32">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div>
                    {user.first_name} {user.last_name}
                    {user.user_id === currentUserId && (
                      <Badge variant="outline" className="ml-2">You</Badge>
                    )}
                  </div>
                  {user.phone && (
                    <div className="text-xs text-muted-foreground mt-0.5">{user.phone}</div>
                  )}
                </TableCell>

                <TableCell>
                  <Badge variant={getRoleBadgeVariant(user.role)}>
                    {user.role || "No Role"}
                  </Badge>
                </TableCell>
                {canChangeRoles && (
                  <TableCell>
                    <Select
                      value={user.role || ""}
                      onValueChange={(value: AppRole) =>
                        onRoleChange(
                          user.user_id,
                          `${user.first_name} ${user.last_name}`,
                          value
                        )
                      }
                      disabled={updating === user.user_id}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="front_desk">Front Desk</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                {canManageUsers && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditUser({ 
                          userId: user.user_id, 
                          firstName: user.first_name, 
                          lastName: user.last_name,
                          phone: user.phone,
                        })}

                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {user.user_id !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteUser(
                            user.user_id, 
                            `${user.first_name} ${user.last_name}`
                          )}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
