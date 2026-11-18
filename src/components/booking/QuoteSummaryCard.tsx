import { Card } from "@/components/ui/card";
import { CalculatedTax } from "@/lib/taxCalculations";
import type { SelectedAddOn, AddOn, QuoteDetails } from "@/types/booking";

interface QuoteSummaryCardProps {
  quote: QuoteDetails;
  selectedAddOns: SelectedAddOn[];
  availableAddOns: AddOn[];
  terminology: {
    siteType: string;
  };
}

export const QuoteSummaryCard = ({
  quote,
  selectedAddOns,
  availableAddOns,
  terminology,
}: QuoteSummaryCardProps) => {
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-3">Quote Summary</h3>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{terminology.siteType}:</span>
          <span className="font-medium">{quote.siteTypeName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Duration:</span>
          <span className="font-medium">{quote.days} night{quote.days > 1 ? "s" : ""}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base Price:</span>
          <span>${quote.basePrice}/night</span>
        </div>
        {quote.seasonMultiplier !== 1 && (
          <div className="flex justify-between text-accent">
            <span>Seasonal:</span>
            <span>{(quote.seasonMultiplier * 100).toFixed(0)}%</span>
          </div>
        )}
        {quote.weekendMultiplier !== 1 && (
          <div className="flex justify-between text-accent">
            <span>Weekend:</span>
            <span>{(quote.weekendMultiplier * 100).toFixed(0)}%</span>
          </div>
        )}
        {quote.losDiscount > 0 && (
          <div className="flex justify-between text-primary">
            <span>LOS Discount:</span>
            <span>-${quote.losDiscount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-medium pt-1 border-t">
          <span>Subtotal:</span>
          <span>${quote.subtotal.toFixed(2)}</span>
        </div>
        {/* Add-ons in Quote Summary */}
        {selectedAddOns.length > 0 && (
          <div className="pt-2">
            <div className="text-sm font-medium mb-1">Add-ons:</div>
            {selectedAddOns.map((sa) => {
              const addon = availableAddOns.find(a => a.id === sa.addOnId);
              if (!addon) return null;
              
              const isNightly = addon.charge_type === 'nightly';
              const multiplier = isNightly ? quote.days : 1;
              const lineTotal = addon.price * sa.quantity * multiplier;
              
              return (
                <div key={sa.addOnId} className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {addon.code} - {addon.name} x{sa.quantity}
                    {isNightly && ` × ${quote.days} nights`}:
                  </span>
                  <span>${lineTotal.toFixed(2)}</span>
                </div>
              );
            })}
            <div className="flex justify-between text-sm font-medium pt-1">
              <span>Add-ons Total:</span>
              <span>${(quote.addOnsTotal || 0).toFixed(2)}</span>
            </div>
          </div>
        )}
        {quote.taxes && quote.taxes.length > 0 && (
          <div className="pt-2">
            <div className="text-sm font-medium mb-1">Taxes:</div>
            {quote.taxes.map((tax: CalculatedTax, idx: number) => (
              <div key={idx} className="flex justify-between text-sm text-muted-foreground">
                <span>{tax.taxAccountName} ({tax.description}):</span>
                <span>${tax.calculatedAmount.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-medium pt-1">
              <span>Total Taxes:</span>
              <span>${quote.totalTax.toFixed(2)}</span>
            </div>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold pt-2 border-t mt-2">
          <span>Total:</span>
          <span className="text-primary">${quote.totalPrice.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  );
};
