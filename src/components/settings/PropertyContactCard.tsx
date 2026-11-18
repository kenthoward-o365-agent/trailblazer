import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PhoneInput } from "@/components/ui/phone-input";
import { Save, Building2, Lock } from "lucide-react";
import { getCountryName } from "@/lib/countries";

interface Property {
  id: string;
  name: string;
  address: string;
  country?: string | null;
  max_sites?: number | null;
  customer_id?: number | null;
}

interface PropertyContactCardProps {
  selectedProperty: Property;
  propertiesCount: number;
  terminology: {
    isHotel: boolean;
    site: string;
    sites: string;
  };
  phone1: string;
  setPhone1: (value: string) => void;
  phone2: string;
  setPhone2: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  website: string;
  setWebsite: (value: string) => void;
  requireRoomAtBooking: boolean;
  setRequireRoomAtBooking: (value: boolean) => void;
  saving: boolean;
  onSave: () => void;
}

export const PropertyContactCard = ({
  selectedProperty,
  propertiesCount,
  terminology,
  phone1,
  setPhone1,
  phone2,
  setPhone2,
  email,
  setEmail,
  website,
  setWebsite,
  requireRoomAtBooking,
  setRequireRoomAtBooking,
  saving,
  onSave,
}: PropertyContactCardProps) => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">
            {propertiesCount > 1 ? `Edit: ${selectedProperty.name}` : "Property Information"}
          </h2>
        </div>
        {selectedProperty.customer_id && (
          <div className="text-sm text-muted-foreground">
            Customer ID: <span className="font-mono font-medium text-foreground">{selectedProperty.customer_id}</span>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column - Read-only Property Info */}
        <div className="p-4 bg-muted/50 rounded-lg border border-dashed h-fit">
          <div className="flex items-center gap-2 mb-3 text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span className="text-sm font-medium">Managed by roomMaster Admin</span>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-muted-foreground">Property Name</Label>
              <p className="font-medium text-lg">{selectedProperty.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Address</Label>
              <p className="font-medium">{selectedProperty.address}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Country</Label>
              <p className="font-medium">{getCountryName(selectedProperty.country || 'US')}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Site Limit</Label>
              <p className="font-medium">{selectedProperty.max_sites || 50} sites</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Contact your roomMaster administrator to update property name or address.
          </p>
        </div>

        {/* Right Column - Editable Contact Info */}
        <div className="space-y-4">
          <h3 className="font-medium">Contact Information</h3>
          
          <div>
            <Label htmlFor="phone1">Phone Number 1</Label>
            <PhoneInput
              id="phone1"
              value={phone1}
              onChange={setPhone1}
              countryCode={selectedProperty.country || 'US'}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <Label htmlFor="phone2">Phone Number 2</Label>
            <PhoneInput
              id="phone2"
              value={phone2}
              onChange={setPhone2}
              countryCode={selectedProperty.country || 'US'}
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <Label htmlFor="email">Main Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@yourproperty.com"
            />
          </div>

          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.yourproperty.com"
            />
          </div>

          {/* Inventory Mode Toggle - Hotels Only */}
          {terminology.isHotel && (
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-3">Booking Settings</h3>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="requireRoom">Require {terminology.site} at Booking</Label>
                  <p className="text-sm text-muted-foreground">
                    {requireRoomAtBooking 
                      ? `A specific ${terminology.site.toLowerCase()} must be assigned when creating a reservation`
                      : `${terminology.sites} can be assigned later, including at check-in`
                    }
                  </p>
                </div>
                <Switch
                  id="requireRoom"
                  checked={requireRoomAtBooking}
                  onCheckedChange={setRequireRoomAtBooking}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4">
        <Button onClick={onSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </Card>
  );
};
