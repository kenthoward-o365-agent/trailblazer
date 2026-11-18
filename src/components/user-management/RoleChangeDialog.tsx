import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RoleChangeDialogState } from "@/hooks/useUserManagementDialogs";

interface RoleChangeDialogProps {
  dialog: RoleChangeDialogState | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function RoleChangeDialog({ dialog, onClose, onConfirm }: RoleChangeDialogProps) {
  return (
    <AlertDialog
      open={dialog?.open}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to change {dialog?.userName}'s role to{" "}
            <strong>{dialog?.newRole}</strong>? This will immediately
            affect their permissions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
