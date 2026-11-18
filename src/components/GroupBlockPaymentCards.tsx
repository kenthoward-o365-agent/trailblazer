import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Plus, Star, Trash2 } from "lucide-react";

interface PaymentCard {
  id: string;
  cardholder_name: string;
  card_brand: string;
  last_four_digits: string;
  expiry_month: number;
  expiry_year: number;
  is_primary: boolean;
}

interface GroupBlockPaymentCardsProps {
  groupBlockId: string;
  propertyId: string;
  onCardsChanged?: () => void;
}

const detectCardBrand = (cardNumber: string): string => {
  const cleaned = cardNumber.replace(/\s/g, "");
  if (/^4/.test(cleaned)) return "Visa";
  if (/^5[1-5]/.test(cleaned)) return "Mastercard";
  if (/^3[47]/.test(cleaned)) return "Amex";
  if (/^6(?:011|5)/.test(cleaned)) return "Discover";
  return "Unknown";
};

const formatCardNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, "").slice(0, 16);
  const groups = cleaned.match(/.{1,4}/g);
  return groups ? groups.join(" ") : cleaned;
};

export function GroupBlockPaymentCards({
  groupBlockId,
  propertyId,
  onCardsChanged,
}: GroupBlockPaymentCardsProps) {
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");

  useEffect(() => {
    loadCards();
  }, [groupBlockId]);

  const loadCards = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("group_block_payment_cards")
      .select(`
        id,
        is_primary,
        payment_card_id,
        payment_cards (
          id,
          cardholder_name,
          card_brand,
          last_four_digits,
          expiry_month,
          expiry_year
        )
      `)
      .eq("group_block_id", groupBlockId);

    if (error) {
      console.error("Error loading cards:", error);
    } else if (data) {
      setCards(
        data.map((item: any) => ({
          id: item.payment_card_id,
          cardholder_name: item.payment_cards.cardholder_name,
          card_brand: item.payment_cards.card_brand,
          last_four_digits: item.payment_cards.last_four_digits,
          expiry_month: item.payment_cards.expiry_month,
          expiry_year: item.payment_cards.expiry_year,
          is_primary: item.is_primary,
        }))
      );
    }
    setLoading(false);
  };

  const handleCardNumberChange = (value: string) => {
    setCardNumber(formatCardNumber(value));
  };

  const handleSaveCard = async () => {
    const cleanedNumber = cardNumber.replace(/\s/g, "");

    if (cleanedNumber.length < 13 || cleanedNumber.length > 16) {
      toast.error("Please enter a valid card number");
      return;
    }

    if (!cardholderName.trim()) {
      toast.error("Please enter the cardholder name");
      return;
    }

    if (!expiryMonth || !expiryYear) {
      toast.error("Please select the expiry date");
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`
        : "Staff";

      const cardBrand = detectCardBrand(cleanedNumber);
      const lastFour = cleanedNumber.slice(-4);

      // Create the payment card
      const { data: cardData, error: cardError } = await supabase
        .from("payment_cards")
        .insert({
          property_id: propertyId,
          cardholder_name: cardholderName.trim(),
          card_brand: cardBrand,
          last_four_digits: lastFour,
          expiry_month: parseInt(expiryMonth),
          expiry_year: parseInt(expiryYear),
          is_primary: cards.length === 0,
          created_by: user?.id,
          created_by_name: staffName,
        })
        .select()
        .single();

      if (cardError) {
        console.error("Error saving card:", cardError);
        toast.error("Failed to save card");
        setSaving(false);
        return;
      }

      // Link to group block via junction table
      const { error: linkError } = await supabase
        .from("group_block_payment_cards")
        .insert({
          group_block_id: groupBlockId,
          payment_card_id: cardData.id,
          is_primary: cards.length === 0,
        });

      if (linkError) {
        console.error("Error linking card:", linkError);
        toast.error("Failed to link card to group");
        setSaving(false);
        return;
      }

      toast.success("Card added successfully");
      setIsOpen(false);
      resetForm();
      loadCards();
      onCardsChanged?.();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to save card");
    }

    setSaving(false);
  };

  const handleSetPrimary = async (cardId: string) => {
    // Update all cards for this group to not primary
    const { error: clearError } = await supabase
      .from("group_block_payment_cards")
      .update({ is_primary: false })
      .eq("group_block_id", groupBlockId);

    if (clearError) {
      toast.error("Failed to update primary card");
      return;
    }

    // Set the selected card as primary
    const { error: setError } = await supabase
      .from("group_block_payment_cards")
      .update({ is_primary: true })
      .eq("group_block_id", groupBlockId)
      .eq("payment_card_id", cardId);

    if (setError) {
      toast.error("Failed to set primary card");
      return;
    }

    toast.success("Primary card updated");
    loadCards();
  };

  const handleDeleteCard = async (cardId: string) => {
    // Remove from junction table
    const { error: unlinkError } = await supabase
      .from("group_block_payment_cards")
      .delete()
      .eq("group_block_id", groupBlockId)
      .eq("payment_card_id", cardId);

    if (unlinkError) {
      toast.error("Failed to remove card");
      return;
    }

    toast.success("Card removed");
    loadCards();
    onCardsChanged?.();
  };

  const resetForm = () => {
    setCardNumber("");
    setCardholderName("");
    setExpiryMonth("");
    setExpiryYear("");
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const detectedBrand = detectCardBrand(cardNumber);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Cards
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Card
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading cards...</p>
        ) : cards.length === 0 ? (
          <p className="text-muted-foreground text-sm">No payment cards on file.</p>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {card.card_brand} •••• {card.last_four_digits}
                      {card.is_primary && (
                        <span className="ml-2 text-xs text-primary">(Primary)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {card.cardholder_name} • Exp {card.expiry_month.toString().padStart(2, "0")}/
                      {card.expiry_year}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {!card.is_primary && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSetPrimary(card.id)}
                      title="Set as primary"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Remove card">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Card?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the card from this group block. The card data will be
                          retained for audit purposes.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteCard(card.id)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Add Payment Card
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Card Number *</Label>
              <div className="relative">
                <Input
                  value={cardNumber}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                />
                {detectedBrand !== "Unknown" && (
                  <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">
                    {detectedBrand}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Only the last 4 digits will be stored
              </p>
            </div>

            <div>
              <Label>Cardholder Name *</Label>
              <Input
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
                placeholder="NAME ON CARD"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Expiry Month *</Label>
                <Select value={expiryMonth} onValueChange={setExpiryMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {month.toString().padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expiry Year *</Label>
                <Select value={expiryYear} onValueChange={setExpiryYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="YYYY" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCard} disabled={saving}>
              {saving ? "Saving..." : "Save Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
