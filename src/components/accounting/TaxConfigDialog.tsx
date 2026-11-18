import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface TaxAccount {
  id: string;
  code: string;
  name: string;
}

interface AccountTax {
  id: string;
  tax_account_id: string;
  calculation_type: string;
  rate_value: number;
  inclusive_of_tax_id: string | null;
  sort_order: number;
}

interface TaxConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revenueAccountId: string; // Also used for expense accounts (e.g., refunds)
  revenueAccountName: string; // Also used for expense accounts
}

const CALCULATION_TYPES = [
  { value: "percentage_on_revenue", label: "% on Revenue Amount" },
  { value: "percentage_on_tax", label: "% Tax on Tax (Compound)" },
  { value: "vat_inclusive", label: "% VAT Inclusive" },
  { value: "flat_per_day", label: "Flat $ per Day" },
  { value: "flat_per_adult", label: "Flat $ per Adult" },
];

export const TaxConfigDialog = ({
  open,
  onOpenChange,
  revenueAccountId,
  revenueAccountName,
}: TaxConfigDialogProps) => {
  const { selectedProperty } = useProperty();
  const [taxAccounts, setTaxAccounts] = useState<TaxAccount[]>([]);
  const [accountTaxes, setAccountTaxes] = useState<AccountTax[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, revenueAccountId]);

  const loadData = async () => {
    if (!selectedProperty) return;
    
    setLoading(true);
    try {
      // Load all tax accounts (accounts in groups with 'tax' account_type) for this property
      const { data: taxAccountsData, error: taxError } = await supabase
        .from("accounts")
        .select(`
          id,
          code,
          name,
          account_groups!inner(account_type)
        `)
        .eq("property_id", selectedProperty.id)
        .eq("account_groups.account_type", "tax")
        .eq("is_active", true)
        .order("code");

      if (taxError) throw taxError;

      setTaxAccounts(
        (taxAccountsData || []).map((acc) => ({
          id: acc.id,
          code: acc.code,
          name: acc.name,
        }))
      );

      // Load existing tax configurations for this revenue account
      const { data: existingTaxes, error: taxConfigError } = await supabase
        .from("account_taxes")
        .select("*")
        .eq("revenue_account_id", revenueAccountId)
        .order("sort_order");

      if (taxConfigError) throw taxConfigError;

      setAccountTaxes(existingTaxes || []);
    } catch (error) {
      console.error("Error loading tax data:", error);
      toast.error("Failed to load tax configuration");
    } finally {
      setLoading(false);
    }
  };

  const addTax = () => {
    if (accountTaxes.length >= 5) {
      toast.error("Maximum of 5 taxes per account");
      return;
    }

    if (taxAccounts.length === 0) {
      toast.error("No tax accounts available. Create a Tax account group first.");
      return;
    }

    const newTax: AccountTax = {
      id: `new-${Date.now()}`,
      tax_account_id: taxAccounts[0]?.id || "",
      calculation_type: "percentage_on_revenue",
      rate_value: 0,
      inclusive_of_tax_id: null,
      sort_order: accountTaxes.length,
    };

    setAccountTaxes([...accountTaxes, newTax]);
  };

  const removeTax = (index: number) => {
    const updated = accountTaxes.filter((_, i) => i !== index);
    // Reorder sort_order
    setAccountTaxes(updated.map((tax, i) => ({ ...tax, sort_order: i })));
  };

  const updateTax = (index: number, field: keyof AccountTax, value: string | number | null) => {
    const updated = [...accountTaxes];
    updated[index] = { ...updated[index], [field]: value };
    setAccountTaxes(updated);
  };

  const handleSave = async () => {
    if (!selectedProperty) return;
    
    setSaving(true);
    try {
      // Delete all existing taxes for this revenue account
      await supabase
        .from("account_taxes")
        .delete()
        .eq("revenue_account_id", revenueAccountId);

      // Insert new taxes
      if (accountTaxes.length > 0) {
        const taxesToInsert = accountTaxes.map((tax, index) => ({
          property_id: selectedProperty.id,
          revenue_account_id: revenueAccountId,
          tax_account_id: tax.tax_account_id,
          calculation_type: tax.calculation_type,
          rate_value: tax.rate_value,
          inclusive_of_tax_id: tax.calculation_type === "percentage_on_tax" ? tax.inclusive_of_tax_id : null,
          sort_order: index,
        }));

        const { error } = await supabase.from("account_taxes").insert(taxesToInsert);
        if (error) throw error;
      }

      toast.success("Tax configuration saved");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving tax configuration:", error);
      toast.error("Failed to save tax configuration");
    } finally {
      setSaving(false);
    }
  };

  const getOtherTaxesForInclusive = (currentIndex: number) => {
    return accountTaxes.filter((_, i) => i < currentIndex);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Taxes for {revenueAccountName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground text-center py-4">Loading...</p>
        ) : taxAccounts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No tax accounts found. Create an Account Group with type "Tax" and add tax accounts first.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {accountTaxes.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No taxes configured. Click "Add Tax" to add one.
              </p>
            ) : (
              <div className="space-y-3">
                {accountTaxes.map((tax, index) => (
                  <div
                    key={tax.id}
                    className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center h-9 text-muted-foreground">
                      <GripVertical className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Tax Account</Label>
                        <Select
                          value={tax.tax_account_id}
                          onValueChange={(value) => updateTax(index, "tax_account_id", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select tax account" />
                          </SelectTrigger>
                          <SelectContent>
                            {taxAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Calculation Type</Label>
                        <Select
                          value={tax.calculation_type}
                          onValueChange={(value) => updateTax(index, "calculation_type", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CALCULATION_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">
                          {tax.calculation_type.startsWith("percentage") || tax.calculation_type === "vat_inclusive"
                            ? "Rate (%)"
                            : "Amount ($)"}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tax.rate_value}
                          onChange={(e) =>
                            updateTax(index, "rate_value", parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>

                      {tax.calculation_type === "percentage_on_tax" && (
                        <div>
                          <Label className="text-xs">Apply Tax On</Label>
                          <Select
                            value={tax.inclusive_of_tax_id || ""}
                            onValueChange={(value) =>
                              updateTax(index, "inclusive_of_tax_id", value || null)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select tax" />
                            </SelectTrigger>
                            <SelectContent>
                              {getOtherTaxesForInclusive(index).map((otherTax, i) => {
                                const taxAcc = taxAccounts.find(
                                  (a) => a.id === otherTax.tax_account_id
                                );
                                return (
                                  <SelectItem key={otherTax.id} value={otherTax.id}>
                                    Tax {i + 1}: {taxAcc?.name || "Unknown"}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => removeTax(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={addTax}
                disabled={accountTaxes.length >= 5}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tax {accountTaxes.length > 0 && `(${accountTaxes.length}/5)`}
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
