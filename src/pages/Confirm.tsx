import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useProperty } from "@/contexts/PropertyContext";
import { useConfirmation } from "@/hooks/useConfirmation";
import { AdvanceDepositPayment } from "@/components/AdvanceDepositPayment";
import { ReservationDetailsCard } from "@/components/confirm/ReservationDetailsCard";
import { PaymentDetailsCard } from "@/components/confirm/PaymentDetailsCard";

import { ConfirmationActions } from "@/components/confirm/ConfirmationActions";
import { ConfirmedView } from "@/components/confirm/ConfirmedView";

const Confirm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  
  const {
    reservation,
    recommendations,
    chargesBreakdown,
    loading,
    confirming,
    cancelling,
    guaranteeOptions,
    selectedGuarantee,
    setSelectedGuarantee,
    paymentCards,
    isCardRequired,
    hasValidCard,
    canConfirm,
    hasDeposits,
    confirmReservation,
    cancelReservation,
    fetchPaymentCards,
    checkForDeposits,
    getCardIcon,
  } = useConfirmation(id);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Reservation Not Found</h2>
          <p className="text-muted-foreground mb-4">The reservation you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </Card>
      </div>
    );
  }

  const propertyName = selectedProperty?.name || "Property";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-2">
          <h1 className="text-xl font-bold text-primary">{propertyName}</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4">
        <div className="max-w-4xl mx-auto">
          {reservation.status === "CONFIRMED" ? (
            <>
              <ConfirmedView reservation={reservation} propertyName={propertyName} />
              <ReservationDetailsCard reservation={reservation} chargesBreakdown={chargesBreakdown} />
            </>
          ) : (
            <>
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground mb-1">Step 3 of 3: Review Your Reservation</p>
                <h2 className="text-2xl font-bold mb-1">Review Your Reservation</h2>
                <p className="text-sm text-muted-foreground">Please confirm the details below.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <ReservationDetailsCard reservation={reservation} chargesBreakdown={chargesBreakdown} />

                <div className="space-y-4">
                  <PaymentDetailsCard
                    reservationId={reservation.id}
                    guaranteeOptions={guaranteeOptions}
                    selectedGuarantee={selectedGuarantee}
                    setSelectedGuarantee={setSelectedGuarantee}
                    paymentCards={paymentCards}
                    isCardRequired={isCardRequired}
                    onCardAdded={fetchPaymentCards}
                    getCardIcon={getCardIcon}
                  />

                  {chargesBreakdown && (
                    <AdvanceDepositPayment
                      reservationId={reservation.id}
                      totalCharges={chargesBreakdown.total}
                      firstNightRate={chargesBreakdown.basePrice}
                      numberOfNights={chargesBreakdown.days}
                      numberOfAdults={reservation.guests_count || 1}
                      revenueAccountId={reservation.rates?.revenue_account_id}
                      guestId={reservation.guest_id}
                      propertyId={reservation.property_id}
                      defaultDepositRequirement={reservation.rates?.deposit_requirement}
                      onPaymentPosted={checkForDeposits}
                    />
                  )}
                </div>
              </div>

              

              <ConfirmationActions
                confirming={confirming}
                cancelling={cancelling}
                canConfirm={canConfirm}
                isCardRequired={isCardRequired}
                hasValidCard={hasValidCard}
                hasDeposits={hasDeposits}
                onConfirm={confirmReservation}
                onCancel={cancelReservation}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Confirm;
