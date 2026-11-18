import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoCapInput } from "@/components/ui/auto-cap-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Receipt, Copy, Home } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TaxConfigDialog } from "./TaxConfigDialog";

interface AccountGroup {
  id: string;
  name: string;
  account_type: string;
  sort_order: number;
  accounts: Account[];
}

interface Account {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  normal_balance: string;
  tax_calculation_type: string | null;
  tax_rate_value: number | null;
  include_in_nightly_kpis: boolean;
  external_account: string | null;
  payment_type: string | null;
}

const PAYMENT_TYPES = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "amex", label: "American Express" },
  { value: "discover", label: "Discover" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH/EFT" },
  { value: "other", label: "Other" },
];

const TAX_CALCULATION_TYPES = [
  { value: "percentage_on_revenue", label: "% on Revenue Amount" },
  { value: "percentage_on_tax", label: "% Tax on Tax (Compound)" },
  { value: "vat_inclusive", label: "% VAT Inclusive" },
  { value: "flat_per_day", label: "Flat $ per Day" },
  { value: "flat_per_adult", label: "Flat $ per Adult" },
];

interface ChartOfAccountsProps {
  compact?: boolean;
}

export const ChartOfAccounts = ({ compact = false }: ChartOfAccountsProps) => {
  const { properties, selectedProperty } = useProperty();
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isNewGroupDialogOpen, setIsNewGroupDialogOpen] = useState(false);
  const [isNewAccountDialogOpen, setIsNewAccountDialogOpen] = useState(false);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
  const [isEditAccountDialogOpen, setIsEditAccountDialogOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copySourcePropertyId, setCopySourcePropertyId] = useState<string>("");
  const [copying, setCopying] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [editingGroup, setEditingGroup] = useState<AccountGroup | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<string>("asset");
  const [newAccountCode, setNewAccountCode] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountDescription, setNewAccountDescription] = useState("");
  const [newTaxCalcType, setNewTaxCalcType] = useState<string>("percentage");
  const [newTaxRateValue, setNewTaxRateValue] = useState<number>(0);
  const [taxConfigAccount, setTaxConfigAccount] = useState<{ id: string; name: string } | null>(null);
  const [accountTaxCounts, setAccountTaxCounts] = useState<Record<string, number>>({});
  const [newIncludeInNightlyKpis, setNewIncludeInNightlyKpis] = useState(false);
  const [newExternalAccount, setNewExternalAccount] = useState("");
  const [newPaymentType, setNewPaymentType] = useState<string>("");

  useEffect(() => {
    if (selectedProperty) {
      loadAccounts();
    }
  }, [selectedProperty?.id]);

  const loadAccounts = async () => {
    if (!selectedProperty) return;
    
    setLoading(true);
    try {
      const { data: groupsData, error: groupsError } = await supabase
        .from("account_groups")
        .select("*")
        .eq("property_id", selectedProperty.id)
        .order("sort_order");

      if (groupsError) throw groupsError;

      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select("*")
        .eq("property_id", selectedProperty.id)
        .eq("is_active", true)
        .order("code");

      if (accountsError) throw accountsError;

      // Load tax counts for revenue accounts
      const { data: taxCountsData, error: taxCountsError } = await supabase
        .from("account_taxes")
        .select("revenue_account_id")
        .eq("property_id", selectedProperty.id);

      if (taxCountsError) throw taxCountsError;

      // Count taxes per revenue account
      const taxCounts: Record<string, number> = {};
      (taxCountsData || []).forEach((tax) => {
        taxCounts[tax.revenue_account_id] = (taxCounts[tax.revenue_account_id] || 0) + 1;
      });
      setAccountTaxCounts(taxCounts);

      // Group accounts by account_group_id
      const groupedAccounts = (groupsData || []).map((group) => ({
        ...group,
        accounts: (accountsData || []).filter((acc) => acc.account_group_id === group.id),
      }));

      // Sort groups: numeric-prefixed names first (lowest to highest), then alphabetic (A-Z)
      const sortedGroups = [...groupedAccounts].sort((a, b) => {
        const aName = a.name;
        const bName = b.name;
        
        const aStartsWithNumber = /^\d/.test(aName);
        const bStartsWithNumber = /^\d/.test(bName);
        
        if (aStartsWithNumber && bStartsWithNumber) {
          // Both start with numbers - sort numerically
          const aNum = parseInt(aName.match(/^\d+/)?.[0] || "0", 10);
          const bNum = parseInt(bName.match(/^\d+/)?.[0] || "0", 10);
          return aNum - bNum;
        } else if (aStartsWithNumber && !bStartsWithNumber) {
          // Numbers come before letters
          return -1;
        } else if (!aStartsWithNumber && bStartsWithNumber) {
          // Letters come after numbers
          return 1;
        } else {
          // Both start with letters - sort alphabetically
          return aName.localeCompare(bName);
        }
      });

      setGroups(sortedGroups);

      // Expand all groups by default
      setExpandedGroups(new Set(groupedAccounts.map((g) => g.id)));
    } catch (error) {
      console.error("Error loading accounts:", error);
      toast.error("Failed to load chart of accounts");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName || !selectedProperty) {
      toast.error("Please enter a group name");
      return;
    }

    try {
      const { error } = await supabase.from("account_groups").insert({
        property_id: selectedProperty.id,
        name: newGroupName,
        account_type: newGroupType as "asset" | "liability" | "equity" | "revenue" | "expense",
        sort_order: groups.length,
      });

      if (error) throw error;

      toast.success("Account group created");
      setIsNewGroupDialogOpen(false);
      setNewGroupName("");
      setNewGroupType("asset");
      loadAccounts();
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Failed to create group");
    }
  };

  const handleCopyFromProperty = async () => {
    if (!copySourcePropertyId || !selectedProperty) {
      toast.error("Please select a source property");
      return;
    }

    setCopying(true);
    try {
      // Fetch source account groups
      const { data: sourceGroups, error: groupsError } = await supabase
        .from("account_groups")
        .select("*")
        .eq("property_id", copySourcePropertyId)
        .order("sort_order");

      if (groupsError) throw groupsError;

      // Fetch source accounts
      const { data: sourceAccounts, error: accountsError } = await supabase
        .from("accounts")
        .select("*")
        .eq("property_id", copySourcePropertyId)
        .eq("is_active", true);

      if (accountsError) throw accountsError;

      if (!sourceGroups?.length) {
        toast.error("Source property has no account groups to copy");
        return;
      }

      // Create a mapping of old group IDs to new group IDs
      const groupIdMapping: Record<string, string> = {};

      // Insert groups for the new property
      for (const group of sourceGroups) {
        const { data: newGroup, error: insertError } = await supabase
          .from("account_groups")
          .insert({
            property_id: selectedProperty.id,
            name: group.name,
            account_type: group.account_type,
            sort_order: group.sort_order,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        if (newGroup) {
          groupIdMapping[group.id] = newGroup.id;
        }
      }

      // Insert accounts for the new property
      for (const account of sourceAccounts || []) {
        const newGroupId = groupIdMapping[account.account_group_id];
        if (newGroupId) {
          const { error: insertError } = await supabase
            .from("accounts")
            .insert({
              property_id: selectedProperty.id,
              account_group_id: newGroupId,
              code: account.code,
              name: account.name,
              description: account.description,
              normal_balance: account.normal_balance,
              tax_calculation_type: account.tax_calculation_type,
              tax_rate_value: account.tax_rate_value,
              external_account: account.external_account,
              payment_type: account.payment_type,
            });

          if (insertError) throw insertError;
        }
      }

      toast.success(`Copied ${sourceGroups.length} groups and ${sourceAccounts?.length || 0} accounts`);
      setIsCopyDialogOpen(false);
      setCopySourcePropertyId("");
      loadAccounts();
    } catch (error) {
      console.error("Error copying accounts:", error);
      toast.error("Failed to copy chart of accounts");
    } finally {
      setCopying(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!selectedGroupId || !newAccountCode || !newAccountName || !selectedProperty) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const group = groups.find((g) => g.id === selectedGroupId);
      const normalBalance =
        group?.account_type === "asset" || group?.account_type === "expense"
          ? "debit"
          : "credit";

      const isTaxGroup = group?.account_type === "tax";

      const { error } = await supabase.from("accounts").insert({
        property_id: selectedProperty.id,
        account_group_id: selectedGroupId,
        code: newAccountCode,
        name: newAccountName,
        description: newAccountDescription || null,
        normal_balance: normalBalance,
        tax_calculation_type: isTaxGroup ? newTaxCalcType : null,
        tax_rate_value: isTaxGroup ? newTaxRateValue : null,
        include_in_nightly_kpis: newIncludeInNightlyKpis,
        external_account: newExternalAccount || null,
        payment_type: newPaymentType && newPaymentType !== "__none__" ? newPaymentType : null,
      });

      if (error) throw error;

      toast.success("Account created");
      setIsNewAccountDialogOpen(false);
      setSelectedGroupId("");
      setNewAccountCode("");
      setNewAccountName("");
      setNewAccountDescription("");
      setNewTaxCalcType("percentage");
      setNewTaxRateValue(0);
      setNewIncludeInNightlyKpis(false);
      setNewExternalAccount("");
      setNewPaymentType("");
      loadAccounts();
    } catch (error) {
      console.error("Error creating account:", error);
      toast.error("Failed to create account");
    }
  };

  const handleEditGroup = (group: AccountGroup) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setNewGroupType(group.account_type);
    setIsEditGroupDialogOpen(true);
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !newGroupName) {
      toast.error("Please enter a group name");
      return;
    }

    try {
      const { error } = await supabase
        .from("account_groups")
        .update({
          name: newGroupName,
          account_type: newGroupType as "asset" | "liability" | "equity" | "revenue" | "expense",
        })
        .eq("id", editingGroup.id);

      if (error) throw error;

      toast.success("Account group updated");
      setIsEditGroupDialogOpen(false);
      setEditingGroup(null);
      setNewGroupName("");
      setNewGroupType("asset");
      loadAccounts();
    } catch (error) {
      console.error("Error updating group:", error);
      toast.error("Failed to update group");
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Are you sure you want to delete this group? All accounts in this group will also be deleted.")) {
      return;
    }

    try {
      // First delete all accounts in the group
      await supabase.from("accounts").delete().eq("account_group_id", groupId);
      
      // Then delete the group
      const { error } = await supabase.from("account_groups").delete().eq("id", groupId);

      if (error) throw error;

      toast.success("Account group deleted");
      loadAccounts();
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
    }
  };

  const handleEditAccount = (account: Account, groupId: string) => {
    setEditingAccount(account);
    setSelectedGroupId(groupId);
    setNewAccountCode(account.code);
    setNewAccountName(account.name);
    setNewAccountDescription(account.description || "");
    setNewTaxCalcType(account.tax_calculation_type || "percentage");
    setNewTaxRateValue(account.tax_rate_value || 0);
    setNewIncludeInNightlyKpis(account.include_in_nightly_kpis || false);
    setNewExternalAccount(account.external_account || "");
    setNewPaymentType(account.payment_type || "");
    setIsEditAccountDialogOpen(true);
  };

  const handleUpdateAccount = async () => {
    if (!editingAccount || !newAccountCode || !newAccountName) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const group = groups.find((g) => g.id === selectedGroupId);
      const isTaxGroup = group?.account_type === "tax";

      const { error } = await supabase
        .from("accounts")
        .update({
          code: newAccountCode,
          name: newAccountName,
          description: newAccountDescription || null,
          account_group_id: selectedGroupId,
          tax_calculation_type: isTaxGroup ? newTaxCalcType : null,
          tax_rate_value: isTaxGroup ? newTaxRateValue : null,
          include_in_nightly_kpis: newIncludeInNightlyKpis,
          external_account: newExternalAccount || null,
          payment_type: newPaymentType && newPaymentType !== "__none__" ? newPaymentType : null,
        })
        .eq("id", editingAccount.id);

      if (error) throw error;

      toast.success("Account updated");
      setIsEditAccountDialogOpen(false);
      setEditingAccount(null);
      setNewAccountCode("");
      setNewAccountName("");
      setNewAccountDescription("");
      setNewTaxCalcType("percentage");
      setNewTaxRateValue(0);
      setNewIncludeInNightlyKpis(false);
      setNewExternalAccount("");
      setNewPaymentType("");
      loadAccounts();
    } catch (error) {
      console.error("Error updating account:", error);
      toast.error("Failed to update account");
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to delete this account?")) {
      return;
    }

    try {
      const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", accountId);

      if (error) throw error;

      toast.success("Account deleted");
      loadAccounts();
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
    }
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "asset":
        return "bg-blue-500/10 text-blue-700";
      case "liability":
        return "bg-purple-500/10 text-purple-700";
      case "equity":
        return "bg-green-500/10 text-green-700";
      case "revenue":
        return "bg-emerald-500/10 text-emerald-700";
      case "expense":
        return "bg-red-500/10 text-red-500";
      case "tax":
        return "bg-amber-500/10 text-amber-700";
      default:
        return "";
    }
  };

  const handleOpenTaxConfig = (account: Account, groupType: string) => {
    if (groupType === "revenue" || groupType === "expense") {
      setTaxConfigAccount({ id: account.id, name: account.name });
    }
  };

  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground text-center">Loading chart of accounts...</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Chart of Accounts</h3>
        {!compact && (
          <div className="flex gap-2">
            {/* Copy from Property - only show if multiple properties exist */}
            {properties.length > 1 && (
              <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Copy className="h-4 w-4 mr-1" />
                    Copy from Property
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Copy Chart of Accounts</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Copy all account groups and accounts from another property to{" "}
                      <strong>{selectedProperty?.name}</strong>.
                    </p>
                    <div>
                      <Label>Source Property</Label>
                      <Select value={copySourcePropertyId} onValueChange={setCopySourcePropertyId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select property to copy from" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties
                            .filter((p) => p.id !== selectedProperty?.id)
                            .map((property) => (
                              <SelectItem key={property.id} value={property.id}>
                                {property.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Note: This will add groups and accounts to your current chart. Existing accounts will not be modified.
                    </p>
                    <Button 
                      onClick={handleCopyFromProperty} 
                      disabled={copying || !copySourcePropertyId}
                      className="w-full"
                    >
                      {copying ? "Copying..." : "Copy Chart of Accounts"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={isNewGroupDialogOpen} onOpenChange={setIsNewGroupDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Account Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Group Name</Label>
                    <AutoCapInput
                      placeholder="e.g., Current Assets"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Account Type</Label>
                    <Select value={newGroupType} onValueChange={setNewGroupType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asset">Asset</SelectItem>
                        <SelectItem value="liability">Liability</SelectItem>
                        <SelectItem value="equity">Equity</SelectItem>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="tax">Tax</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreateGroup} className="w-full">
                    Create Group
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isNewAccountDialogOpen} onOpenChange={setIsNewAccountDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Account Group</Label>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Account Code</Label>
                    <Input
                      placeholder="e.g., 1000"
                      value={newAccountCode}
                      onChange={(e) => setNewAccountCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Account Name</Label>
                    <AutoCapInput
                      placeholder="e.g., Cash"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <AutoCapInput
                      placeholder="Account description"
                      value={newAccountDescription}
                      onChange={(e) => setNewAccountDescription(e.target.value)}
                    />
                  </div>

                  {/* Tax-specific fields */}
                  {groups.find((g) => g.id === selectedGroupId)?.account_type === "tax" && (
                    <>
                      <div>
                        <Label>Tax Type</Label>
                        <Select value={newTaxCalcType} onValueChange={setNewTaxCalcType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAX_CALCULATION_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>
                          {newTaxCalcType === "percentage" || newTaxCalcType === "vat" || newTaxCalcType === "inclusive"
                            ? "Rate (%)"
                            : "Amount ($)"}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={
                            newTaxCalcType === "percentage" || newTaxCalcType === "vat" || newTaxCalcType === "inclusive"
                              ? "e.g., 7.5"
                              : "e.g., 5.00"
                          }
                          value={newTaxRateValue}
                          onChange={(e) => setNewTaxRateValue(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </>
                  )}

                  {/* Payment Type - show for asset/liability (payment accounts) */}
                  {(groups.find((g) => g.id === selectedGroupId)?.account_type === "asset" ||
                    groups.find((g) => g.id === selectedGroupId)?.account_type === "liability") && (
                    <div>
                      <Label>Payment Type (optional)</Label>
                      <Select value={newPaymentType} onValueChange={setNewPaymentType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment type for auto-matching" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {PAYMENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Used to auto-select account based on card brand when posting payments
                      </p>
                    </div>
                  )}

                  <div>
                    <Label>External/POS Code (optional)</Label>
                    <Input
                      placeholder="e.g., POS_RESTAURANT"
                      value={newExternalAccount}
                      onChange={(e) => setNewExternalAccount(e.target.value.toUpperCase())}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Used for POS and external system integrations
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-nightly-kpis"
                      checked={newIncludeInNightlyKpis}
                      onCheckedChange={(checked) => setNewIncludeInNightlyKpis(checked === true)}
                    />
                    <Label htmlFor="include-nightly-kpis" className="text-sm font-normal cursor-pointer">
                      Include in Nightly Revenue KPIs
                    </Label>
                  </div>

                  <Button onClick={handleCreateAccount} className="w-full">
                    Create Account
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Group Dialog */}
            <Dialog open={isEditGroupDialogOpen} onOpenChange={setIsEditGroupDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Account Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Group Name</Label>
                    <AutoCapInput
                      placeholder="e.g., Current Assets"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Account Type</Label>
                    <Select value={newGroupType} onValueChange={setNewGroupType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asset">Asset</SelectItem>
                        <SelectItem value="liability">Liability</SelectItem>
                        <SelectItem value="equity">Equity</SelectItem>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="tax">Tax</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleUpdateGroup} className="w-full">
                    Update Group
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Account Dialog */}
            <Dialog open={isEditAccountDialogOpen} onOpenChange={setIsEditAccountDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Account Group</Label>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Account Code</Label>
                    <Input
                      placeholder="e.g., 1000"
                      value={newAccountCode}
                      onChange={(e) => setNewAccountCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Account Name</Label>
                    <AutoCapInput
                      placeholder="e.g., Cash"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <AutoCapInput
                      placeholder="Account description"
                      value={newAccountDescription}
                      onChange={(e) => setNewAccountDescription(e.target.value)}
                    />
                  </div>

                  {/* Tax-specific fields */}
                  {groups.find((g) => g.id === selectedGroupId)?.account_type === "tax" && (
                    <>
                      <div>
                        <Label>Tax Type</Label>
                        <Select value={newTaxCalcType} onValueChange={setNewTaxCalcType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAX_CALCULATION_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>
                          {newTaxCalcType.startsWith("percentage") || newTaxCalcType === "vat_inclusive"
                            ? "Rate (%)"
                            : "Amount ($)"}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={
                            newTaxCalcType === "percentage" || newTaxCalcType === "vat" || newTaxCalcType === "inclusive"
                              ? "e.g., 7.5"
                              : "e.g., 5.00"
                          }
                          value={newTaxRateValue}
                          onChange={(e) => setNewTaxRateValue(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </>
                  )}

                  {/* Payment Type - show for asset/liability (payment accounts) */}
                  {(groups.find((g) => g.id === selectedGroupId)?.account_type === "asset" ||
                    groups.find((g) => g.id === selectedGroupId)?.account_type === "liability") && (
                    <div>
                      <Label>Payment Type (optional)</Label>
                      <Select value={newPaymentType} onValueChange={setNewPaymentType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment type for auto-matching" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {PAYMENT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Used to auto-select account based on card brand when posting payments
                      </p>
                    </div>
                  )}

                  <div>
                    <Label>External Account (optional)</Label>
                    <Input
                      placeholder="External system account code"
                      value={newExternalAccount}
                      onChange={(e) => setNewExternalAccount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Maps to your external accounting system
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-include-nightly-kpis"
                      checked={newIncludeInNightlyKpis}
                      onCheckedChange={(checked) => setNewIncludeInNightlyKpis(checked === true)}
                    />
                    <Label htmlFor="edit-include-nightly-kpis" className="text-sm font-normal cursor-pointer">
                      Include in Nightly Revenue KPIs
                    </Label>
                  </div>

                  <Button onClick={handleUpdateAccount} className="w-full">
                    Update Account
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No account groups created yet. Add a group to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <Collapsible
              key={group.id}
              open={expandedGroups.has(group.id)}
              onOpenChange={() => toggleGroup(group.id)}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full p-2 hover:bg-muted rounded-lg cursor-pointer">
                  <div className="flex items-center gap-2" onClick={() => toggleGroup(group.id)}>
                    {expandedGroups.has(group.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-medium">{group.name}</span>
                    <Badge className={getTypeBadgeColor(group.account_type)}>
                      {group.account_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {group.accounts.length} accounts
                    </span>
                    {!compact && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGroupId(group.id);
                            setNewAccountCode("");
                            setNewAccountName("");
                            setNewAccountDescription("");
                            setNewTaxCalcType("percentage");
                            setNewTaxRateValue(0);
                            setIsNewAccountDialogOpen(true);
                          }}
                          title="Add account to this group"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditGroup(group);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(group.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {group.accounts.length > 0 ? (
                  <Table>
                    <TableBody>
                      {group.accounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="pl-8 font-mono">{account.code}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {account.name}
                              {(group.account_type === "revenue" || group.account_type === "expense") && accountTaxCounts[account.id] > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {accountTaxCounts[account.id]} tax{accountTaxCounts[account.id] > 1 ? "es" : ""}
                                </Badge>
                              )}
                              {group.account_type === "tax" && account.tax_calculation_type && (
                                <Badge variant="secondary" className="text-xs">
                                  {account.tax_calculation_type.startsWith("percentage") || account.tax_calculation_type === "vat_inclusive"
                                    ? `${account.tax_rate_value}%`
                                    : `$${account.tax_rate_value}`}
                                  {" "}
                                  {TAX_CALCULATION_TYPES.find(t => t.value === account.tax_calculation_type)?.label}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {account.description}
                          </TableCell>
                          <TableCell>
                            {account.external_account && (
                              <Badge variant="outline" className="text-xs font-mono">
                                {account.external_account}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{account.normal_balance}</Badge>
                          </TableCell>
                          {!compact && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {account.include_in_nightly_kpis && (
                                  <span title="Included in Nightly Revenue KPIs">
                                    <Home className="h-3.5 w-3.5 text-blue-500 mt-1.5" />
                                  </span>
                                )}
                                {(group.account_type === "revenue" || group.account_type === "expense") && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => handleOpenTaxConfig(account, group.account_type)}
                                    title="Configure taxes"
                                  >
                                    <Receipt className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleEditAccount(account, group.id)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteAccount(account.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-sm pl-8 py-2">
                    No accounts in this group
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Tax Configuration Dialog */}
      {taxConfigAccount && (
        <TaxConfigDialog
          open={!!taxConfigAccount}
          onOpenChange={(open) => {
            if (!open) {
              setTaxConfigAccount(null);
              loadAccounts(); // Refresh to update tax counts
            }
          }}
          revenueAccountId={taxConfigAccount.id}
          revenueAccountName={taxConfigAccount.name}
        />
      )}
    </Card>
  );
};