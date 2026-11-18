import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AutoCapInput } from "@/components/ui/auto-cap-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { GuestLookup } from "@/components/GuestLookup";
import { MonthDayPicker } from "@/components/ui/month-day-picker";
import { COUNTRIES } from "@/lib/countries";
import { lookupZip } from "@/lib/zipLookup";
import type { BookingFormData, MatchedGuest } from "@/types/booking";

// Auto-capitalize first letter of each word
const toTitleCase = (str: string): string => {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

interface BookingStepGuestProps {
  formData: BookingFormData;
  setFormData: React.Dispatch<React.SetStateAction<BookingFormData>>;
  selectedGuestId: string | null;
  onGuestSelected: (guest: MatchedGuest | null) => void;
  selectedProperty: {
    id?: string;
    organization_id?: string | null;
  } | null;
  loading: boolean;
  isEditMode: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

export const BookingStepGuest = ({
  formData,
  setFormData,
  selectedGuestId,
  onGuestSelected,
  selectedProperty,
  loading,
  isEditMode,
  onBack,
  onSubmit,
}: BookingStepGuestProps) => {
  return (
    <Card className="p-4 lg:col-span-2">
      <h3 className="text-lg font-semibold mb-3">Guest Information</h3>
      
      <GuestLookup
        firstName={formData.firstName}
        lastName={formData.lastName}
        email={formData.email}
        streetAddress={formData.streetAddress}
        onGuestSelected={onGuestSelected}
        selectedGuestId={selectedGuestId}
        organizationId={selectedProperty?.organization_id}
        propertyId={selectedProperty?.id}
      />

      <div className="grid grid-cols-4 gap-3">
        <div>
          <Label htmlFor="title" className="text-xs">Title</Label>
          <Select value={formData.title} onValueChange={(value) => setFormData({ ...formData, title: value })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Mr.">Mr.</SelectItem>
              <SelectItem value="Mrs.">Mrs.</SelectItem>
              <SelectItem value="Ms.">Ms.</SelectItem>
              <SelectItem value="Dr.">Dr.</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="firstName" className="text-xs">First Name *</Label>
          <Input
            id="firstName"
            className="h-9"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: toTitleCase(e.target.value) })}
            required
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="lastName" className="text-xs">Last Name *</Label>
          <Input
            id="lastName"
            className="h-9"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: toTitleCase(e.target.value) })}
            required
          />
        </div>
      </div>

      <div className="mt-3">
        <Label htmlFor="streetAddress" className="text-xs">Street Address</Label>
        <Input
          id="streetAddress"
          className="h-9"
          value={formData.streetAddress}
          onChange={(e) => setFormData({ ...formData, streetAddress: toTitleCase(e.target.value) })}
          placeholder="123 Main Street"
        />
      </div>

      <div className="grid grid-cols-4 gap-3 mt-3">
        <div>
          <Label htmlFor="city" className="text-xs">City</Label>
          <Input
            id="city"
            className="h-9"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: toTitleCase(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="state" className="text-xs">State</Label>
          <AutoCapInput
            id="state"
            className="h-9"
            autoCapMode="upper"
            maxLength={2}
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="zipcode" className="text-xs">Zipcode</Label>
          <Input
            id="zipcode"
            className="h-9"
            value={formData.zipcode}
            onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
            onBlur={async (e) => {
              const zip = e.target.value.trim();
              if (!zip) return;
              const hit = await lookupZip(zip, formData.country || "US");
              if (hit) {
                setFormData((prev) => ({
                  ...prev,
                  city: prev.city || hit.city,
                  state: prev.state || hit.state,
                }));
              }
            }}
          />
        </div>
        <div>
          <Label htmlFor="country" className="text-xs">Country</Label>
          <Select value={formData.country} onValueChange={(value) => setFormData({ ...formData, country: value })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        <div>
          <Label htmlFor="phone" className="text-xs">Phone 1</Label>
          <PhoneInput
            id="phone"
            className="h-9"
            value={formData.phone}
            onChange={(value) => setFormData({ ...formData, phone: value })}
            countryCode={formData.country}
          />
        </div>
        <div>
          <Label htmlFor="phone2" className="text-xs">Phone 2</Label>
          <PhoneInput
            id="phone2"
            className="h-9"
            value={formData.phone2}
            onChange={(value) => setFormData({ ...formData, phone2: value })}
            countryCode={formData.country}
          />
        </div>
        <div>
          <Label htmlFor="email" className="text-xs">Email *</Label>
          <Input
            id="email"
            type="email"
            className="h-9"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
      </div>

      {/* Optional Guest Details */}
      <div className="grid grid-cols-3 gap-3 mt-3">
        <MonthDayPicker
          label="Birthday"
          value={formData.birthday}
          onChange={(value) => setFormData({ ...formData, birthday: value })}
        />
        <MonthDayPicker
          label="Anniversary"
          value={formData.anniversary}
          onChange={(value) => setFormData({ ...formData, anniversary: value })}
        />
        <div className="row-span-2">
          <Label htmlFor="likesDislikes" className="text-xs">Likes/Dislikes</Label>
          <Textarea
            id="likesDislikes"
            className="h-[74px] resize-none text-sm"
            maxLength={250}
            value={formData.likesDislikes}
            onChange={(e) => setFormData({ ...formData, likesDislikes: e.target.value })}
            placeholder="Guest preferences..."
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onSubmit} disabled={loading} className="flex-1">
          {loading ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update Reservation" : "Create Reservation")}
        </Button>
      </div>
    </Card>
  );
};
