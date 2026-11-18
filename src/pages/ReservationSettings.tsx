import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoCapInput } from "@/components/ui/auto-cap-input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, Package, ChevronDown, ChevronRight, Shield, Briefcase, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useProperty } from "@/contexts/PropertyContext";

interface GuaranteeOption {
  id?: string;
  code: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

interface AddOn {
  id?: string;
  code: string;
  name: string;
  description: string;
  price: number;
  account_id: string;
  charge_type: 'nightly' | 'one_time';
  is_active: boolean;
}

interface Account {
  id: string;
  code: string;
  name: string;
}

interface SourceOfBusiness {
  id?: string;
  code: string;
  definition: string;
  is_default: boolean;
}

const MAX_OPTIONS = 6;

const ReservationSettings = () => {
  const { selectedProperty } = useProperty();
  const [guaranteeOptions, setGuaranteeOptions] = useState<GuaranteeOption[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [sources, setSources] = useState<SourceOfBusiness[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAddOns, setSavingAddOns] = useState(false);
  const [savingSources, setSavingSources] = useState(false);
  const [guaranteeOpen, setGuaranteeOpen] = useState(false);
  const [addOnsOpen, setAddOnsOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    if (selectedProperty?.id) {
      fetchData();
    }
  }, [selectedProperty?.id]);

  const fetchData = async () => {
    if (!selectedProperty?.id) return;
    
    try {
      // Get guarantee options
      const { data: options } = await supabase
        .from("guarantee_options")
        .select("*")
        .eq("property_id", selectedProperty.id)
        .order("sort_order");

        if (options) {
          setGuaranteeOptions(options.map(opt => ({
            id: opt.id,
            code: opt.code,
            description: opt.description,
            sort_order: opt.sort_order,
            is_active: opt.is_active
          })));
        }

      // Get add-ons
      const { data: addOnsData } = await supabase
        .from("add_ons")
        .select("*")
        .eq("property_id", selectedProperty.id)
        .order("code");

      if (addOnsData) {
        setAddOns(addOnsData.map(addon => ({
          id: addon.id,
          code: addon.code || "",
          name: addon.name,
          description: addon.description || "",
          price: addon.price,
          account_id: addon.account_id || "",
          charge_type: (addon.charge_type as 'nightly' | 'one_time') || 'nightly',
          is_active: addon.is_active
        })));
      }

      // Get revenue accounts for dropdown (filter by property)
      const { data: accountsData } = await supabase
        .from("accounts")
        .select("id, code, name, account_groups!inner(account_type)")
        .eq("property_id", selectedProperty.id)
        .eq("account_groups.account_type", "revenue")
        .eq("is_active", true)
        .order("code");

      if (accountsData) {
        setAccounts(accountsData.map(acc => ({
          id: acc.id,
          code: acc.code,
          name: acc.name
        })));
      }

      // Get sources of business
      const { data: sourcesData } = await supabase
        .from("source_of_business")
        .select("*")
        .eq("property_id", selectedProperty.id)
        .order("code");

      if (sourcesData) {
        setSources(sourcesData.map(src => ({
          id: src.id,
          code: src.code,
          definition: src.definition,
          is_default: src.is_default
        })));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Guarantee Options handlers
  const addOption = () => {
    if (guaranteeOptions.length >= MAX_OPTIONS) {
      toast.error(`Maximum of ${MAX_OPTIONS} guarantee options allowed`);
      return;
    }
    setGuaranteeOptions([
      ...guaranteeOptions,
      { code: "", description: "", sort_order: guaranteeOptions.length, is_active: true }
    ]);
  };

  const removeOption = (index: number) => {
    setGuaranteeOptions(guaranteeOptions.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, field: keyof GuaranteeOption, value: string) => {
    const updated = [...guaranteeOptions];
    if (field === "code") {
      const cleanValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      updated[index] = { ...updated[index], [field]: cleanValue };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setGuaranteeOptions(updated);
  };

  const saveOptions = async () => {
    if (!selectedProperty?.id) return;

    for (const opt of guaranteeOptions) {
      if (!opt.code.trim()) {
        toast.error("All guarantee options must have a code");
        return;
      }
      if (!opt.description.trim()) {
        toast.error("All guarantee options must have a description");
        return;
      }
    }

    const codes = guaranteeOptions.map(o => o.code.toUpperCase());
    if (new Set(codes).size !== codes.length) {
      toast.error("Duplicate codes are not allowed");
      return;
    }

    setSaving(true);
    try {
      await supabase
        .from("guarantee_options")
        .delete()
        .eq("property_id", selectedProperty.id);

      if (guaranteeOptions.length > 0) {
        const { error } = await supabase
          .from("guarantee_options")
          .insert(
            guaranteeOptions.map((opt, index) => ({
              property_id: selectedProperty.id,
              code: opt.code.toUpperCase(),
              description: opt.description,
              sort_order: index,
              is_active: true
            }))
          );

        if (error) throw error;
      }

      toast.success("Guarantee options saved successfully");
      fetchData();
    } catch (error: any) {
      console.error("Error saving options:", error);
      toast.error(error.message || "Failed to save guarantee options");
    } finally {
      setSaving(false);
    }
  };

  // Add-ons handlers
  const addAddOn = () => {
    setAddOns([
      ...addOns,
      { code: "", name: "", description: "", price: 0, account_id: "", charge_type: 'nightly', is_active: true }
    ]);
  };

  const removeAddOn = (index: number) => {
    setAddOns(addOns.filter((_, i) => i !== index));
  };

  const updateAddOn = (index: number, field: keyof AddOn, value: string | number) => {
    const updated = [...addOns];
    if (field === "code") {
      const cleanValue = (value as string).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      updated[index] = { ...updated[index], [field]: cleanValue };
    } else if (field === "price") {
      updated[index] = { ...updated[index], [field]: parseFloat(value as string) || 0 };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setAddOns(updated);
  };

  const saveAddOns = async () => {
    if (!selectedProperty?.id) return;

    for (const addon of addOns) {
      if (!addon.code.trim()) {
        toast.error("All add-ons must have a code");
        return;
      }
      if (!addon.name.trim()) {
        toast.error("All add-ons must have a name");
        return;
      }
      if (!addon.account_id) {
        toast.error("All add-ons must be linked to an account");
        return;
      }
      if (addon.price <= 0) {
        toast.error("All add-ons must have a price greater than 0");
        return;
      }
    }

    const codes = addOns.map(a => a.code.toUpperCase());
    if (new Set(codes).size !== codes.length) {
      toast.error("Duplicate add-on codes are not allowed");
      return;
    }

    setSavingAddOns(true);
    try {
      // Delete existing add-ons for this property
      await supabase
        .from("add_ons")
        .delete()
        .eq("property_id", selectedProperty.id);

      if (addOns.length > 0) {
        const { error } = await supabase
          .from("add_ons")
          .insert(
            addOns.map(addon => ({
              property_id: selectedProperty.id,
              code: addon.code.toUpperCase(),
              name: addon.name,
              description: addon.description,
              price: addon.price,
              account_id: addon.account_id,
              charge_type: addon.charge_type,
              is_active: true
            }))
          );

        if (error) throw error;
      }

      toast.success("Add-ons saved successfully");
      fetchData();
    } catch (error: any) {
      console.error("Error saving add-ons:", error);
      toast.error(error.message || "Failed to save add-ons");
    } finally {
      setSavingAddOns(false);
    }
  };

  // Source of Business handlers
  const addSource = () => {
    setSources([
      ...sources,
      { code: "", definition: "", is_default: false }
    ]);
  };

  const removeSource = (index: number) => {
    setSources(sources.filter((_, i) => i !== index));
  };

  const updateSource = (index: number, field: keyof SourceOfBusiness, value: string | boolean) => {
    const updated = [...sources];
    if (field === "code") {
      const cleanValue = (value as string).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
      updated[index] = { ...updated[index], [field]: cleanValue };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setSources(updated);
  };

  const setDefaultSource = (index: number) => {
    const updated = sources.map((src, i) => ({
      ...src,
      is_default: i === index
    }));
    setSources(updated);
  };

  const saveSources = async () => {
    if (!selectedProperty?.id) return;

    for (const src of sources) {
      if (!src.code.trim()) {
        toast.error("All sources must have a code");
        return;
      }
      if (!src.definition.trim()) {
        toast.error("All sources must have a definition");
        return;
      }
    }

    const codes = sources.map(s => s.code.toUpperCase());
    if (new Set(codes).size !== codes.length) {
      toast.error("Duplicate source codes are not allowed");
      return;
    }

    setSavingSources(true);
    try {
      await supabase
        .from("source_of_business")
        .delete()
        .eq("property_id", selectedProperty.id);

      if (sources.length > 0) {
        const { error } = await supabase
          .from("source_of_business")
          .insert(
            sources.map(src => ({
              property_id: selectedProperty.id,
              code: src.code.toUpperCase(),
              definition: src.definition,
              is_default: src.is_default
            }))
          );

        if (error) throw error;
      }

      toast.success("Sources of business saved successfully");
      fetchData();
    } catch (error: any) {
      console.error("Error saving sources:", error);
      toast.error(error.message || "Failed to save sources of business");
    } finally {
      setSavingSources(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reservation Settings</h1>
          <p className="text-muted-foreground">
            Configure reservation-related settings
          </p>
        </div>

        {/* Guarantee Options Section */}
        <Card className="overflow-hidden">
          <Collapsible open={guaranteeOpen} onOpenChange={setGuaranteeOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-6 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  {guaranteeOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="text-xl font-semibold">Guarantee Options</h2>
                    <p className="text-sm text-muted-foreground">
                      {guaranteeOptions.length} option{guaranteeOptions.length !== 1 ? 's' : ''} configured
                    </p>
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-6 border-t">
                <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Create up to {MAX_OPTIONS} guarantee options for reservations
                    </p>
                    <Button
                      onClick={addOption}
                      disabled={guaranteeOptions.length >= MAX_OPTIONS || loading}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>

                  {loading ? (
                    <p className="text-muted-foreground">Loading...</p>
                  ) : guaranteeOptions.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center border border-dashed rounded-md">
                      No guarantee options configured. Click "Add Option" to create one.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {guaranteeOptions.map((option, index) => (
                        <div key={index} className="flex items-end gap-4 p-4 bg-muted/50 rounded-lg">
                          <div className="w-24">
                            <Label htmlFor={`code-${index}`}>Code</Label>
                            <Input
                              id={`code-${index}`}
                              value={option.code}
                              onChange={(e) => updateOption(index, "code", e.target.value)}
                              placeholder="CODE"
                              maxLength={4}
                              className="uppercase font-mono"
                            />
                          </div>
                          <div className="flex-1">
                            <Label htmlFor={`desc-${index}`}>Description</Label>
                            <AutoCapInput
                              id={`desc-${index}`}
                              value={option.description}
                              onChange={(e) => updateOption(index, "description", e.target.value)}
                              placeholder="Enter description"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {guaranteeOptions.length > 0 && (
                    <div className="flex justify-end pt-4">
                      <Button onClick={saveOptions} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Save Options"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Add-ons Section */}
        <Card className="overflow-hidden">
          <Collapsible open={addOnsOpen} onOpenChange={setAddOnsOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-6 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  {addOnsOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="text-xl font-semibold">Add-ons</h2>
                    <p className="text-sm text-muted-foreground">
                      {addOns.length} item{addOns.length !== 1 ? 's' : ''} configured
                    </p>
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-6 border-t">
                <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Create revenue items that can be added to reservations
                    </p>
                    <Button onClick={addAddOn} disabled={loading} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>

                  {loading ? (
                    <p className="text-muted-foreground">Loading...</p>
                  ) : addOns.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center border border-dashed rounded-md">
                      No add-ons configured. Click "Add Item" to create one.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {addOns.map((addon, index) => (
                        <div key={index} className="p-4 bg-muted/50 rounded-lg space-y-3">
                          <div className="flex items-end gap-4">
                            <div className="w-20">
                              <Label htmlFor={`addon-code-${index}`}>Code</Label>
                              <Input
                                id={`addon-code-${index}`}
                                value={addon.code}
                                onChange={(e) => updateAddOn(index, "code", e.target.value)}
                                placeholder="CODE"
                                maxLength={4}
                                className="uppercase font-mono"
                              />
                            </div>
                            <div className="flex-1">
                              <Label htmlFor={`addon-name-${index}`}>Name</Label>
                              <AutoCapInput
                                id={`addon-name-${index}`}
                                value={addon.name}
                                onChange={(e) => updateAddOn(index, "name", e.target.value)}
                                placeholder="Add-on name"
                              />
                            </div>
                            <div className="w-28">
                              <Label htmlFor={`addon-price-${index}`}>Price</Label>
                              <Input
                                id={`addon-price-${index}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={addon.price}
                                onChange={(e) => updateAddOn(index, "price", e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAddOn(index)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-end gap-4">
                            <div className="flex-1">
                              <Label htmlFor={`addon-desc-${index}`}>Description</Label>
                              <AutoCapInput
                                id={`addon-desc-${index}`}
                                value={addon.description}
                                onChange={(e) => updateAddOn(index, "description", e.target.value)}
                                placeholder="Optional description"
                              />
                            </div>
                            <div className="w-32">
                              <Label htmlFor={`addon-charge-${index}`}>Charge Type</Label>
                              <Select
                                value={addon.charge_type}
                                onValueChange={(value) => updateAddOn(index, "charge_type", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="nightly">Nightly</SelectItem>
                                  <SelectItem value="one_time">One-Time</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="w-64">
                              <Label htmlFor={`addon-account-${index}`}>Account Code</Label>
                              <Select
                                value={addon.account_id}
                                onValueChange={(value) => updateAddOn(index, "account_id", value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                      {account.code} - {account.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {addOns.length > 0 && (
                    <div className="flex justify-end pt-4">
                      <Button onClick={saveAddOns} disabled={savingAddOns}>
                        <Save className="h-4 w-4 mr-2" />
                        {savingAddOns ? "Saving..." : "Save Add-ons"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Source of Business Section */}
        <Card className="overflow-hidden">
          <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-6 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  {sourcesOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="text-xl font-semibold">Source of Business</h2>
                    <p className="text-sm text-muted-foreground">
                      {sources.length} source{sources.length !== 1 ? 's' : ''} configured
                    </p>
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-6 pb-6 border-t">
                <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Track booking sources for reservations (codes up to 3 characters)
                    </p>
                    <Button onClick={addSource} disabled={loading} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Source
                    </Button>
                  </div>

                  {loading ? (
                    <p className="text-muted-foreground">Loading...</p>
                  ) : sources.length === 0 ? (
                    <p className="text-muted-foreground py-4 text-center border border-dashed rounded-md">
                      No sources configured. Click "Add Source" to create one.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {sources.map((source, index) => (
                        <div key={index} className="flex items-end gap-4 p-4 bg-muted/50 rounded-lg">
                          <div className="w-20">
                            <Label htmlFor={`source-code-${index}`}>Code</Label>
                            <Input
                              id={`source-code-${index}`}
                              value={source.code}
                              onChange={(e) => updateSource(index, "code", e.target.value)}
                              placeholder="WEB"
                              maxLength={3}
                              className="uppercase font-mono"
                            />
                          </div>
                          <div className="flex-1">
                            <Label htmlFor={`source-def-${index}`}>Definition</Label>
                            <AutoCapInput
                              id={`source-def-${index}`}
                              value={source.definition}
                              onChange={(e) => updateSource(index, "definition", e.target.value)}
                              placeholder="e.g., Website Booking"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDefaultSource(index)}
                            title={source.is_default ? "Default source" : "Set as default"}
                          >
                            <Star className={`h-4 w-4 ${source.is_default ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSource(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {sources.length > 0 && (
                    <div className="flex justify-end pt-4">
                      <Button onClick={saveSources} disabled={savingSources}>
                        <Save className="h-4 w-4 mr-2" />
                        {savingSources ? "Saving..." : "Save Sources"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ReservationSettings;