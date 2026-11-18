import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PrintDocumentButton } from "@/components/PrintDocumentButton";
import { toast } from "sonner";

interface ConfirmedViewProps {
  reservation: any;
  propertyName: string;
}

export const ConfirmedView = ({ reservation, propertyName }: ConfirmedViewProps) => {
  const navigate = useNavigate();
  const [emailSending, setEmailSending] = useState(false);

  const handleEmailConfirmation = async () => {
    setEmailSending(true);
    // Simulate API call delay for demo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success(
      `Confirmation email sent to ${reservation.guests.email}`,
      { description: "The guest will receive their confirmation details shortly." }
    );
    setEmailSending(false);
  };

  return (
    <>
      <div className="text-center mb-8">
        <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
        <h2 className="text-3xl font-bold mb-2">Reservation Confirmed!</h2>
        <p className="text-muted-foreground">Your stay at {propertyName} is all set.</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <PrintDocumentButton
          reservation={{
            id: reservation.id,
            check_in_date: reservation.check_in_date,
            check_out_date: reservation.check_out_date,
            total_price: parseFloat(reservation.total_price),
            adults_count: reservation.adults_count || reservation.guests_count || 1,
            children_count: reservation.children_count || 0,
            guests: {
              first_name: reservation.guests.first_name,
              last_name: reservation.guests.last_name,
              email: reservation.guests.email,
              phone: reservation.guests.phone,
              street_address: reservation.guests.street_address,
              city: reservation.guests.city,
              state: reservation.guests.state,
              zipcode: reservation.guests.zipcode,
            },
            sites: reservation.sites ? {
              site_number: reservation.sites.site_number,
              site_types: {
                name: reservation.sites.site_types?.name || "",
              },
            } : null,
            rates: reservation.rates,
          }}
          documentType="confirmation_letter"
          variant="default"
        />
        <Button 
          onClick={handleEmailConfirmation} 
          disabled={emailSending}
          variant="outline"
        >
          {emailSending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Mail className="h-4 w-4 mr-2" />
          )}
          Email Confirmation
        </Button>
        <Button onClick={() => navigate("/")} variant="outline">
          Return to Home
        </Button>
      </div>
    </>
  );
};
