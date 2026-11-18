import { DollarSign, Briefcase, Package, X, Building, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { QuoteSummaryCard } from "./QuoteSummaryCard";
import type { 
  BookingFormData, 
  Rate, 
  SourceOfBusiness, 
  AddOn, 
  CityLedger, 
  Site, 
  SelectedAddOn,
  QuoteDetails 
} from "@/types/booking";
import type { GroupBlockAllocation, GroupBlockSiteAllocation } from "@/hooks/useBookingForm";

interface GroupBlock {
  code: string;
  description: string | null;
  allowOtherRoomTypes: boolean;
  hasMasterAccount: boolean;
  chargeRouting: string | null;
  cityLedgerAccountId: string | null;
}

interface BookingStepSiteProps {
  quote: any;
  formData: BookingFormData;
  setFormData: React.Dispatch<React.SetStateAction<BookingFormData>>;
  rates: Rate[];
  sourcesOfBusiness: SourceOfBusiness[];
  availableAddOns: AddOn[];
  selectedAddOns: SelectedAddOn[];
  cityLedgers: CityLedger[];
  sites: Site[];
  terminology: {
    siteType: string;
    site: string;
    isHotel: boolean;
    isTypeFloating: boolean;
  };
  preselectedSite: any;
  billToCompany: boolean;
  setBillToCompany: (value: boolean) => void;
  selectedCityLedgerId: string;
  setSelectedCityLedgerId: (value: string) => void;
  billingInstructions: string;
  setBillingInstructions: (value: string) => void;
  onAddAddOn: (addOnId: string) => void;
  onRemoveAddOn: (addOnId: string) => void;
  groupBlockAllocations?: GroupBlockAllocation[];
  groupBlockSiteAllocations?: GroupBlockSiteAllocation[];
  isRoomSpecificBlock?: boolean;
  groupBlock?: GroupBlock | null;
}

export const BookingStepSite = ({
  quote,
  formData,
  setFormData,
  rates,
  sourcesOfBusiness,
  availableAddOns,
  selectedAddOns,
  cityLedgers,
  sites,
  terminology,
  preselectedSite,
  billToCompany,
  setBillToCompany,
  selectedCityLedgerId,
  setSelectedCityLedgerId,
  billingInstructions,
  setBillingInstructions,
  onAddAddOn,
  onRemoveAddOn,
  groupBlockAllocations = [],
  groupBlockSiteAllocations = [],
  isRoomSpecificBlock = false,
  groupBlock,
}: BookingStepSiteProps) => {
  // Check if this is a group booking and get rate info
  // For room-specific blocks, look up rate from site allocations based on selected room
  // For room-type blocks, look up from type allocations
  const isGroupBooking = groupBlockAllocations.length > 0 || isRoomSpecificBlock;
  
  let groupOverrideRate: number | null | undefined = undefined;
  let groupRateId: string | null | undefined = undefined;
  
  if (isRoomSpecificBlock && formData.selectedSite) {
    // Room-specific block: get rate from the selected room's allocation
    const siteAllocation = groupBlockSiteAllocations.find(a => a.site_id === formData.selectedSite);
    groupOverrideRate = siteAllocation?.override_rate;
    groupRateId = siteAllocation?.rate_id;
  } else if (isRoomSpecificBlock && groupBlockSiteAllocations.length > 0) {
    // Room-specific block but no room selected yet: show first allocation's rate as preview
    const firstAllocation = groupBlockSiteAllocations[0];
    groupOverrideRate = firstAllocation?.override_rate;
    groupRateId = firstAllocation?.rate_id;
  } else {
    // Room-type based block: get rate from type allocation
    const currentAllocation = groupBlockAllocations.find(a => a.site_type_id === formData.siteType);
    groupOverrideRate = currentAllocation?.override_rate;
    groupRateId = currentAllocation?.rate_id;
  }
  
  const hasGroupRate = groupOverrideRate !== null && groupOverrideRate !== undefined || groupRateId !== null && groupRateId !== undefined;
  
  // For room-specific blocks, filter sites to only show allocated rooms
  const allocatedSiteIds = new Set(groupBlockSiteAllocations.map(a => a.site_id));
  const filteredSites = isRoomSpecificBlock
    ? sites.filter(s => allocatedSiteIds.has(s.id))
    : sites;
  
  // Find the rate name for display
  const groupRateName = groupRateId ? rates.find(r => r.id === groupRateId)?.rate_code : null;
  return (
    <div className="space-y-4">
      {/* Quote Summary */}
      <QuoteSummaryCard
        quote={quote}
        selectedAddOns={selectedAddOns}
        availableAddOns={availableAddOns}
        terminology={terminology}
      />

      {/* Rate & Source */}
      <Card className="p-4">
        <div className="space-y-3">
          <div>
            <Label className="text-sm flex items-center gap-1 mb-1">
              <DollarSign className="h-3 w-3" />
              Rate Code
              {hasGroupRate && (
                <span className="flex items-center gap-1 text-primary ml-1">
                  <Lock className="h-3 w-3" />
                  <span className="text-xs">(Group Rate)</span>
                </span>
              )}
            </Label>
            {/* If group has override rate, show fixed rate display */}
            {groupOverrideRate !== null && groupOverrideRate !== undefined ? (
              <div className="flex items-center gap-2">
                <Input 
                  value={`$${groupOverrideRate.toFixed(2)}/night`}
                  disabled
                  className="h-9 bg-muted"
                />
                <span className="text-xs text-muted-foreground">Set by group block</span>
              </div>
            ) : groupRateId ? (
              /* If group has rate code, show locked selector */
              <Select 
                value={groupRateId} 
                disabled
              >
                <SelectTrigger className="h-9 bg-muted">
                  <SelectValue placeholder="Select rate" />
                </SelectTrigger>
                <SelectContent>
                  {rates.map((rate) => (
                    <SelectItem key={rate.id} value={rate.id}>
                      {rate.rate_code} {rate.description ? `- ${rate.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : rates.length > 0 ? (
              /* Normal rate selection when not a group booking */
              <Select 
                value={formData.rateId} 
                onValueChange={(value) => setFormData({ ...formData, rateId: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select rate" />
                </SelectTrigger>
                <SelectContent>
                  {rates.map((rate) => (
                    <SelectItem key={rate.id} value={rate.id}>
                      {rate.rate_code} {rate.description ? `- ${rate.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-muted-foreground text-xs">No rates available</p>
            )}
          </div>
          <div>
            <Label className="text-sm flex items-center gap-1 mb-1">
              <Briefcase className="h-3 w-3" />
              Source of Business
            </Label>
            {sourcesOfBusiness.length > 0 ? (
              <Select 
                value={formData.sourceOfBusinessId} 
                onValueChange={(value) => setFormData({ ...formData, sourceOfBusinessId: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {sourcesOfBusiness.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.code} - {source.definition}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-muted-foreground text-xs">No sources defined</p>
            )}
          </div>
          {/* Add-ons Selection */}
          <div>
            <Label className="text-sm flex items-center gap-1 mb-1">
              <Package className="h-3 w-3" />
              Add-ons
            </Label>
            {availableAddOns.length > 0 ? (
              <Select onValueChange={onAddAddOn} value="">
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Add an item..." />
                </SelectTrigger>
                <SelectContent>
                  {availableAddOns.map((addon) => (
                    <SelectItem key={addon.id} value={addon.id}>
                      {addon.code} - {addon.name} (${addon.price.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-muted-foreground text-xs">No add-ons available</p>
            )}
            {/* Selected Add-ons */}
            {selectedAddOns.length > 0 && (
              <div className="mt-2 space-y-1">
                {selectedAddOns.map((sa) => {
                  const addon = availableAddOns.find(a => a.id === sa.addOnId);
                  if (!addon) return null;
                  return (
                    <div key={sa.addOnId} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1">
                      <span>{addon.code} - {addon.name} x{sa.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={() => onRemoveAddOn(sa.addOnId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Bill to Company */}
      {cityLedgers.length > 0 && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="billToCompany"
                checked={billToCompany}
                onCheckedChange={(checked) => {
                  setBillToCompany(checked === true);
                  if (!checked) {
                    setSelectedCityLedgerId("");
                    setBillingInstructions("");
                  }
                }}
              />
              <Label 
                htmlFor="billToCompany" 
                className="text-sm font-medium flex items-center gap-2 cursor-pointer"
              >
                <Building className="h-4 w-4" />
                Bill to Company (Direct Bill)
              </Label>
            </div>
            
            {/* Show group billing context when pre-selected from group block */}
            {billToCompany && groupBlock?.cityLedgerAccountId === selectedCityLedgerId && groupBlock?.cityLedgerAccountId && (
              <p className="text-xs text-primary flex items-center gap-1 pl-6">
                <Briefcase className="h-3 w-3" />
                Pre-selected from group block settings ({groupBlock.chargeRouting === 'room_and_tax' ? 'Site & Tax Only' : 'All Charges'})
              </p>
            )}
            
            {billToCompany && (
              <div className="space-y-3 pl-6">
                <div>
                  <Label className="text-xs">City Ledger Account</Label>
                  <Select 
                    value={selectedCityLedgerId} 
                    onValueChange={setSelectedCityLedgerId}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select company account" />
                    </SelectTrigger>
                    <SelectContent>
                      {cityLedgers.map((cl) => (
                        <SelectItem key={cl.id} value={cl.id}>
                          {cl.company_name || "Unnamed"} {cl.account_number ? `(${cl.account_number})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Billing Instructions</Label>
                  <Textarea
                    className="h-16 text-sm"
                    placeholder="e.g., Site & tax only. Guest responsible for incidentals."
                    value={billingInstructions}
                    onChange={(e) => setBillingInstructions(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Site Selection (if needed) */}
      {!preselectedSite && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">
              Select {terminology.site}
              {isRoomSpecificBlock && <span className="text-destructive">*</span>}
            </h3>
            {!isRoomSpecificBlock && terminology.isHotel && terminology.isTypeFloating && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Optional</span>
            )}
          </div>
          {isRoomSpecificBlock && (
            <p className="text-sm text-primary mb-2 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Only sites allocated to this group block are shown
            </p>
          )}
          {!isRoomSpecificBlock && terminology.isHotel && terminology.isTypeFloating && !formData.selectedSite && (
            <p className="text-sm text-muted-foreground mb-2">
              {terminology.site} can be assigned at check-in
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {filteredSites.map((site) => (
              <button
                key={site.id}
                onClick={() => setFormData({ ...formData, selectedSite: site.id })}
                className={`p-2 border rounded text-left text-sm transition-all ${
                  formData.selectedSite === site.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">{site.site_number}</div>
                <div className="text-xs text-muted-foreground">Max {site.max_occupancy}</div>
              </button>
            ))}
          </div>
          {filteredSites.length === 0 && isRoomSpecificBlock && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No sites available for this group block
            </p>
          )}
          {/* Clear selection button for type_floating (but not for room-specific blocks) */}
          {!isRoomSpecificBlock && terminology.isHotel && terminology.isTypeFloating && formData.selectedSite && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-muted-foreground"
              onClick={() => setFormData({ ...formData, selectedSite: "" })}
            >
              Clear {terminology.site.toLowerCase()} selection
            </Button>
          )}
        </Card>
      )}
    </div>
  );
};
