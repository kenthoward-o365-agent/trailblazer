import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, DollarSign, Package, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";

interface AddOn {
  id: string;
  code: string;
  name: string;
  price: number;
}

interface Rate {
  id: string;
  rate_code: string;
  description: string;
  start_date: string;
  end_date: string;
  is_base_rate: boolean;
  base_rate_id: string | null;
  revenue_account_id: string | null;
  deposit_requirement: string;
  is_default: boolean;
  show_on_booking_chart?: boolean;
  show_on_booking_engine?: boolean;

}

interface RevenueAccount {
  id: string;
  code: string;
  name: string;
}

interface SiteType {
  id: string;
  name: string;
  base_price: number;
}

interface RatePrice {
  id: string;
  rate_id: string;
  site_type_id: string;
  price: number;
  adjustment_type: string;
  adjustment_value: number | null;
  site_types?: { name: string };
}

interface RateSeason {
  id: string;
  rate_id: string;
  season_name: string;
  start_date: string;
  end_date: string;
  multiplier: number;
  adjustment_type: string;
  adjustment_value: number;
}

const Rates = () => {
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();
  const [rates, setRates] = useState<Rate[]>([]);
  const [siteTypes, setSiteTypes] = useState<SiteType[]>([]);
  const [revenueAccounts, setRevenueAccounts] = useState<RevenueAccount[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [ratePrices, setRatePrices] = useState<RatePrice[]>([]);
  const [rateSeasons, setRateSeasons] = useState<RateSeason[]>([]);
  const [rateAddOns, setRateAddOns] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seasonDialogOpen, setSeasonDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<Rate | null>(null);

  // Form states
  const [rateCode, setRateCode] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isBaseRate, setIsBaseRate] = useState(true);
  const [baseRateId, setBaseRateId] = useState("");
  const [revenueAccountId, setRevenueAccountId] = useState("");
  const [depositRequirement, setDepositRequirement] = useState("none");
  const [isDefaultRate, setIsDefaultRate] = useState(false);
  const [showOnBookingChart, setShowOnBookingChart] = useState(false);
  const [showOnBookingEngine, setShowOnBookingEngine] = useState(false);

  const [sitePrices, setSitePrices] = useState<Record<string, { price: string; adjustmentType: string; adjustmentValue: string }>>({});
  
  // Derived rate adjustment (single global adjustment)
  const [derivedAdjustmentType, setDerivedAdjustmentType] = useState("percent_up");
  const [derivedAdjustmentValue, setDerivedAdjustmentValue] = useState("");

  // Season form states
  const [seasonName, setSeasonName] = useState("");
  const [seasonStartDate, setSeasonStartDate] = useState("");
  const [seasonEndDate, setSeasonEndDate] = useState("");
  const [seasonAdjustmentType, setSeasonAdjustmentType] = useState("percent_up");
  const [seasonAdjustmentValue, setSeasonAdjustmentValue] = useState("");

  // Selected add-ons for the rate
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  useEffect(() => {
    if (selectedProperty?.id) {
      loadInitialData();
    }
  }, [selectedProperty?.id]);

  useEffect(() => {
    if (selectedRate) {
      loadRateDetails(selectedRate.id);
    }
  }, [selectedRate]);

  // Pre-populate sitePrices with base_price from site_types when creating a new base rate
  useEffect(() => {
    if (dialogOpen && !editingRate && isBaseRate && siteTypes.length > 0) {
      const initialPrices: Record<string, { price: string; adjustmentType: string; adjustmentValue: string }> = {};
      siteTypes.forEach(st => {
        initialPrices[st.id] = {
          price: st.base_price.toString(),
          adjustmentType: "base",
          adjustmentValue: "",
        };
      });
      setSitePrices(initialPrices);
    }
  }, [dialogOpen, editingRate, isBaseRate, siteTypes]);

  const loadInitialData = async () => {
    if (!selectedProperty?.id) return;

    // Load site types
    const { data: siteTypesData } = await supabase
      .from("site_types")
      .select("*")
      .eq("property_id", selectedProperty.id);
    setSiteTypes(siteTypesData || []);

    // Load revenue accounts
    const { data: revenueAccountsData } = await supabase
      .from("accounts")
      .select(`
        id, code, name,
        account_groups!inner(account_type)
      `)
      .eq("property_id", selectedProperty.id)
      .eq("account_groups.account_type", "revenue")
      .eq("is_active", true)
      .order("code");
    
    setRevenueAccounts(
      (revenueAccountsData || []).map((acc: any) => ({
        id: acc.id,
        code: acc.code,
        name: acc.name,
      }))
    );

    // Load add-ons
    const { data: addOnsData } = await supabase
      .from("add_ons")
      .select("id, code, name, price")
      .eq("property_id", selectedProperty.id)
      .eq("is_active", true)
      .order("code");
    
    setAddOns(addOnsData || []);

    // Load rates
    loadRates();
  };

  const loadRates = async () => {
    if (!selectedProperty?.id) return;
    
    const { data, error } = await supabase
      .from("rates")
      .select("*")
      .eq("property_id", selectedProperty.id)
      .order("start_date", { ascending: false });

    if (error) {
      toast.error("Failed to load rates");
    } else {
      setRates(data || []);
      if (data && data.length > 0 && !selectedRate) {
        setSelectedRate(data[0]);
      }
    }
  };

  const loadRateDetails = async (rateId: string) => {
    // Load rate prices
    const { data: pricesData } = await supabase
      .from("rate_site_type_prices")
      .select("*, site_types(name)")
      .eq("rate_id", rateId);

    setRatePrices(pricesData || []);

    // Load rate seasons
    const { data: seasonsData } = await supabase
      .from("rate_seasons")
      .select("*")
      .eq("rate_id", rateId)
      .order("start_date", { ascending: true });

    setRateSeasons(seasonsData || []);

    // Load rate add-ons
    const { data: rateAddOnsData } = await supabase
      .from("rate_add_ons")
      .select("add_on_id")
      .eq("rate_id", rateId);

    setRateAddOns((rateAddOnsData || []).map(ra => ra.add_on_id));
  };

  const handleCreateRate = async () => {
    if (!rateCode || !startDate || !endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    // For derived rates, validate base rate and adjustment
    if (!isBaseRate) {
      if (!baseRateId) {
        toast.error("Please select a base rate for derived rate");
        return;
      }
      if (!derivedAdjustmentValue) {
        toast.error("Please enter an adjustment value");
        return;
      }
    }

    // Create rate - include adjustment fields for derived rates
    const adjustmentVal = !isBaseRate ? (parseFloat(derivedAdjustmentValue) || 0) : null;
    const { data: newRate, error: rateError } = await supabase
      .from("rates")
      .insert({
        property_id: selectedProperty?.id,
        rate_code: rateCode,
        description,
        start_date: startDate,
        end_date: endDate,
        is_base_rate: isBaseRate,
        base_rate_id: isBaseRate ? null : baseRateId || null,
        revenue_account_id: revenueAccountId || null,
        deposit_requirement: depositRequirement,
        is_default: isDefaultRate,
        show_on_booking_chart: showOnBookingChart,
        show_on_booking_engine: showOnBookingEngine,

        adjustment_type: !isBaseRate ? derivedAdjustmentType : null,
        adjustment_value: adjustmentVal,
      })
      .select()
      .single();

    if (rateError) {
      toast.error("Failed to create rate");
      return;
    }

    // For base rates: create rate prices for each site type from form
    // For derived rates: calculate prices from base rate using global adjustment
    if (isBaseRate) {
      const priceInserts = Object.entries(sitePrices).map(([siteTypeId, priceData]) => ({
        rate_id: newRate.id,
        property_id: selectedProperty!.id,
        site_type_id: siteTypeId,
        price: parseFloat(priceData.price) || 0,
        adjustment_type: "base",
        adjustment_value: null,
      }));

      if (priceInserts.length > 0) {
        const { error: pricesError } = await supabase
          .from("rate_site_type_prices")
          .insert(priceInserts);

        if (pricesError) {
          toast.error("Failed to create rate prices");
          return;
        }
      }
    } else {
      // For derived rate: get base rate prices and calculate derived prices
      const { data: basePrices } = await supabase
        .from("rate_site_type_prices")
        .select("*")
        .eq("rate_id", baseRateId);

      if (basePrices && basePrices.length > 0) {
        const adjustmentVal = parseFloat(derivedAdjustmentValue) || 0;
        const priceInserts = basePrices.map((bp) => {
          const derivedPrice = calculateDerivedPrice(bp.price, derivedAdjustmentType, adjustmentVal);
          return {
            rate_id: newRate.id,
            property_id: selectedProperty!.id,
            site_type_id: bp.site_type_id,
            price: derivedPrice,
            adjustment_type: derivedAdjustmentType,
            adjustment_value: adjustmentVal,
          };
        });

        const { error: pricesError } = await supabase
          .from("rate_site_type_prices")
          .insert(priceInserts);

        if (pricesError) {
          toast.error("Failed to create derived rate prices");
          return;
        }
      }
    }

    // Save rate add-ons
    if (selectedAddOns.length > 0) {
      const addOnInserts = selectedAddOns.map(addOnId => ({
        rate_id: newRate.id,
        add_on_id: addOnId,
      }));

      const { error: addOnsError } = await supabase
        .from("rate_add_ons")
        .insert(addOnInserts);

      if (addOnsError) {
        console.error("Failed to save rate add-ons:", addOnsError);
      }
    }

    toast.success("Rate created successfully");
    setDialogOpen(false);
    resetForm();
    loadRates();
  };

  const handleCreateSeason = async () => {
    if (!selectedRate || !seasonName || !seasonStartDate || !seasonEndDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Calculate multiplier from adjustment for backward compatibility
    const adjustmentVal = parseFloat(seasonAdjustmentValue) || 0;
    let multiplier = 1.0;
    switch (seasonAdjustmentType) {
      case "percent_up":
        multiplier = 1 + adjustmentVal / 100;
        break;
      case "percent_down":
        multiplier = 1 - adjustmentVal / 100;
        break;
      case "dollar_up":
      case "dollar_down":
        // For dollar adjustments, set multiplier to 1 (will use adjustment_value directly)
        multiplier = 1;
        break;
    }

    const { error } = await supabase.from("rate_seasons").insert({
      rate_id: selectedRate.id,
      season_name: seasonName,
      start_date: seasonStartDate,
      end_date: seasonEndDate,
      multiplier,
      adjustment_type: seasonAdjustmentType,
      adjustment_value: adjustmentVal,
    });

    if (error) {
      toast.error("Failed to create season");
    } else {
      toast.success("Season created successfully");
      setSeasonDialogOpen(false);
      resetSeasonForm();
      loadRateDetails(selectedRate.id);
    }
  };

  const handleDeleteSeason = async (seasonId: string) => {
    const { error } = await supabase.from("rate_seasons").delete().eq("id", seasonId);

    if (error) {
      toast.error("Failed to delete season");
    } else {
      toast.success("Season deleted successfully");
      if (selectedRate) {
        loadRateDetails(selectedRate.id);
      }
    }
  };

  const resetForm = () => {
    setRateCode("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setIsBaseRate(true);
    setBaseRateId("");
    setRevenueAccountId("");
    setDepositRequirement("none");
    setIsDefaultRate(false);
    setShowOnBookingChart(false);
    setShowOnBookingEngine(false);

    setSitePrices({});
    setDerivedAdjustmentType("percent_up");
    setDerivedAdjustmentValue("");
    setSelectedAddOns([]);
    setEditingRate(null);
  };

  const handleEditRate = (rate: Rate) => {
    setEditingRate(rate);
    setRateCode(rate.rate_code);
    setDescription(rate.description || "");
    setStartDate(rate.start_date);
    setEndDate(rate.end_date);
    setIsBaseRate(rate.is_base_rate);
    setBaseRateId(rate.base_rate_id || "");
    setRevenueAccountId(rate.revenue_account_id || "");
    setDepositRequirement(rate.deposit_requirement || "none");
    setIsDefaultRate(rate.is_default || false);
    setShowOnBookingChart(rate.show_on_booking_chart || false);
    setShowOnBookingEngine(rate.show_on_booking_engine || false);

    
    // Load existing prices for base rates
    if (rate.is_base_rate) {
      const pricesMap: Record<string, { price: string; adjustmentType: string; adjustmentValue: string }> = {};
      ratePrices.forEach((rp) => {
        pricesMap[rp.site_type_id] = {
          price: rp.price.toString(),
          adjustmentType: rp.adjustment_type || "base",
          adjustmentValue: rp.adjustment_value?.toString() || "",
        };
      });
      setSitePrices(pricesMap);
    } else if (ratePrices.length > 0) {
      // For derived rates, get the global adjustment
      setDerivedAdjustmentType(ratePrices[0].adjustment_type || "percent_up");
      setDerivedAdjustmentValue(ratePrices[0].adjustment_value?.toString() || "");
    }

    // Set existing add-ons
    setSelectedAddOns(rateAddOns);
    
    setDialogOpen(true);
  };

  const handleUpdateRate = async () => {
    if (!editingRate || !rateCode || !startDate || !endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Update the rate - include adjustment fields for derived rates
    const adjustmentVal = !editingRate.is_base_rate ? (parseFloat(derivedAdjustmentValue) || 0) : null;
    const { error: rateError } = await supabase
      .from("rates")
      .update({
        rate_code: rateCode,
        description,
        start_date: startDate,
        end_date: endDate,
        revenue_account_id: revenueAccountId || null,
        deposit_requirement: depositRequirement,
        is_default: isDefaultRate,
        show_on_booking_chart: showOnBookingChart,
        show_on_booking_engine: showOnBookingEngine,

        adjustment_type: !editingRate.is_base_rate ? derivedAdjustmentType : null,
        adjustment_value: adjustmentVal,
      })
      .eq("id", editingRate.id);

    if (rateError) {
      toast.error("Failed to update rate");
      return;
    }

    // Update prices - delete old and insert new
    await supabase.from("rate_site_type_prices").delete().eq("rate_id", editingRate.id);

    if (editingRate.is_base_rate) {
      const priceInserts = Object.entries(sitePrices).map(([siteTypeId, priceData]) => ({
        rate_id: editingRate.id,
        property_id: selectedProperty!.id,
        site_type_id: siteTypeId,
        price: parseFloat(priceData.price) || 0,
        adjustment_type: "base",
        adjustment_value: null,
      }));

      if (priceInserts.length > 0) {
        await supabase.from("rate_site_type_prices").insert(priceInserts);
      }
    } else if (baseRateId) {
      // For derived rate: recalculate from base rate
      const { data: basePrices } = await supabase
        .from("rate_site_type_prices")
        .select("*")
        .eq("rate_id", baseRateId);

      if (basePrices && basePrices.length > 0) {
        const adjustmentVal = parseFloat(derivedAdjustmentValue) || 0;
        const priceInserts = basePrices.map((bp) => {
          const derivedPrice = calculateDerivedPrice(bp.price, derivedAdjustmentType, adjustmentVal);
          return {
            rate_id: editingRate.id,
            property_id: selectedProperty!.id,
            site_type_id: bp.site_type_id,
            price: derivedPrice,
            adjustment_type: derivedAdjustmentType,
            adjustment_value: adjustmentVal,
          };
        });

        await supabase.from("rate_site_type_prices").insert(priceInserts);
      }
    }

    // Update rate add-ons - delete old and insert new
    await supabase.from("rate_add_ons").delete().eq("rate_id", editingRate.id);

    if (selectedAddOns.length > 0) {
      const addOnInserts = selectedAddOns.map(addOnId => ({
        rate_id: editingRate.id,
        add_on_id: addOnId,
      }));

      await supabase.from("rate_add_ons").insert(addOnInserts);
    }

    toast.success("Rate updated successfully");
    setDialogOpen(false);
    resetForm();
    loadRates();
    
    // Refresh selected rate details
    if (selectedRate?.id === editingRate.id) {
      loadRateDetails(editingRate.id);
    }
  };

  const handleSaveRate = () => {
    if (editingRate) {
      handleUpdateRate();
    } else {
      handleCreateRate();
    }
  };

  const resetSeasonForm = () => {
    setSeasonName("");
    setSeasonStartDate("");
    setSeasonEndDate("");
    setSeasonAdjustmentType("percent_up");
    setSeasonAdjustmentValue("");
  };

  const calculateDerivedPrice = (basePrice: number, adjustmentType: string, adjustmentValue: number) => {
    switch (adjustmentType) {
      case "percent_up":
        return basePrice * (1 + adjustmentValue / 100);
      case "percent_down":
        return basePrice * (1 - adjustmentValue / 100);
      case "dollar_up":
        return basePrice + adjustmentValue;
      case "dollar_down":
        return basePrice - adjustmentValue;
      default:
        return basePrice;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Rate Management</h1>
            <p className="text-muted-foreground">Manage rate codes and seasonal pricing</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />
                New Rate
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRate ? "Edit Rate" : "Create New Rate"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="rateCode">Rate Code *</Label>
                    <Input
                      id="rateCode"
                      value={rateCode}
                      onChange={(e) => setRateCode(e.target.value)}
                      placeholder="e.g., SUMMER2024"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Rate description"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                {!editingRate && (
                  <div>
                    <Label>Rate Type</Label>
                    <Select value={isBaseRate ? "base" : "derived"} onValueChange={(v) => setIsBaseRate(v === "base")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">Base Rate</SelectItem>
                        <SelectItem value="derived">Derived Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {editingRate && (
                  <div>
                    <Label>Rate Type</Label>
                    <div className="mt-1">
                      <Badge variant="secondary">{isBaseRate ? "Base Rate" : "Derived Rate"}</Badge>
                    </div>
                  </div>
                )}

                {!isBaseRate && (
                  <>
                    <div>
                      <Label>Base Rate *</Label>
                      <Select value={baseRateId} onValueChange={setBaseRateId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select base rate" />
                        </SelectTrigger>
                        <SelectContent>
                          {rates.filter(r => r.is_base_rate).map(rate => (
                            <SelectItem key={rate.id} value={rate.id}>
                              {rate.rate_code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Adjustment Type *</Label>
                        <Select value={derivedAdjustmentType} onValueChange={setDerivedAdjustmentType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent_up">% Up</SelectItem>
                            <SelectItem value="percent_down">% Down</SelectItem>
                            <SelectItem value="dollar_up">$ Up</SelectItem>
                            <SelectItem value="dollar_down">$ Down</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Adjustment Value *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={derivedAdjustmentType.includes("percent") ? "e.g., 10" : "e.g., 5.00"}
                          value={derivedAdjustmentValue}
                          onChange={(e) => setDerivedAdjustmentValue(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {derivedAdjustmentType.includes("percent") ? "Percentage adjustment" : "Dollar amount adjustment"}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Revenue Account *</Label>
                    <Select value={revenueAccountId} onValueChange={setRevenueAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select revenue account" />
                      </SelectTrigger>
                      <SelectContent>
                        {revenueAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Revenue will be posted to this account
                    </p>
                  </div>
                  <div>
                    <Label>Deposit Req</Label>
                    <Select value={depositRequirement} onValueChange={setDepositRequirement}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="100_percent">100% of Total Charges</SelectItem>
                        <SelectItem value="50_percent">50% of Total Charges</SelectItem>
                        <SelectItem value="first_night_tax">First Night + Tax</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Default deposit for bookings
                    </p>
                  </div>
                </div>

                {/* Visibility & Defaults */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Default Rate */}
                  <label
                    htmlFor="isDefaultRate"
                    className={`flex items-start gap-3 p-4 rounded-lg border bg-muted/30 transition-colors hover:bg-muted/50 cursor-pointer h-full ${
                      !isDefaultRate && rates.some(r => r.is_default && r.id !== editingRate?.id) ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <Checkbox
                      id="isDefaultRate"
                      checked={isDefaultRate}
                      onCheckedChange={(checked) => setIsDefaultRate(!!checked)}
                      disabled={!isDefaultRate && rates.some(r => r.is_default && r.id !== editingRate?.id)}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-medium flex items-center gap-2">
                        Default Rate
                        {isDefaultRate && <Badge variant="default" className="text-xs">Default</Badge>}
                      </span>
                      <span className="text-xs text-muted-foreground leading-snug">
                        {rates.some(r => r.is_default && r.id !== editingRate?.id)
                          ? "Another rate is currently set as default"
                          : "Use as default for new bookings and pricing display"}
                      </span>
                    </div>
                  </label>

                  {/* Show on Booking Chart */}
                  <label
                    htmlFor="showOnBookingChart"
                    className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 transition-colors hover:bg-muted/50 cursor-pointer h-full"
                  >
                    <Checkbox
                      id="showOnBookingChart"
                      checked={showOnBookingChart}
                      onCheckedChange={(checked) => setShowOnBookingChart(!!checked)}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-medium">Show on Booking Chart</span>
                      <span className="text-xs text-muted-foreground leading-snug">
                        Selectable from the Booking Chart "Show Rates" dropdown
                      </span>
                    </div>
                  </label>

                  {/* Show on Booking Engine */}
                  <label
                    htmlFor="showOnBookingEngine"
                    className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 transition-colors hover:bg-muted/50 cursor-pointer h-full"
                  >
                    <Checkbox
                      id="showOnBookingEngine"
                      checked={showOnBookingEngine}
                      onCheckedChange={(checked) => setShowOnBookingEngine(!!checked)}
                      className="mt-0.5"
                    />
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-medium">Show on Booking Engine</span>
                      <span className="text-xs text-muted-foreground leading-snug">
                        Available on the public booking engine (includes package add-ons in price)
                      </span>
                    </div>
                  </label>
                </div>



                {/* Package Add-ons Section */}
                {addOns.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <Label>Package Add-ons</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select add-ons to include with this rate (creates a package rate)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {addOns.map((addon) => (
                        <div
                          key={addon.id}
                          className="flex items-center space-x-2 p-2 rounded-md border bg-muted/30"
                        >
                          <Checkbox
                            id={`addon-${addon.id}`}
                            checked={selectedAddOns.includes(addon.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedAddOns([...selectedAddOns, addon.id]);
                              } else {
                                setSelectedAddOns(selectedAddOns.filter(id => id !== addon.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`addon-${addon.id}`}
                            className="text-sm font-medium cursor-pointer flex-1"
                          >
                            {addon.code} - {addon.name}
                            <span className="text-muted-foreground ml-2">
                              ${addon.price.toFixed(2)}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                    {selectedAddOns.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {selectedAddOns.map((addOnId) => {
                          const addon = addOns.find(a => a.id === addOnId);
                          return addon ? (
                            <Badge key={addon.id} variant="secondary" className="flex items-center gap-1">
                              {addon.code}
                              <X
                                className="h-3 w-3 cursor-pointer hover:text-destructive"
                                onClick={() => setSelectedAddOns(selectedAddOns.filter(id => id !== addOnId))}
                              />
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                )}

                {isBaseRate && (
                  <div className="space-y-4">
                    <Label>{terminology.siteType} Pricing</Label>
                    {siteTypes.map((siteType) => (
                      <Card key={siteType.id} className="p-4">
                        <h4 className="font-medium mb-3">{siteType.name}</h4>
                        <div>
                          <Label>Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={siteType.base_price.toString()}
                            value={sitePrices[siteType.id]?.price || ""}
                            onChange={(e) =>
                              setSitePrices({
                                ...sitePrices,
                                [siteType.id]: {
                                  price: e.target.value,
                                  adjustmentType: "base",
                                  adjustmentValue: "",
                                },
                              })
                            }
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                <Button onClick={handleSaveRate} className="w-full">
                  {editingRate ? "Update Rate" : "Create Rate"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Rates List */}
          <Card className="p-3">
            <h2 className="text-lg font-semibold mb-3">Rate Codes</h2>
            <div className="space-y-1">
              {rates.map((rate) => (
                <Card
                  key={rate.id}
                  className={`p-2 cursor-pointer hover:bg-accent/10 transition-colors ${
                    selectedRate?.id === rate.id ? "border-primary" : ""
                  }`}
                  onClick={() => setSelectedRate(rate)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{rate.rate_code}</span>
                        {rate.is_default && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">Default</Badge>
                        )}
                        <Badge 
                          variant={rate.is_base_rate ? "secondary" : "outline"} 
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          {rate.is_base_rate ? "Base" : "Derived"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {rate.description && `${rate.description} | `}
                        {new Date(rate.start_date).toLocaleDateString()} - {new Date(rate.end_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>

          {/* Rate Details */}
          <Card className="p-3">
            {selectedRate ? (
              <Tabs defaultValue="pricing">
                <div className="flex justify-between items-center mb-3">
                  <TabsList className="h-8">
                    <TabsTrigger value="pricing" className="text-xs px-3 py-1">Pricing</TabsTrigger>
                    <TabsTrigger value="seasons" className="text-xs px-3 py-1">Seasons</TabsTrigger>
                  </TabsList>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleEditRate(selectedRate)}>
                    <Edit className="mr-1.5 h-3 w-3" />
                    Edit Rate
                  </Button>
                </div>

                <TabsContent value="pricing" className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">{terminology.siteType} Pricing</h3>
                    
                    {/* Show derived rate info */}
                    {!selectedRate.is_base_rate && selectedRate.base_rate_id && (
                      <div className="mb-3 p-2 bg-muted/50 rounded-lg border text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground">Derived from:</span>
                          <span className="font-medium">
                            {rates.find(r => r.id === selectedRate.base_rate_id)?.rate_code || "Unknown"}
                          </span>
                          {ratePrices.length > 0 && ratePrices[0].adjustment_type !== "base" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {ratePrices[0].adjustment_type === "percent_up" && `+${ratePrices[0].adjustment_value}%`}
                              {ratePrices[0].adjustment_type === "percent_down" && `-${ratePrices[0].adjustment_value}%`}
                              {ratePrices[0].adjustment_type === "dollar_up" && `+$${ratePrices[0].adjustment_value}`}
                              {ratePrices[0].adjustment_type === "dollar_down" && `-$${ratePrices[0].adjustment_value}`}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      {ratePrices.map((ratePrice) => (
                        <Card key={ratePrice.id} className="p-2">
                          <div className="flex justify-between items-center">
                            <div className="text-sm">{ratePrice.site_types?.name}</div>
                            <div className="text-sm font-semibold">
                              ${parseFloat(ratePrice.price.toString()).toFixed(2)}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="seasons" className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold">Seasonal Adjustments</h3>
                    <Dialog open={seasonDialogOpen} onOpenChange={setSeasonDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="h-7 text-xs">
                          <Plus className="mr-1.5 h-3 w-3" />
                          Add Season
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Season</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="seasonName">Season Name *</Label>
                            <Input
                              id="seasonName"
                              value={seasonName}
                              onChange={(e) => setSeasonName(e.target.value)}
                              placeholder="e.g., Peak Summer"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="seasonStartDate">Start Date *</Label>
                              <Input
                                id="seasonStartDate"
                                type="date"
                                value={seasonStartDate}
                                onChange={(e) => setSeasonStartDate(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="seasonEndDate">End Date *</Label>
                              <Input
                                id="seasonEndDate"
                                type="date"
                                value={seasonEndDate}
                                onChange={(e) => setSeasonEndDate(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Adjustment Type *</Label>
                              <Select value={seasonAdjustmentType} onValueChange={setSeasonAdjustmentType}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="percent_up">% Up</SelectItem>
                                  <SelectItem value="percent_down">% Down</SelectItem>
                                  <SelectItem value="dollar_up">$ Up</SelectItem>
                                  <SelectItem value="dollar_down">$ Down</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Adjustment Value *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder={seasonAdjustmentType.includes("percent") ? "e.g., 10" : "e.g., 5.00"}
                                value={seasonAdjustmentValue}
                                onChange={(e) => setSeasonAdjustmentValue(e.target.value)}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                {seasonAdjustmentType.includes("percent") ? "Percentage adjustment" : "Dollar amount adjustment"}
                              </p>
                            </div>
                          </div>
                          <Button onClick={handleCreateSeason} className="w-full">
                            Create Season
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-1">
                    {rateSeasons.map((season) => (
                      <Card key={season.id} className="p-2">
                        <div className="flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{season.season_name}</span>
                              <Badge 
                                variant={season.adjustment_type?.includes("up") ? "default" : "secondary"}
                                className="text-[10px] px-1.5 py-0 h-4"
                              >
                                {season.adjustment_type?.includes("percent") 
                                  ? `${season.adjustment_type?.includes("up") ? "+" : "-"}${season.adjustment_value || 0}%`
                                  : `${season.adjustment_type?.includes("up") ? "+$" : "-$"}${season.adjustment_value || 0}`
                                }
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(season.start_date).toLocaleDateString()} - {new Date(season.end_date).toLocaleDateString()}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleDeleteSeason(season.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                    {rateSeasons.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        No seasonal adjustments configured
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Select a rate to view details
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Rates;
