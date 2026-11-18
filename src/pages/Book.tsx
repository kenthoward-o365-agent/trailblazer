import { useEffect, useState } from "react";
import { ArrowLeft, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { useBookingData } from "@/hooks/useBookingData";
import { useBookingForm } from "@/hooks/useBookingForm";
import { useQuoteCalculation } from "@/hooks/useQuoteCalculation";
import { useReservationMutation } from "@/hooks/useReservationMutation";
import { BookingStepDetails } from "@/components/booking/BookingStepDetails";
import { BookingStepSite } from "@/components/booking/BookingStepSite";
import { BookingStepGuest } from "@/components/booking/BookingStepGuest";

const Book = () => {
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();

  // Custom hooks for data fetching, form state, quote calculation, and mutations
  const {
    siteTypes,
    defaultRatePrices,
    rates,
    sourcesOfBusiness,
    availableAddOns,
    cityLedgers,
    sites,
    setSites,
    fetchAvailableRates,
    fetchSites,
    fetchSitesByIds,
    fetchRateBundledAddOns,
  } = useBookingData({ propertyId: selectedProperty?.id });

  const {
    step,
    setStep,
    formData,
    setFormData,
    selectedAddOns,
    selectedGuestId,
    preselectedSite,
    editReservationId,
    isEditMode,
    isFromBookingChart,
    groupBlock,
    groupBlockId,
    groupBlockAllocations,
    groupBlockSiteAllocations,
    isRoomSpecificBlock,
    billToCompany,
    setBillToCompany,
    selectedCityLedgerId,
    setSelectedCityLedgerId,
    billingInstructions,
    setBillingInstructions,
    handleGuestSelected,
    handleAddAddOn,
    handleRemoveAddOn,
    applyBundledAddOns,
  } = useBookingForm({
    propertyCountry: selectedProperty?.country,
    setSites,
  });

  const { quote, loading: quoteLoading, calculateQuote, updateQuoteForRateChange, updateQuoteForAddOns } = useQuoteCalculation({
    propertyId: selectedProperty?.id,
  });

  const { loading: mutationLoading, createOrUpdateReservation } = useReservationMutation({
    propertyId: selectedProperty?.id,
    organizationId: selectedProperty?.organization_id,
  });

  const loading = quoteLoading || mutationLoading;
  const [ratesLoading, setRatesLoading] = useState(false);

  // Fetch rates when dates change
  useEffect(() => {
    const fetchRatesForDates = async () => {
      if (formData.checkIn && formData.checkOut) {
        setRatesLoading(true);
        await fetchAvailableRates(formData.checkIn, formData.checkOut);
        setRatesLoading(false);
      }
    };
    fetchRatesForDates();
  }, [formData.checkIn, formData.checkOut]);

  // Fetch sites when site type or requirements change (for non-room-specific blocks)
  useEffect(() => {
    if (formData.siteType && !preselectedSite && !isRoomSpecificBlock) {
      fetchSites(formData.siteType, formData.siteRequirements);
    }
  }, [formData.siteType, preselectedSite, isRoomSpecificBlock, formData.siteRequirements]);

  // Fetch specific sites for room-specific group blocks
  useEffect(() => {
    if (isRoomSpecificBlock && groupBlockSiteAllocations.length > 0) {
      const siteIds = groupBlockSiteAllocations.map(a => a.site_id);
      fetchSitesByIds(siteIds);
    }
  }, [isRoomSpecificBlock, groupBlockSiteAllocations]);

  // Update quote when add-ons change
  useEffect(() => {
    if (quote && selectedAddOns) {
      updateQuoteForAddOns(quote, selectedAddOns, availableAddOns);
    }
  }, [selectedAddOns]);

  // Get the current group block override rate based on selected room or room type
  const getGroupBlockOverrideRate = (): number | null => {
    if (isRoomSpecificBlock && formData.selectedSite) {
      const siteAllocation = groupBlockSiteAllocations.find(a => a.site_id === formData.selectedSite);
      return siteAllocation?.override_rate ?? null;
    } else if (isRoomSpecificBlock && groupBlockSiteAllocations.length > 0) {
      // Use first allocation's rate for initial quote
      return groupBlockSiteAllocations[0]?.override_rate ?? null;
    } else if (groupBlockAllocations.length > 0) {
      const typeAllocation = groupBlockAllocations.find(a => a.site_type_id === formData.siteType);
      return typeAllocation?.override_rate ?? null;
    }
    return null;
  };

  // Handle quote calculation
  const handleCalculateQuote = async () => {
    if (!formData.checkIn || !formData.checkOut || !formData.siteType) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Fetch rates for the date range first
    const fetchedRates = await fetchAvailableRates(formData.checkIn, formData.checkOut);
    
    // Get override rate from group block if applicable
    const overrideRate = getGroupBlockOverrideRate();
    
    // Determine which rate will be used BEFORE calculating quote
    let rateIdToUse = formData.rateId;
    if (!rateIdToUse && !overrideRate && fetchedRates && fetchedRates.length > 0) {
      const defaultRate = fetchedRates.find(r => r.is_default);
      rateIdToUse = (defaultRate || fetchedRates[0]).id;
    }
    
    // Fetch and apply bundled add-ons BEFORE calculating quote
    let addOnsForQuote = selectedAddOns;
    if (rateIdToUse) {
      const bundledAddOnIds = await fetchRateBundledAddOns(rateIdToUse);
      if (bundledAddOnIds.length > 0) {
        // Calculate what the new add-ons array will be
        const nonBundled = selectedAddOns.filter(a => !a.isBundled);
        const existingIds = nonBundled.map(a => a.addOnId);
        const newBundled = bundledAddOnIds
          .filter(id => !existingIds.includes(id))
          .map(id => ({ addOnId: id, quantity: 1, isBundled: true }));
        addOnsForQuote = [...nonBundled, ...newBundled];
        
        // Apply to state as well
        applyBundledAddOns(bundledAddOnIds);
      }
    }
    
    const result = await calculateQuote({
      checkIn: formData.checkIn,
      checkOut: formData.checkOut,
      siteTypeId: formData.siteType,
      guestCount: parseInt(formData.guests),
      selectedRateId: rateIdToUse || formData.rateId,
      rates: fetchedRates || rates,
      selectedAddOns: addOnsForQuote,
      availableAddOns,
      overrideRate,
    });
    
    if (result) {
      // Set the rate in form data if it was auto-selected
      if (!formData.rateId && rateIdToUse) {
        setFormData(prev => ({ ...prev, rateId: rateIdToUse }));
      }
      // Auto-select default source of business
      if (!formData.sourceOfBusinessId && sourcesOfBusiness.length > 0) {
        const defaultSource = sourcesOfBusiness.find(s => s.is_default);
        if (defaultSource) {
          setFormData(prev => ({ ...prev, sourceOfBusinessId: defaultSource.id }));
        }
      }
      toast.success("Quote calculated!");
      setStep(2);
    } else {
      toast.error("Failed to calculate quote");
    }
  };

  // Handle rate changes to update quote
  const handleRateChange = async (newRateId: string) => {
    if (quote) {
      // Fetch bundled add-ons for the new rate FIRST
      const bundledAddOnIds = await fetchRateBundledAddOns(newRateId);
      
      // Calculate the updated add-ons array
      const nonBundled = selectedAddOns.filter(a => !a.isBundled);
      const existingIds = nonBundled.map(a => a.addOnId);
      const newBundled = bundledAddOnIds
        .filter(id => !existingIds.includes(id))
        .map(id => ({ addOnId: id, quantity: 1, isBundled: true }));
      const updatedAddOns = [...nonBundled, ...newBundled];
      
      // Apply to state
      applyBundledAddOns(bundledAddOnIds);

      // Now update quote WITH the new add-ons
      await updateQuoteForRateChange({
        currentQuote: quote,
        newRateId,
        rates,
        siteTypeId: formData.siteType,
        guestCount: parseInt(formData.guests),
        selectedAddOns: updatedAddOns,
        availableAddOns,
      });
    }
  };

  // Handle reservation creation/update
  const handleCreateReservation = async () => {
    // Validate room/site assignment based on inventory mode
    const roomRequired = terminology.isHotel ? terminology.isUnitRequired : true;
    
    // Room-specific blocks always require room selection
    const isRoomRequiredForBlock = isRoomSpecificBlock;
    
    if ((roomRequired || isRoomRequiredForBlock) && !formData.selectedSite) {
      toast.error(`Please select a ${terminology.site.toLowerCase()} for this reservation`);
      return;
    }

    if (!formData.email || !formData.firstName || !formData.lastName) {
      toast.error("Please complete all guest information");
      return;
    }

    if (!quote) {
      toast.error("No quote available");
      return;
    }

    // Get the override rate to pass to the mutation
    const groupBlockOverrideRate = getGroupBlockOverrideRate();

    await createOrUpdateReservation({
      formData,
      quote,
      selectedGuestId,
      isEditMode,
      editReservationId,
      selectedAddOns,
      availableAddOns,
      groupBlockId,
      billToCompany,
      selectedCityLedgerId,
      billingInstructions,
      groupBlockOverrideRate,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4 flex items-center gap-3 md:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg md:text-2xl font-bold text-primary truncate">{selectedProperty?.name || "Property"}</h1>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4 md:mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">{isEditMode ? "Update Reservation" : "Book Your Stay"}</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Step {step} of 3: {step === 1 ? "Get Quote" : step === 2 ? "Reservation Details" : isEditMode ? "Confirm Changes" : "Confirm Booking"}
            </p>
          </div>


          {/* Group Block Info Banner */}
          {groupBlock && (
            <Card className="p-4 mb-6 border-primary/50 bg-primary/5">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold text-primary">Group Block: {groupBlock.code}</p>
                  {groupBlock.description && (
                    <p className="text-sm text-muted-foreground">{groupBlock.description}</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {step === 1 && (
            <BookingStepDetails
              formData={formData}
              setFormData={setFormData}
              terminology={terminology}
              preselectedSite={preselectedSite}
              siteTypes={siteTypes}
              defaultRatePrices={defaultRatePrices}
              loading={loading}
              isEditMode={isEditMode}
              isFromBookingChart={isFromBookingChart}
              groupBlockAllocations={groupBlockAllocations}
              groupBlockSiteAllocations={groupBlockSiteAllocations}
              isRoomSpecificBlock={isRoomSpecificBlock}
              allowOtherRoomTypes={groupBlock?.allowOtherRoomTypes}
              rates={rates}
              ratesLoading={ratesLoading}
              onCalculateQuote={handleCalculateQuote}
            />
          )}

          {step === 2 && quote && (
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Left Column - Quote, Rate/Source, Site Selection */}
              <BookingStepSite
                quote={quote}
                formData={formData}
                setFormData={(newFormData) => {
                  if (typeof newFormData === 'function') {
                    setFormData(prev => {
                      const result = newFormData(prev);
                      // Trigger rate update if rateId changed
                      if (result.rateId !== prev.rateId) {
                        handleRateChange(result.rateId);
                      }
                      return result;
                    });
                  } else {
                    if (newFormData.rateId !== formData.rateId) {
                      handleRateChange(newFormData.rateId);
                    }
                    setFormData(newFormData);
                  }
                }}
                rates={rates}
                sourcesOfBusiness={sourcesOfBusiness}
                availableAddOns={availableAddOns}
                selectedAddOns={selectedAddOns}
                cityLedgers={cityLedgers}
                sites={sites}
                terminology={terminology}
                preselectedSite={preselectedSite}
                billToCompany={billToCompany}
                setBillToCompany={setBillToCompany}
                selectedCityLedgerId={selectedCityLedgerId}
                setSelectedCityLedgerId={setSelectedCityLedgerId}
                billingInstructions={billingInstructions}
                setBillingInstructions={setBillingInstructions}
                onAddAddOn={handleAddAddOn}
                onRemoveAddOn={handleRemoveAddOn}
                groupBlockAllocations={groupBlockAllocations}
                groupBlockSiteAllocations={groupBlockSiteAllocations}
                isRoomSpecificBlock={isRoomSpecificBlock}
                groupBlock={groupBlock}
              />

              {/* Right Column - Guest Information */}
              <BookingStepGuest
                formData={formData}
                setFormData={setFormData}
                selectedGuestId={selectedGuestId}
                onGuestSelected={handleGuestSelected}
                selectedProperty={selectedProperty}
                loading={loading}
                isEditMode={isEditMode}
                onBack={() => setStep(1)}
                onSubmit={handleCreateReservation}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Book;
