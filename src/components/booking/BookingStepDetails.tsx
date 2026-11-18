import { useState } from "react";
import { Calendar, MapPin, Users, CalendarIcon, AlertCircle, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { BookingFormData, SiteType } from "@/types/booking";
import type { GroupBlockAllocation, GroupBlockSiteAllocation } from "@/hooks/useBookingForm";
import type { Rate } from "@/hooks/useBookingData";
interface BookingStepDetailsProps {
  formData: BookingFormData;
  setFormData: React.Dispatch<React.SetStateAction<BookingFormData>>;
  terminology: {
    siteType: string;
    siteNumber: string;
    site: string;
  };
  preselectedSite: any;
  siteTypes: SiteType[];
  defaultRatePrices: Record<string, number>;
  loading: boolean;
  isEditMode: boolean;
  isFromBookingChart?: boolean;
  groupBlockAllocations?: GroupBlockAllocation[];
  groupBlockSiteAllocations?: GroupBlockSiteAllocation[];
  isRoomSpecificBlock?: boolean;
  allowOtherRoomTypes?: boolean;
  rates?: Rate[];
  ratesLoading?: boolean;
  onCalculateQuote: () => void;
}

export const BookingStepDetails = ({
  formData,
  setFormData,
  terminology,
  preselectedSite,
  siteTypes,
  defaultRatePrices,
  loading,
  isEditMode,
  isFromBookingChart,
  groupBlockAllocations = [],
  groupBlockSiteAllocations = [],
  isRoomSpecificBlock = false,
  allowOtherRoomTypes = false,
  rates = [],
  ratesLoading = false,
  onCalculateQuote,
}: BookingStepDetailsProps) => {
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Filter site types based on group block allocations
  const isGroupBooking = groupBlockAllocations.length > 0;
  const allocatedSiteTypeIds = new Set(groupBlockAllocations.map(a => a.site_type_id));
  
  const filteredSiteTypes = isGroupBooking && !allowOtherRoomTypes
    ? siteTypes.filter(st => allocatedSiteTypeIds.has(st.id))
    : siteTypes;
  return (
    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-4">Reservation Details</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label className="flex items-center gap-2 mb-2">
            <Calendar className="h-4 w-4" />
            Dates of Stay
          </Label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.checkIn && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.checkIn && formData.checkOut ? (
                  <>
                    {format(new Date(formData.checkIn + "T00:00:00"), "MMM d, yyyy")} – {format(new Date(formData.checkOut + "T00:00:00"), "MMM d, yyyy")}
                  </>
                ) : formData.checkIn ? (
                  <>
                    {format(new Date(formData.checkIn + "T00:00:00"), "MMM d, yyyy")} – Select check-out
                  </>
                ) : (
                  <span>Select check-in and check-out dates</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={{
                  from: formData.checkIn ? new Date(formData.checkIn + "T00:00:00") : undefined,
                  to: formData.checkOut ? new Date(formData.checkOut + "T00:00:00") : undefined,
                }}
                onSelect={(range: DateRange | undefined) => {
                  setFormData({
                    ...formData,
                    checkIn: range?.from ? format(range.from, "yyyy-MM-dd") : "",
                    checkOut: range?.to ? format(range.to, "yyyy-MM-dd") : "",
                  });
                  // Auto-close when both dates are selected
                  if (range?.from && range?.to) {
                    setCalendarOpen(false);
                  }
                }}
                numberOfMonths={2}
                disabled={{ before: new Date() }}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label htmlFor="siteType" className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4" />
            {terminology.siteType}
            {isRoomSpecificBlock && (
              <span className="text-xs text-primary font-normal">(Room-specific block)</span>
            )}
            {isGroupBooking && !allowOtherRoomTypes && !isRoomSpecificBlock && (
              <span className="text-xs text-primary font-normal">(Group restricted)</span>
            )}
          </Label>
          {preselectedSite ? (
            <Input
              value={preselectedSite.site_types?.name || "Selected Site"}
              disabled
              className="bg-muted"
            />
          ) : isRoomSpecificBlock ? (
            <>
              <Input
                value="Room selection in next step"
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This group block has specific rooms allocated. You'll select a room in the next step.
              </p>
            </>
          ) : (
            <>
              <Select value={formData.siteType} onValueChange={(value) => setFormData({ ...formData, siteType: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${terminology.siteType.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {filteredSiteTypes.map((type) => {
                    // For group bookings, show group rate info if available
                    const allocation = groupBlockAllocations.find(a => a.site_type_id === type.id);
                    const price = allocation?.override_rate ?? defaultRatePrices[type.id] ?? type.base_price;
                    const isGroupRate = allocation && (allocation.override_rate !== null || allocation.rate_id !== null);
                    return (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name} - ${price}/night {isGroupRate && "(Group Rate)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {isGroupBooking && filteredSiteTypes.length === 0 && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No room types are allocated for this group block.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>
        {preselectedSite && (
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4" />
              {terminology.siteNumber}
            </Label>
            <Input
              value={`${terminology.site} ${preselectedSite.site_number}`}
              disabled
              className="bg-muted"
            />
          </div>
        )}
        <div>
          <Label htmlFor="guests" className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4" />
            Number of Guests
          </Label>
          <Input
            id="guests"
            type="number"
            min="1"
            max="10"
            value={formData.guests}
            onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
          />
        </div>
        <div>
          <Label className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4" />
            Rate Code
          </Label>
          {ratesLoading ? (
            <p className="text-sm text-muted-foreground py-2">Loading rates...</p>
          ) : rates.length > 0 ? (
            <Select 
              value={formData.rateId} 
              onValueChange={(value) => setFormData({ ...formData, rateId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select rate (optional)" />
              </SelectTrigger>
              <SelectContent>
                {rates.map((rate) => (
                  <SelectItem key={rate.id} value={rate.id}>
                    {rate.rate_code} {rate.description ? `- ${rate.description}` : ""}
                    {rate.is_default && " (Default)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : formData.checkIn && formData.checkOut ? (
            <p className="text-sm text-muted-foreground py-2">No rates available for selected dates</p>
          ) : (
            <p className="text-sm text-muted-foreground py-2">Select dates to see available rates</p>
          )}
        </div>

        {/* Site requirements — hard-block ineligible sites in picker/auto-assign */}
        <div className="md:col-span-2">
          <Label className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4" />
            Site Requirements
            <span className="text-xs font-normal text-muted-foreground">(optional — filters available sites)</span>
          </Label>
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3">
            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Rig length (ft)</span>
              <Input
                type="number"
                min={0}
                className="h-8 w-20"
                value={formData.siteRequirements?.min_length ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setFormData({
                    ...formData,
                    siteRequirements: {
                      ...(formData.siteRequirements ?? {}),
                      min_length: v ? Number(v) : undefined,
                    },
                  });
                }}
              />
            </label>
            {([
              ["needs_50amp", "50A"],
              ["needs_30amp", "30A"],
              ["needs_pull_through", "Pull-thru"],
              ["needs_shade", "Shade"],
              ["needs_fire_pit", "Fire pit"],
              ["needs_picnic_table", "Picnic table"],
              ["needs_bump_outs", "Bump-outs"],
            ] as const).map(([k, label]) => {
              const on = !!formData.siteRequirements?.[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      siteRequirements: {
                        ...(formData.siteRequirements ?? {}),
                        [k]: !on,
                      },
                    })
                  }
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground/70 border-border hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
            {formData.siteRequirements &&
              (Object.keys(formData.siteRequirements) as Array<keyof typeof formData.siteRequirements>).some(
                (k) => formData.siteRequirements?.[k],
              ) && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, siteRequirements: undefined })}
                  className="ml-auto text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Clear
                </button>
              )}
          </div>
        </div>
      </div>
      <div className="flex justify-center mt-6">
        <Button onClick={onCalculateQuote} disabled={loading} className="w-1/2">
          <Calendar className="mr-2 h-4 w-4" />
          {loading ? "Processing..." : isEditMode ? "Update & Confirm" : (preselectedSite || isFromBookingChart) ? "Start Booking" : "Check Availability"}
        </Button>
      </div>
    </Card>
  );
};
