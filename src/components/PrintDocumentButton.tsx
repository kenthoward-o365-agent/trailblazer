import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";

interface ReservationData {
  id: string;
  check_in_date: string;
  check_out_date: string;
  total_price: number;
  adults_count?: number;
  children_count?: number;
  special_requests?: string | null;
  guests: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string | null;
    phone2?: string | null;
    street_address?: string | null;
    city?: string | null;
    state?: string | null;
    zipcode?: string | null;
  };
  sites: {
    site_number: string;
    site_types: {
      name: string;
    };
  };
  rates?: {
    rate_code: string;
  } | null;
  properties?: {
    name: string;
    address: string;
  };
}

interface PrintDocumentButtonProps {
  reservation: ReservationData;
  documentType: "registration_card" | "confirmation_letter";
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  asMenuItem?: boolean;
}

export const PrintDocumentButton = ({ 
  reservation, 
  documentType,
  variant = "outline",
  size = "default",
  asMenuItem = false
}: PrintDocumentButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    try {
      // Fetch the template, property info, and payment card
      const [templateResult, propertyResult, paymentCardResult] = await Promise.all([
        supabase
          .from("campaigns")
          .select("content, name")
          .eq("channel", documentType)
          .eq("status", "active")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("properties")
          .select("name, address")
          .limit(1)
          .single(),
        supabase
          .from("payment_cards")
          .select("card_brand, last_four_digits, expiry_month, expiry_year")
          .eq("reservation_id", reservation.id)
          .eq("is_primary", true)
          .maybeSingle()
      ]);

      if (templateResult.error) throw templateResult.error;

      if (!templateResult.data) {
        toast.error(`No ${documentType === "registration_card" ? "Registration Card" : "Confirmation Letter"} template found. Please create one in CRM.`);
        return;
      }

      const template = templateResult.data;
      const property = propertyResult.data;
      const paymentCard = paymentCardResult.data;

      // Calculate nights
      const nights = differenceInDays(
        new Date(reservation.check_out_date),
        new Date(reservation.check_in_date)
      );

      // Format card expiration
      const cardExpiration = paymentCard 
        ? `${String(paymentCard.expiry_month).padStart(2, "0")}/${paymentCard.expiry_year}`
        : "";

      // Replace template variables
      let content = template.content || "";
      const replacements: Record<string, string> = {
        "{{first_name}}": reservation.guests.first_name || "",
        "{{last_name}}": reservation.guests.last_name || "",
        "{{email}}": reservation.guests.email || "",
        "{{phone}}": reservation.guests.phone || "",
        "{{phone2}}": reservation.guests.phone2 || "",
        "{{address}}": reservation.guests.street_address || "",
        "{{city}}": reservation.guests.city || "",
        "{{state}}": reservation.guests.state || "",
        "{{zipcode}}": reservation.guests.zipcode || "",
        "{{check_in_date}}": formatLocalDate(reservation.check_in_date, "MMMM d, yyyy"),
        "{{check_out_date}}": formatLocalDate(reservation.check_out_date, "MMMM d, yyyy"),
        "{{site_number}}": reservation.sites?.site_number || "",
        "{{site_type}}": reservation.sites?.site_types?.name || "",
        "{{rate_code}}": reservation.rates?.rate_code || "Standard",
        "{{total_price}}": `$${reservation.total_price.toFixed(2)}`,
        "{{nights}}": nights.toString(),
        "{{adults}}": (reservation.adults_count || 1).toString(),
        "{{children}}": (reservation.children_count || 0).toString(),
        "{{special_requests}}": reservation.special_requests || "",
        "{{property_name}}": property?.name || "",
        "{{property_address}}": property?.address || "",
        "{{today_date}}": format(new Date(), "MMMM d, yyyy"),
        "{{card_type}}": paymentCard?.card_brand || "",
        "{{card_last_four}}": paymentCard?.last_four_digits || "",
        "{{card_expiration}}": cardExpiration,
        "{{signature_line}}": `
          <div style="margin-top: 40px; border-top: 1px solid #000; width: 300px; padding-top: 8px;">
            <span style="font-size: 12px;">Guest Signature</span>
          </div>
          <div style="margin-top: 20px; border-top: 1px solid #000; width: 200px; padding-top: 8px;">
            <span style="font-size: 12px;">Date</span>
          </div>
        `,
      };

      Object.entries(replacements).forEach(([key, value]) => {
        content = content.replace(new RegExp(key, "g"), value);
      });

      // Create print window
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Please allow popups to print documents");
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${template.name || documentType}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              line-height: 1.6;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Failed to print document");
    } finally {
      setLoading(false);
    }
  };

  const label = loading 
    ? "Loading..." 
    : documentType === "registration_card" 
      ? "Print Registration Card" 
      : "Print Confirmation Letter";

  if (asMenuItem) {
    return (
      <DropdownMenuItem onClick={handlePrint} disabled={loading}>
        <Printer className="h-4 w-4 mr-2" />
        {label}
      </DropdownMenuItem>
    );
  }

  return (
    <Button 
      variant={variant} 
      size={size}
      onClick={handlePrint} 
      disabled={loading}
    >
      <Printer className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
};
