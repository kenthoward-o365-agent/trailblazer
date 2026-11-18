import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, CreditCard } from "lucide-react";
import { PaymentCardForm } from "@/components/PaymentCardForm";
import type { GuaranteeOption, PaymentCard } from "@/hooks/useConfirmation";

interface PaymentDetailsCardProps {
  reservationId: string;
  guaranteeOptions: GuaranteeOption[];
  selectedGuarantee: string;
  setSelectedGuarantee: (value: string) => void;
  paymentCards: PaymentCard[];
  isCardRequired: boolean;
  onCardAdded: () => void;
  getCardIcon: (brand: string) => string;
}

export const PaymentDetailsCard = ({
  reservationId,
  guaranteeOptions,
  selectedGuarantee,
  setSelectedGuarantee,
  paymentCards,
  isCardRequired,
  onCardAdded,
  getCardIcon,
}: PaymentDetailsCardProps) => {
  if (guaranteeOptions.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="h-4 w-4 text-primary" />
        <h3 className="text-base font-semibold">Payment Details</h3>
      </div>
      
      <div className="space-y-3">
        <div>
          <Label className="text-sm">Guarantee Option</Label>
          <Select value={selectedGuarantee} onValueChange={setSelectedGuarantee}>
            <SelectTrigger className="mt-1 h-9">
              <SelectValue placeholder="Select guarantee option" />
            </SelectTrigger>
            <SelectContent className="bg-background">
              {guaranteeOptions.map((option) => (
                <SelectItem key={option.id} value={option.code}>
                  {option.code} - {option.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isCardRequired && (
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Credit Card Required</span>
              </div>
              <PaymentCardForm
                reservationId={reservationId}
                onCardAdded={onCardAdded}
              />
            </div>
            
            {paymentCards.length === 0 ? (
              <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-xs text-destructive">
                  A credit card must be added to continue.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {paymentCards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={`${getCardIcon(card.card_brand)} text-white text-xs px-1.5 py-0`}>
                        {card.card_brand}
                      </Badge>
                      <div>
                        <span className="text-sm font-medium">•••• {card.last_four_digits}</span>
                        <p className="text-xs text-muted-foreground">
                          {card.cardholder_name} • {card.expiry_month.toString().padStart(2, "0")}/{card.expiry_year}
                        </p>
                      </div>
                    </div>
                    {card.is_primary && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">Primary</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
