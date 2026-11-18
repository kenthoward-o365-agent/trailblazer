import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Trash2, Star } from "lucide-react";
import { PaymentCardForm } from "./PaymentCardForm";
import { MfaGuard } from "@/components/security/MfaGuard";

interface PaymentCard {
  id: string;
  cardholder_name: string;
  card_brand: string;
  last_four_digits: string;
  expiry_month: number;
  expiry_year: number;
  is_primary: boolean;
  created_at: string;
}

interface PaymentCardListProps {
  reservationId?: string;
  reservationGuestId?: string; // For multi-guest support - filter cards by guest
  ledgerAccountId?: string;
  propertyId?: string;
  compact?: boolean;
}

const getCardIcon = (brand: string) => {
  // Simple colored badges for different card types
  const colors: Record<string, string> = {
    Visa: "bg-blue-600",
    Mastercard: "bg-orange-500",
    Amex: "bg-blue-400",
    Discover: "bg-orange-400",
    Unknown: "bg-gray-500",
  };
  return colors[brand] || colors.Unknown;
};

export const PaymentCardList = (props: PaymentCardListProps) => {
  return (
    <MfaGuard resourceLabel="payment cards">
      <PaymentCardListInner {...props} />
    </MfaGuard>
  );
};

const PaymentCardListInner = ({
  reservationId,
  reservationGuestId,
  ledgerAccountId,
  propertyId,
  compact = false,
}: PaymentCardListProps) => {
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards();
  }, [reservationId, reservationGuestId, ledgerAccountId]);

  const loadCards = async () => {
    setLoading(true);

    let query = supabase
      .from("payment_cards")
      .select("*")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    // Priority: reservationGuestId > ledgerAccountId > reservationId
    if (reservationGuestId) {
      query = query.eq("reservation_guest_id", reservationGuestId);
    } else if (reservationId && ledgerAccountId) {
      query = query.or(`reservation_id.eq.${reservationId},ledger_account_id.eq.${ledgerAccountId}`);
    } else if (reservationId) {
      query = query.eq("reservation_id", reservationId);
    } else if (ledgerAccountId) {
      query = query.eq("ledger_account_id", ledgerAccountId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading cards:", error);
    } else {
      setCards(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (cardId: string) => {
    if (!confirm("Are you sure you want to remove this card?")) return;

    const { error } = await supabase
      .from("payment_cards")
      .delete()
      .eq("id", cardId);

    if (error) {
      toast.error("Failed to remove card");
    } else {
      toast.success("Card removed");
      loadCards();
    }
  };

  const handleSetPrimary = async (cardId: string) => {
    // First, unset all cards as primary
    if (reservationId) {
      await supabase
        .from("payment_cards")
        .update({ is_primary: false })
        .eq("reservation_id", reservationId);
    }
    if (ledgerAccountId) {
      await supabase
        .from("payment_cards")
        .update({ is_primary: false })
        .eq("ledger_account_id", ledgerAccountId);
    }

    // Set selected card as primary
    const { error } = await supabase
      .from("payment_cards")
      .update({ is_primary: true })
      .eq("id", cardId);

    if (error) {
      toast.error("Failed to update card");
    } else {
      toast.success("Primary card updated");
      loadCards();
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading cards...</p>;
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Payment Cards</span>
          <PaymentCardForm
            reservationId={reservationId}
            ledgerAccountId={ledgerAccountId}
            propertyId={propertyId}
            onCardAdded={loadCards}
          />
        </div>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cards on file</p>
        ) : (
          <div className="space-y-1">
            {cards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge className={`${getCardIcon(card.card_brand)} text-white text-xs`}>
                    {card.card_brand}
                  </Badge>
                  <span>•••• {card.last_four_digits}</span>
                  {card.is_primary && (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  )}
                </div>
                <span className="text-muted-foreground">
                  {card.expiry_month.toString().padStart(2, "0")}/{card.expiry_year}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Cards
        </h3>
        <PaymentCardForm
          reservationId={reservationId}
          ledgerAccountId={ledgerAccountId}
          propertyId={propertyId}
          onCardAdded={loadCards}
        />
      </div>

      {cards.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          No cards on file
        </p>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Badge className={`${getCardIcon(card.card_brand)} text-white`}>
                  {card.card_brand}
                </Badge>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">•••• {card.last_four_digits}</span>
                    {card.is_primary && (
                      <Badge variant="secondary" className="text-xs">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {card.cardholder_name} • Exp {card.expiry_month.toString().padStart(2, "0")}/{card.expiry_year}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!card.is_primary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetPrimary(card.id)}
                    title="Set as primary"
                  >
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(card.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
