import { Card } from "@/components/ui/card";
import { MapPin, Calendar, Users, DollarSign } from "lucide-react";
import type { ChargesBreakdown } from "@/hooks/useConfirmation";
import { parseLocalDate, formatLocalDate } from "@/lib/dateUtils";

interface ReservationDetailsCardProps {
  reservation: any;
  chargesBreakdown: ChargesBreakdown | null;
}

export const ReservationDetailsCard = ({
  reservation,
  chargesBreakdown,
}: ReservationDetailsCardProps) => {
  const checkIn = parseLocalDate(reservation.check_in_date);
  const checkOut = parseLocalDate(reservation.check_out_date);
  const nights = checkIn && checkOut 
    ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <Card className="p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">Reservation Details</h3>
        {reservation.confirmation_number && (
          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
            #{reservation.confirmation_number}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {reservation.sites && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium">Site {reservation.sites.site_number}</div>
              <div className="text-xs text-muted-foreground">{reservation.sites.site_types?.name}</div>
            </div>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium">
              {formatLocalDate(reservation.check_in_date, "MM/dd/yyyy")} - {formatLocalDate(reservation.check_out_date, "MM/dd/yyyy")}
            </div>
            <div className="text-xs text-muted-foreground">{nights} night(s)</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium">{reservation.guests_count} guest(s)</div>
            <div className="text-xs text-muted-foreground">
              {reservation.guests.first_name} {reservation.guests.last_name}
            </div>
          </div>
        </div>
        {chargesBreakdown && (
          <div className="pt-2 border-t mt-2">
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Charges</h4>
            </div>
            {chargesBreakdown.rateName && (
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-muted-foreground">Rate:</span>
                <span>{chargesBreakdown.rateName}</span>
              </div>
            )}
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">
                {chargesBreakdown.days} night{chargesBreakdown.days > 1 ? "s" : ""} × ${chargesBreakdown.basePrice.toFixed(2)}:
              </span>
              <span>${chargesBreakdown.subtotal.toFixed(2)}</span>
            </div>
            {chargesBreakdown.taxes.length > 0 && (
              <>
                <div className="text-xs font-medium mt-1 mb-0.5">Taxes:</div>
                {chargesBreakdown.taxes.map((tax, idx) => (
                  <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate mr-2">{tax.taxAccountName}:</span>
                    <span className="shrink-0">${tax.calculatedAmount.toFixed(2)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t">
              <span>Total:</span>
              <span className="text-primary">${chargesBreakdown.total.toFixed(2)}</span>
            </div>
          </div>
        )}
        {!chargesBreakdown && (
          <div className="pt-2 border-t mt-2">
            <div className="flex justify-between text-base font-bold">
              <span>Total:</span>
              <span className="text-primary">${parseFloat(reservation.total_price).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
