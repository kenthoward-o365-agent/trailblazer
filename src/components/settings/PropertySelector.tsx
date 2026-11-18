import { Card } from "@/components/ui/card";
import { Building2, Check } from "lucide-react";

interface Property {
  id: string;
  name: string;
  address: string;
  customer_id?: number | null;
}

interface PropertySelectorProps {
  properties: Property[];
  selectedPropertyId: string | null;
  onSelect: (propertyId: string) => void;
}

export const PropertySelector = ({
  properties,
  selectedPropertyId,
  onSelect,
}: PropertySelectorProps) => {
  if (properties.length <= 1) return null;

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-3">Your Properties</h2>
      <div className="grid gap-2">
        {properties.map((property) => (
          <div
            key={property.id}
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedPropertyId === property.id
                ? "bg-primary/10 border-primary"
                : "hover:bg-muted"
            }`}
            onClick={() => onSelect(property.id)}
          >
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{property.name}</p>
                  {property.customer_id && (
                    <span className="text-xs font-mono text-muted-foreground">#{property.customer_id}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{property.address}</p>
              </div>
            </div>
            {selectedPropertyId === property.id && (
              <Check className="h-5 w-5 text-primary" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
