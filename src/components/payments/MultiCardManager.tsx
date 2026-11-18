import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Star, 
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentService } from "./PaymentService";
import { AdyenCardCapture } from "./AdyenCardCapture";
import type { PaymentCard } from "./types";
import { toast } from "sonner";

interface MultiCardManagerProps {
  propertyId: string;
  reservationId?: string;
  ledgerAccountId?: string;
  guestId?: string;
  maxCards?: number;
  compact?: boolean;
  onCardsChanged?: () => void;
}

import { MfaGuard } from "@/components/security/MfaGuard";

export function MultiCardManager(props: MultiCardManagerProps) {
  return (
    <MfaGuard resourceLabel="payment cards">
      <MultiCardManagerInner {...props} />
    </MfaGuard>
  );
}

function MultiCardManagerInner({
  propertyId,
  reservationId,
  ledgerAccountId,
  guestId,
  maxCards = 4,
  compact = false,
  onCardsChanged,
}: MultiCardManagerProps) {
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<number>(1);

  useEffect(() => {
    loadCards();
  }, [reservationId, ledgerAccountId, propertyId]);

  const loadCards = async () => {
    try {
      setIsLoading(true);
      const fetchedCards = await PaymentService.getCards({
        reservationId,
        ledgerAccountId,
        propertyId: !reservationId && !ledgerAccountId ? propertyId : undefined,
      });
      setCards(fetchedCards);
    } catch (err) {
      console.error('Failed to load cards:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCard = () => {
    // Find next available sequence
    const usedSequences = cards.map(c => c.cardSequence);
    for (let i = 1; i <= maxCards; i++) {
      if (!usedSequences.includes(i)) {
        setSelectedSequence(i);
        break;
      }
    }
    setShowAddCard(true);
  };

  const handleCardAdded = () => {
    setShowAddCard(false);
    loadCards();
    onCardsChanged?.();
  };

  const handleDeleteCard = async () => {
    if (!cardToDelete) return;

    const result = await PaymentService.deleteCard(cardToDelete);
    if (result.success) {
      toast.success("Card removed");
      loadCards();
      onCardsChanged?.();
    } else {
      toast.error(result.error || "Failed to remove card");
    }
    setCardToDelete(null);
  };

  const handleSetPrimary = async (cardId: string) => {
    if (!reservationId) return;

    const result = await PaymentService.setPrimaryCard(cardId, reservationId);
    if (result.success) {
      toast.success("Primary card updated");
      loadCards();
      onCardsChanged?.();
    } else {
      toast.error(result.error || "Failed to update primary card");
    }
  };

  const getCardBrandDisplay = (brand: string) => {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return <span className="text-blue-600 font-bold text-xs">VISA</span>;
      case 'mastercard':
        return <span className="text-red-600 font-bold text-xs">MC</span>;
      case 'amex':
        return <span className="text-blue-800 font-bold text-xs">AMEX</span>;
      case 'discover':
        return <span className="text-orange-600 font-bold text-xs">DISC</span>;
      default:
        return <CreditCard className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTokenStatusBadge = (status: string, isMock: boolean) => {
    if (isMock) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
          Mock
        </Badge>
      );
    }
    switch (status) {
      case 'active':
        return (
          <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="text-red-600 border-red-300 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const canAddMore = cards.length < maxCards;

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        Loading cards...
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {cards.map((card) => (
          <div 
            key={card.id} 
            className="flex items-center justify-between p-2 border rounded-md bg-background"
          >
            <div className="flex items-center gap-2">
              {getCardBrandDisplay(card.cardBrand)}
              <span className="text-sm">•••• {card.lastFourDigits}</span>
              {card.isPrimary && (
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {getTokenStatusBadge(card.tokenStatus, card.isMock)}
            </div>
          </div>
        ))}
        
        {canAddMore && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAddCard}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Card
          </Button>
        )}

        {/* Add Card Dialog */}
        <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Payment Card (Card {selectedSequence})</DialogTitle>
            </DialogHeader>
            <AdyenCardCapture
              propertyId={propertyId}
              reservationId={reservationId}
              ledgerAccountId={ledgerAccountId}
              guestId={guestId}
              cardSequence={selectedSequence}
              mode="tokenize"
              onSuccess={handleCardAdded}
              onCancel={() => setShowAddCard(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Cards
            <Badge variant="secondary" className="text-xs">
              {cards.length}/{maxCards}
            </Badge>
          </CardTitle>
          {canAddMore && (
            <Button variant="outline" size="sm" onClick={handleAddCard}>
              <Plus className="h-4 w-4 mr-1" />
              Add Card
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No cards on file</p>
            {canAddMore && (
              <Button 
                variant="link" 
                size="sm" 
                onClick={handleAddCard}
                className="mt-2"
              >
                Add a payment card
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => (
              <div 
                key={card.id} 
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border">
                    <span className="text-xs font-bold text-muted-foreground">
                      {card.cardSequence}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {getCardBrandDisplay(card.cardBrand)}
                      <span className="font-mono">•••• {card.lastFourDigits}</span>
                      {card.isPrimary && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {card.cardholderName} • Exp {card.expiryMonth.toString().padStart(2, '0')}/{card.expiryYear}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {getTokenStatusBadge(card.tokenStatus, card.isMock)}
                  
                  {!card.isPrimary && reservationId && (
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
                    onClick={() => setCardToDelete(card.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add Card Dialog */}
      <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Card (Card {selectedSequence})</DialogTitle>
          </DialogHeader>
          <AdyenCardCapture
            propertyId={propertyId}
            reservationId={reservationId}
            ledgerAccountId={ledgerAccountId}
            guestId={guestId}
            cardSequence={selectedSequence}
            mode="tokenize"
            onSuccess={handleCardAdded}
            onCancel={() => setShowAddCard(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!cardToDelete} onOpenChange={() => setCardToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Card?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the payment card from this reservation. 
              Active authorizations on this card cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCard} className="bg-destructive text-destructive-foreground">
              Remove Card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
