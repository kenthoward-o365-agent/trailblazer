import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, XCircle, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ConfirmationActionsProps {
  confirming: boolean;
  cancelling: boolean;
  canConfirm: boolean;
  isCardRequired: boolean;
  hasValidCard: boolean;
  hasDeposits: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationActions = ({
  confirming,
  cancelling,
  canConfirm,
  isCardRequired,
  hasValidCard,
  hasDeposits,
  onConfirm,
  onCancel,
}: ConfirmationActionsProps) => {
  return (
    <Card className="p-4">
      <div className="flex gap-2">
        {hasDeposits ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                disabled={cancelling || confirming} 
                className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
              >
                <AlertTriangle className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Deposit Already Recorded
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    An advance deposit payment has already been posted. 
                    Cancelling now will leave orphaned payment records.
                  </p>
                  <p className="font-medium text-foreground">
                    Please confirm instead, or contact a manager to process a refund.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Go Back</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirm} disabled={!canConfirm}>
                  Confirm Reservation
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={cancelling || confirming} 
            className="flex-1"
          >
            {cancelling ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <XCircle className="mr-1.5 h-4 w-4" />
                Cancel
              </>
            )}
          </Button>
        )}
        <Button 
          onClick={onConfirm} 
          disabled={confirming || cancelling || !canConfirm} 
          className="flex-1"
        >
          {confirming ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Confirming...
            </>
          ) : (
            "Confirm Reservation"
          )}
        </Button>
      </div>
      {isCardRequired && !hasValidCard && (
        <p className="text-xs text-destructive text-center mt-2">
          Please add a credit card to confirm
        </p>
      )}
      {hasDeposits && (
        <p className="text-xs text-amber-600 text-center mt-2 flex items-center justify-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Deposit on file - cancellation requires manager approval
        </p>
      )}
    </Card>
  );
};
