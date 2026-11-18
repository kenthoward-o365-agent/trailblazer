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
import type { DeleteAccessDialogState } from "@/hooks/useUserManagementDialogs";

interface RemoveAccessDialogProps {
  dialog: DeleteAccessDialogState | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveAccessDialog({ dialog, onClose, onConfirm }: RemoveAccessDialogProps) {
  return (
    <AlertDialog
      open={dialog?.open}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove User Access</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {dialog?.userName}'s access to this property?
            They will no longer be able to access this property.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove Access
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
