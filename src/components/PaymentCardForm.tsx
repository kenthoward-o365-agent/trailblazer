import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreditCard, Plus } from "lucide-react";
import { AdyenCardCapture } from "@/components/payments/AdyenCardCapture";

interface PaymentCardFormProps {
  reservationId?: string;
  ledgerAccountId?: string;
  propertyId?: string;
  guestId?: string;
  onCardAdded: () => void;
}

/**
 * PCI SAQ A card entry. This is a thin wrapper around the Adyen-hosted
 * Drop-in — PAN + CVV never enter our DOM or our servers. Historically this
 * component collected raw card data; that path has been removed for PCI
 * compliance.
 */
export const PaymentCardForm = ({
  reservationId,
  ledgerAccountId,
  propertyId,
  guestId,
  onCardAdded,
}: PaymentCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Add Card
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Add Payment Card
            </DialogTitle>
          </DialogHeader>

          {propertyId ? (
            <AdyenCardCapture
              propertyId={propertyId}
              reservationId={reservationId}
              ledgerAccountId={ledgerAccountId}
              guestId={guestId}
              mode="tokenize"
              onSuccess={() => {
                setIsOpen(false);
                onCardAdded();
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              A property must be selected before adding a card.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
