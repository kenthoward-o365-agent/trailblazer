import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFolioTransfer } from "@/hooks/useFolioTransfer";
import { useReservationGuests, ReservationGuest } from "@/hooks/useReservationGuests";
import { useAuditDate } from "@/contexts/AuditDateContext";
import { ArrowRightLeft, Loader2 } from "lucide-react";

interface FolioTransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string;
  sourceLedgerAccountId: string;
  sourceGuestName: string;
  postingId?: string;
  postingAmount?: number;
  postingDescription?: string;
  onTransferComplete?: () => void;
}

export function FolioTransferDialog({
  isOpen,
  onClose,
  reservationId,
  sourceLedgerAccountId,
  sourceGuestName,
  postingId,
  postingAmount,
  postingDescription,
  onTransferComplete,
}: FolioTransferDialogProps) {
  const { reservationGuests } = useReservationGuests({ reservationId });
  const { transferPosting, transferAmountBetweenFolios, isTransferring } = useFolioTransfer();
  const { auditDate } = useAuditDate();

  const [selectedDestinationGuestId, setSelectedDestinationGuestId] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>(postingAmount?.toFixed(2) || "");
  const [transferNote, setTransferNote] = useState<string>(postingDescription || "");

  // Filter out the source guest from destination options
  const destinationGuests = reservationGuests.filter(
    (rg) => rg.ledger_account?.id && rg.ledger_account.id !== sourceLedgerAccountId
  );

  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) return;

    const destinationGuest = destinationGuests.find(g => g.id === selectedDestinationGuestId);
    if (!destinationGuest?.ledger_account?.id) return;

    let result;
    if (postingId) {
      // Transfer a specific posting
      result = await transferPosting({
        sourcePostingId: postingId,
        sourceLedgerAccountId,
        destinationLedgerAccountId: destinationGuest.ledger_account.id,
        amount,
        transferNote,
        auditDate: auditDate || new Date().toISOString().split('T')[0],
      });
    } else {
      // Transfer an arbitrary amount
      result = await transferAmountBetweenFolios({
        sourceLedgerAccountId,
        destinationLedgerAccountId: destinationGuest.ledger_account.id,
        amount,
        description: transferNote || "Balance transfer",
        auditDate: auditDate || new Date().toISOString().split('T')[0],
      });
    }

    if (result.success) {
      onTransferComplete?.();
      onClose();
    }
  };

  const maxAmount = postingAmount || Infinity;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer to Guest Folio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-md text-sm">
            <p>
              <span className="text-muted-foreground">From:</span>{" "}
              <span className="font-medium">{sourceGuestName}'s Folio</span>
            </p>
            {postingDescription && (
              <p className="mt-1 text-muted-foreground text-xs">
                Charge: {postingDescription}
              </p>
            )}
          </div>

          <div>
            <Label>Transfer To</Label>
            <Select
              value={selectedDestinationGuestId}
              onValueChange={setSelectedDestinationGuestId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select guest folio" />
              </SelectTrigger>
              <SelectContent>
                {destinationGuests.map((rg) => (
                  <SelectItem key={rg.id} value={rg.id}>
                    Folio {rg.folio_number}: {rg.guest?.first_name} {rg.guest?.last_name}
                    {rg.ledger_account && (
                      <span className="ml-2 text-muted-foreground">
                        (${rg.ledger_account.balance.toFixed(2)})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {destinationGuests.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                No other guest folios available. Add more guests to enable transfers.
              </p>
            )}
          </div>

          <div>
            <Label>Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={maxAmount}
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="pl-7"
              />
            </div>
            {postingAmount && (
              <p className="text-xs text-muted-foreground mt-1">
                Max: ${postingAmount.toFixed(2)}
              </p>
            )}
          </div>

          <div>
            <Label>Note (optional)</Label>
            <Input
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="Reason for transfer"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={
              isTransferring ||
              !selectedDestinationGuestId ||
              !transferAmount ||
              parseFloat(transferAmount) <= 0 ||
              (postingAmount && parseFloat(transferAmount) > postingAmount)
            }
          >
            {isTransferring ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowRightLeft className="h-4 w-4 mr-2" />
            )}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
