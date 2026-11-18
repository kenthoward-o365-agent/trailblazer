import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getRevenueAccountTaxes, calculateTaxes, getTotalTaxAmount, CalculatedTax } from "@/lib/taxCalculations";

export interface ChargesBreakdown {
  subtotal: number;
  taxes: CalculatedTax[];
  totalTax: number;
  total: number;
  days: number;
  basePrice: number;
  rateName: string | null;
}

export interface GuaranteeOption {
  id: string;
  code: string;
  description: string;
}

export interface PaymentCard {
  id: string;
  cardholder_name: string;
  card_brand: string;
  last_four_digits: string;
  expiry_month: number;
  expiry_year: number;
  is_primary: boolean;
}

export const useConfirmation = (reservationId: string | undefined) => {
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [chargesBreakdown, setChargesBreakdown] = useState<ChargesBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  
  // Payment details state
  const [guaranteeOptions, setGuaranteeOptions] = useState<GuaranteeOption[]>([]);
  const [selectedGuarantee, setSelectedGuarantee] = useState<string>("");
  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);
  const [hasDeposits, setHasDeposits] = useState(false);

  const isCardRequired = selectedGuarantee.toUpperCase() === "CARD";
  const hasValidCard = paymentCards.length > 0;
  const canConfirm = !isCardRequired || hasValidCard;

  useEffect(() => {
    if (reservationId) {
      fetchReservation();
      fetchGuaranteeOptions();
    }
  }, [reservationId]);

  useEffect(() => {
    if (reservationId) {
      fetchPaymentCards();
      checkForDeposits();
    }
  }, [reservationId]);

  const checkForDeposits = async () => {
    if (!reservationId) return;
    
    const { data } = await supabase
      .from("ledger_accounts")
      .select("balance")
      .eq("reservation_id", reservationId)
      .eq("ledger_type", "advance_deposit")
      .gt("balance", 0)
      .maybeSingle();

    setHasDeposits(!!data);
  };

  const fetchGuaranteeOptions = async () => {
    try {
      const { data: properties } = await supabase
        .from("properties")
        .select("id")
        .limit(1)
        .single();

      if (properties) {
        const { data: options } = await supabase
          .from("guarantee_options")
          .select("id, code, description")
          .eq("property_id", properties.id)
          .eq("is_active", true)
          .order("sort_order");

        if (options && options.length > 0) {
          setGuaranteeOptions(options);
          setSelectedGuarantee(options[0].code);
        }
      }
    } catch (error) {
      console.error("Error fetching guarantee options:", error);
    }
  };

  const fetchPaymentCards = async () => {
    if (!reservationId) return;
    
    const { data } = await supabase
      .from("payment_cards")
      .select("*")
      .eq("reservation_id", reservationId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    setPaymentCards(data || []);
  };

  const fetchReservation = async () => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, sites(*, site_types(*)), guests(*), rates(rate_code, revenue_account_id, deposit_requirement)")
        .eq("id", reservationId)
        .single();

      if (error) throw error;
      setReservation(data);

      await calculateChargesBreakdownFn(data);

      const { data: recs } = await supabase
        .from("reservation_recommendations")
        .select("*")
        .eq("reservation_id", reservationId)
        .maybeSingle();

      if (recs) {
        setRecommendations(recs);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch reservation");
    } finally {
      setLoading(false);
    }
  };

  const calculateChargesBreakdownFn = async (res: any) => {
    const days = Math.ceil(
      (new Date(res.check_out_date).getTime() - new Date(res.check_in_date).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    
    const basePrice = res.sites?.site_types?.base_price || 0;
    const subtotal = parseFloat(res.total_price);
    
    let taxes: CalculatedTax[] = [];
    let totalTax = 0;
    
    if (res.rates?.revenue_account_id) {
      const taxConfigs = await getRevenueAccountTaxes(res.rates.revenue_account_id);
      const estimatedSubtotal = subtotal;
      taxes = calculateTaxes(estimatedSubtotal, taxConfigs, { 
        numberOfDays: days, 
        numberOfAdults: res.guests_count 
      });
      totalTax = getTotalTaxAmount(taxes);
    }
    
    setChargesBreakdown({
      subtotal,
      taxes,
      totalTax,
      total: subtotal + totalTax,
      days,
      basePrice: parseFloat(basePrice),
      rateName: res.rates?.rate_code || null,
    });
  };

  const confirmReservation = async () => {
    if (isCardRequired && !hasValidCard) {
      toast.error("A credit card is required to guarantee this reservation");
      return;
    }

    setConfirming(true);
    try {
      const { error: updateError } = await supabase
        .from("reservations")
        .update({ status: "CONFIRMED" })
        .eq("id", reservationId);

      if (updateError) throw updateError;

      const { data: aiData, error: aiError } = await supabase.functions.invoke("get-recommendations", {
        body: { reservationId },
      });

      if (aiError) {
        console.error("AI recommendations failed:", aiError);
        toast.error("Confirmed! (AI recommendations unavailable)");
      } else {
        setRecommendations(aiData);
        toast.success("Reservation confirmed with AI recommendations!");
      }

      await fetchReservation();
    } catch (error) {
      console.error(error);
      toast.error("Failed to confirm reservation");
    } finally {
      setConfirming(false);
    }
  };

  const cancelReservation = async () => {
    setCancelling(true);
    try {
      await supabase
        .from("payment_cards")
        .delete()
        .eq("reservation_id", reservationId);
      
      await supabase
        .from("reservation_add_ons")
        .delete()
        .eq("reservation_id", reservationId);
      
      const { error } = await supabase
        .from("reservations")
        .delete()
        .eq("id", reservationId);
      
      if (error) throw error;
      
      toast.success("Reservation cancelled");
      navigate("/reservations");
    } catch (error) {
      console.error(error);
      toast.error("Failed to cancel reservation");
    } finally {
      setCancelling(false);
    }
  };

  const getCardIcon = (brand: string) => {
    const colors: Record<string, string> = {
      Visa: "bg-blue-600",
      Mastercard: "bg-orange-500",
      Amex: "bg-blue-400",
      Discover: "bg-orange-400",
      Unknown: "bg-gray-500",
    };
    return colors[brand] || colors.Unknown;
  };

  return {
    reservation,
    recommendations,
    chargesBreakdown,
    loading,
    confirming,
    cancelling,
    guaranteeOptions,
    selectedGuarantee,
    setSelectedGuarantee,
    paymentCards,
    isCardRequired,
    hasValidCard,
    canConfirm,
    hasDeposits,
    confirmReservation,
    cancelReservation,
    fetchPaymentCards,
    checkForDeposits,
    getCardIcon,
  };
};
