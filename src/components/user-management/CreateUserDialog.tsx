import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NewUserForm, AppRole } from "@/hooks/useUserManagement";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: NewUserForm;
  onFormChange: (form: NewUserForm) => void;
  onSubmit: () => Promise<boolean>;
  creating: boolean;
  onReset: () => void;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  onSubmit,
  creating,
  onReset,
}: CreateUserDialogProps) {
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      onReset();
    }
  };

  const handleSubmit = async () => {
    const success = await onSubmit();
    if (success) {
      onOpenChange(false);
    }
  };

  const isFormValid = form.firstName && form.lastName && form.email && form.password;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => onFormChange({ ...form, firstName: e.target.value })}
                placeholder="First name"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => onFormChange({ ...form, lastName: e.target.value })}
                placeholder="Last name"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => onFormChange({ ...form, email: e.target.value })}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
              placeholder="+1 555 123 4567"
              maxLength={30}
            />
          </div>

          <div>
            <Label htmlFor="password">Temporary Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => onFormChange({ ...form, password: e.target.value })}
              placeholder="Minimum 6 characters"
            />
            <p className="text-xs text-muted-foreground mt-1">
              User can change this after first login
            </p>
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select 
              value={form.role} 
              onValueChange={(v) => onFormChange({ ...form, role: v as AppRole })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="front_desk">Front Desk</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleSubmit} 
            className="w-full"
            disabled={creating || !isFormValid}
          >
            {creating ? "Creating..." : "Create User"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
