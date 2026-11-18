import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getRevenueAccountTaxes,
  calculateTaxes,
  getTotalTaxAmount,
  CalculatedTax,
} from "@/lib/taxCalculations";
import type { QuoteDetails, SelectedAddOn, AddOn, Rate } from "@/types/booking";

export type { QuoteDetails };

// Helper function to apply derived rate adjustments
export const applyAdjustment = (
  basePrice: number,
  adjustmentType: string,
  adjustmentValue: number
): number => {
  switch (adjustmentType) {
    case "percent_up":
      return basePrice * (1 + adjustmentValue / 100);
    case "percent_down":
      return basePrice * (1 - adjustmentValue / 100);
    case "amount_up":
      return basePrice + adjustmentValue;
    case "amount_down":
      return basePrice - adjustmentValue;
    default:
      return basePrice;
  }
};

interface UseQuoteCalculationProps {
  propertyId: string | undefined;
}

export const useQuoteCalculation = ({ propertyId }: UseQuoteCalculationProps) => {
  const [quote, setQuote] = useState<QuoteDetails | null>(null);
  const [loading, setLoading] = useState(false);

  // Calculate taxes for a rate
  const calculateTaxesForQuote = async (
    revenueAmount: number,
    rate: Rate | undefined,
    days: number,
    guestCount: number
  ): Promise<CalculatedTax[]> => {
    if (!rate?.revenue_account_id) return [];

    const taxConfigs = await getRevenueAccountTaxes(rate.revenue_account_id);
    return calculateTaxes(revenueAmount, taxConfigs, {
      numberOfDays: days,
      numberOfAdults: guestCount,
    });
  };

  // Calculate add-ons total
  const calculateAddOnsTotal = (
    selectedAddOns: SelectedAddOn[],
    availableAddOns: AddOn[],
    days: number
  ): number => {
    return selectedAddOns.reduce((total, sa) => {
      const addon = availableAddOns.find((a) => a.id === sa.addOnId);
      if (!addon) return total;
      // Nightly add-ons multiply by days
      const multiplier = addon.charge_type === "nightly" ? days : 1;
      return total + addon.price * sa.quantity * multiplier;
    }, 0);
  };

  // Main quote calculation
  const calculateQuote = async (params: {
    checkIn: string;
    checkOut: string;
    siteTypeId: string;
    guestCount: number;
    selectedRateId: string;
    rates: Rate[];
    selectedAddOns: SelectedAddOn[];
    availableAddOns: AddOn[];
    overrideRate?: number | null;
  }): Promise<QuoteDetails | null> => {
    const {
      checkIn,
      checkOut,
      siteTypeId,
      guestCount,
      selectedRateId,
      rates,
      selectedAddOns,
      availableAddOns,
      overrideRate,
    } = params;

    if (!checkIn || !checkOut || !siteTypeId || !propertyId) {
      return null;
    }

    setLoading(true);

    try {
      // Calculate days
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      const days = Math.ceil(
        (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (days <= 0) {
        setLoading(false);
        return null;
      }

      // Get site type for fallback price
      const { data: siteType } = await supabase
        .from("site_types")
        .select("*")
        .eq("id", siteTypeId)
        .single();

      if (!siteType) {
        setLoading(false);
        return null;
      }

      // Determine base price using smart fallback chain
      // If override rate is provided (from group block), use it directly
      let basePrice: number;
      let selectedRate = rates.find((r) => r.id === selectedRateId);

      if (overrideRate !== null && overrideRate !== undefined) {
        // Use group block override rate directly
        basePrice = overrideRate;
      } else {
        // Normal rate lookup
        basePrice = parseFloat(String(siteType.base_price));

        if (!selectedRate && rates.length > 0) {
          const defaultRate = rates.find((r) => r.is_default);
          selectedRate = defaultRate || rates[0];
        }

        if (selectedRate) {
          // Get rate-specific price for site type
          const { data: ratePrice } = await supabase
            .from("rate_site_type_prices")
            .select("price")
            .eq("rate_id", selectedRate.id)
            .eq("site_type_id", siteTypeId)
            .single();

          if (ratePrice) {
            basePrice = ratePrice.price;
          }

          // If derived rate, apply adjustment
          if (!selectedRate.is_base_rate && selectedRate.base_rate_id) {
            const { data: baseRatePrice } = await supabase
              .from("rate_site_type_prices")
              .select("price")
              .eq("rate_id", selectedRate.base_rate_id)
              .eq("site_type_id", siteTypeId)
              .single();

            if (
              baseRatePrice &&
              selectedRate.adjustment_type &&
              selectedRate.adjustment_value !== null
            ) {
              basePrice = applyAdjustment(
                baseRatePrice.price,
                selectedRate.adjustment_type,
                selectedRate.adjustment_value
              );
            }
          }
        }
      }

      // Get seasons for price multiplier
      let seasonMultiplier = 1;
      const { data: seasons } = await supabase
        .from("seasons")
        .select("id, name, start_date, end_date, multiplier")
        .lte("start_date", checkIn)
        .gte("end_date", checkOut)
        .limit(1);

      if (seasons && seasons.length > 0) {
        seasonMultiplier = parseFloat(String(seasons[0].multiplier));
      }

      // Get rate rules
      let weekendMultiplier = 1;
      let losDiscount = 0;

      // Check for weekend days
      const checkInDate2 = new Date(checkIn);
      const isWeekend = checkInDate2.getDay() === 5 || checkInDate2.getDay() === 6;
      if (isWeekend) {
        const { data: weekendRule } = await supabase
          .from("rate_rules")
          .select("id, rule_type, multiplier")
          .eq("rule_type", "weekend")
          .limit(1)
          .maybeSingle();

        if (weekendRule?.multiplier) {
          weekendMultiplier = parseFloat(String(weekendRule.multiplier));
        }
      }

      // Check for LOS discount
      const { data: losRules } = await supabase
        .from("rate_rules")
        .select("id, rule_type, discount_amount, conditions")
        .eq("rule_type", "los_discount")
        .order("conditions->min_nights", { ascending: false });

      if (losRules) {
        for (const rule of losRules) {
          const conditions = rule.conditions as { min_nights?: number } | null;
          const minNights = conditions?.min_nights || 0;
          if (days >= minNights && rule.discount_amount) {
            losDiscount = parseFloat(String(rule.discount_amount));
            break;
          }
        }
      }

      // Calculate subtotal
      const subtotal = basePrice * days * seasonMultiplier * weekendMultiplier - losDiscount;

      // Calculate add-ons
      const addOnsTotal = calculateAddOnsTotal(selectedAddOns, availableAddOns, days);

      // Calculate taxes on room revenue only
      const taxes = await calculateTaxesForQuote(subtotal, selectedRate, days, guestCount);
      const totalTax = getTotalTaxAmount(taxes);

      const quoteResult: QuoteDetails = {
        siteTypeName: siteType.name,
        days,
        basePrice,
        seasonMultiplier,
        weekendMultiplier,
        losDiscount,
        subtotal: parseFloat(subtotal.toFixed(2)),
        addOnsTotal,
        taxes,
        totalTax,
        totalPrice: parseFloat((subtotal + addOnsTotal + totalTax).toFixed(2)),
      };

      setQuote(quoteResult);
      setLoading(false);
      return quoteResult;
    } catch (error) {
      console.error("Quote calculation error:", error);
      setLoading(false);
      return null;
    }
  };

  // Update quote when rate or add-ons change
  const updateQuoteForRateChange = async (params: {
    currentQuote: QuoteDetails;
    newRateId: string;
    rates: Rate[];
    siteTypeId: string;
    guestCount: number;
    selectedAddOns: SelectedAddOn[];
    availableAddOns: AddOn[];
  }): Promise<QuoteDetails | null> => {
    const {
      currentQuote,
      newRateId,
      rates,
      siteTypeId,
      guestCount,
      selectedAddOns,
      availableAddOns,
    } = params;

    const newRate = rates.find((r) => r.id === newRateId);
    if (!newRate || !currentQuote) return null;

    setLoading(true);

    try {
      // Get new base price for the rate
      let basePrice = currentQuote.basePrice;

      const { data: ratePrice } = await supabase
        .from("rate_site_type_prices")
        .select("price")
        .eq("rate_id", newRateId)
        .eq("site_type_id", siteTypeId)
        .single();

      if (ratePrice) {
        basePrice = ratePrice.price;
      }

      // Apply derived rate adjustment if applicable
      if (!newRate.is_base_rate && newRate.base_rate_id) {
        const { data: baseRatePrice } = await supabase
          .from("rate_site_type_prices")
          .select("price")
          .eq("rate_id", newRate.base_rate_id)
          .eq("site_type_id", siteTypeId)
          .single();

        if (
          baseRatePrice &&
          newRate.adjustment_type &&
          newRate.adjustment_value !== null
        ) {
          basePrice = applyAdjustment(
            baseRatePrice.price,
            newRate.adjustment_type,
            newRate.adjustment_value
          );
        }
      }

      const subtotal =
        basePrice *
          currentQuote.days *
          currentQuote.seasonMultiplier *
          currentQuote.weekendMultiplier -
        currentQuote.losDiscount;

      const addOnsTotal = calculateAddOnsTotal(
        selectedAddOns,
        availableAddOns,
        currentQuote.days
      );

      const taxes = await calculateTaxesForQuote(
        subtotal,
        newRate,
        currentQuote.days,
        guestCount
      );
      const totalTax = getTotalTaxAmount(taxes);

      const updatedQuote: QuoteDetails = {
        ...currentQuote,
        basePrice,
        subtotal: parseFloat(subtotal.toFixed(2)),
        addOnsTotal,
        taxes,
        totalTax,
        totalPrice: parseFloat((subtotal + addOnsTotal + totalTax).toFixed(2)),
      };

      setQuote(updatedQuote);
      setLoading(false);
      return updatedQuote;
    } catch (error) {
      console.error("Rate update error:", error);
      setLoading(false);
      return null;
    }
  };

  // Recalculate with new add-ons
  const updateQuoteForAddOns = (
    currentQuote: QuoteDetails,
    selectedAddOns: SelectedAddOn[],
    availableAddOns: AddOn[]
  ): QuoteDetails => {
    const addOnsTotal = calculateAddOnsTotal(
      selectedAddOns,
      availableAddOns,
      currentQuote.days
    );

    const updatedQuote: QuoteDetails = {
      ...currentQuote,
      addOnsTotal,
      totalPrice: parseFloat(
        (currentQuote.subtotal + addOnsTotal + currentQuote.totalTax).toFixed(2)
      ),
    };

    setQuote(updatedQuote);
    return updatedQuote;
  };

  return {
    quote,
    setQuote,
    loading,
    calculateQuote,
    updateQuoteForRateChange,
    updateQuoteForAddOns,
  };
};
