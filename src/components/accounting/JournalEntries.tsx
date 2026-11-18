import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search, FileText, Trash2, Calculator } from "lucide-react";
import { format } from "date-fns";
import {
  getRevenueAccountTaxes,
  calculateTaxes,
  getTotalTaxAmount,
  type TaxConfig,
  type CalculatedTax,
  type TaxCalculationContext,
} from "@/lib/taxCalculations";
import { useProperty } from "@/contexts/PropertyContext";

interface JournalEntry {
  id: string;
  entry_date: string;
  reference_number: string | null;
  description: string;
  is_posted: boolean;
  created_at: string;
  lines: JournalEntryLine[];
}

interface JournalEntryLine {
  id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description: string | null;
  accounts?: {
    code: string;
    name: string;
  };
}

interface Account {
  id: string;
  code: string;
  name: string;
  account_type?: string;
}

export const JournalEntries = () => {
  const { selectedProperty } = useProperty();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [revenueAccountIds, setRevenueAccountIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewEntryDialogOpen, setIsNewEntryDialogOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [entryDescription, setEntryDescription] = useState("");
  const [entryReference, setEntryReference] = useState("");
  const [lines, setLines] = useState<
    { accountId: string; debit: string; credit: string; description: string }[]
  >([
    { accountId: "", debit: "", credit: "", description: "" },
    { accountId: "", debit: "", credit: "", description: "" },
  ]);
  
  // Tax calculation state
  const [calculatedTaxes, setCalculatedTaxes] = useState<CalculatedTax[]>([]);
  const [taxContext, setTaxContext] = useState<TaxCalculationContext>({ numberOfDays: 1, numberOfAdults: 1 });
  const [showTaxContext, setShowTaxContext] = useState(false);

  useEffect(() => {
    loadEntries();
    loadAccounts();
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("journal_entries")
        .select(`
          *,
          lines:journal_entry_lines (
            *,
            accounts (
              code,
              name
            )
          )
        `)
        .order("entry_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error("Error loading entries:", error);
      toast.error("Failed to load journal entries");
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      // Load accounts with their group types
      const { data, error } = await supabase
        .from("accounts")
        .select(`
          id, code, name,
          account_groups!inner(account_type)
        `)
        .eq("is_active", true)
        .order("code");

      if (error) throw error;
      
      // Extract revenue account IDs for tax calculation
      const revenueIds = new Set<string>();
      const accountsWithType = (data || []).map((acc: any) => {
        if (acc.account_groups?.account_type === "revenue") {
          revenueIds.add(acc.id);
        }
        return {
          id: acc.id,
          code: acc.code,
          name: acc.name,
          account_type: acc.account_groups?.account_type,
        };
      });
      
      setRevenueAccountIds(revenueIds);
      setAccounts(accountsWithType);
    } catch (error) {
      console.error("Error loading accounts:", error);
    }
  };

  const addLine = () => {
    setLines([...lines, { accountId: "", debit: "", credit: "", description: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = async (
    index: number,
    field: "accountId" | "debit" | "credit" | "description",
    value: string
  ) => {
    const newLines = [...lines];
    newLines[index][field] = value;
    setLines(newLines);
    
    // Auto-calculate taxes when a revenue account with a credit amount is entered
    if (field === "accountId" || field === "credit") {
      await recalculateTaxes(newLines);
    }
  };
  
  const recalculateTaxes = async (currentLines: typeof lines) => {
    // Find all revenue accounts with credit amounts
    const revenueLines = currentLines.filter(
      (line) => line.accountId && revenueAccountIds.has(line.accountId) && parseFloat(line.credit) > 0
    );
    
    if (revenueLines.length === 0) {
      setCalculatedTaxes([]);
      setShowTaxContext(false);
      return;
    }
    
    let allTaxes: CalculatedTax[] = [];
    let needsFlatRates = false;
    
    for (const line of revenueLines) {
      const taxConfigs = await getRevenueAccountTaxes(line.accountId);
      
      // Check if any flat rate taxes exist
      if (taxConfigs.some(t => 
        t.calculation_type === "flat_per_day" || 
        t.calculation_type === "flat_per_adult"
      )) {
        needsFlatRates = true;
      }
      
      if (taxConfigs.length > 0) {
        const taxes = calculateTaxes(parseFloat(line.credit), taxConfigs, taxContext);
        allTaxes = [...allTaxes, ...taxes];
      }
    }
    
    setShowTaxContext(needsFlatRates);
    setCalculatedTaxes(allTaxes);
  };
  
  const handleTaxContextChange = async (field: "numberOfDays" | "numberOfAdults", value: number) => {
    const newContext = { ...taxContext, [field]: value };
    setTaxContext(newContext);
    
    // Recalculate with new context
    const revenueLines = lines.filter(
      (line) => line.accountId && revenueAccountIds.has(line.accountId) && parseFloat(line.credit) > 0
    );
    
    let allTaxes: CalculatedTax[] = [];
    for (const line of revenueLines) {
      const taxConfigs = await getRevenueAccountTaxes(line.accountId);
      if (taxConfigs.length > 0) {
        const taxes = calculateTaxes(parseFloat(line.credit), taxConfigs, newContext);
        allTaxes = [...allTaxes, ...taxes];
      }
    }
    setCalculatedTaxes(allTaxes);
  };
  
  const addTaxLinesToEntry = () => {
    if (calculatedTaxes.length === 0) return;
    
    // Add tax credit lines
    const newLines = [...lines];
    for (const tax of calculatedTaxes) {
      if (tax.calculatedAmount > 0) {
        newLines.push({
          accountId: tax.taxAccountId,
          debit: "",
          credit: tax.calculatedAmount.toFixed(2),
          description: tax.description,
        });
      }
    }
    
    setLines(newLines);
    setCalculatedTaxes([]);
    toast.success("Tax lines added to entry");
  };

  const getTotalDebits = () => {
    return lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
  };

  const getTotalCredits = () => {
    return lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
  };

  const isBalanced = () => {
    const debits = getTotalDebits();
    const credits = getTotalCredits();
    return debits > 0 && Math.abs(debits - credits) < 0.01;
  };

  const handleCreateEntry = async () => {
    if (!entryDescription) {
      toast.error("Please enter a description");
      return;
    }

    if (!isBalanced()) {
      toast.error("Debits must equal credits");
      return;
    }

    const validLines = lines.filter(
      (line) => line.accountId && (parseFloat(line.debit) > 0 || parseFloat(line.credit) > 0)
    );

    if (validLines.length < 2) {
      toast.error("At least 2 valid lines are required");
      return;
    }

    try {
      if (!selectedProperty?.id) {
        toast.error("No property selected");
        return;
      }
      // Create journal entry header
      const { data: entry, error: entryError } = await supabase
        .from("journal_entries")
        .insert({
          property_id: selectedProperty.id,
          entry_date: entryDate,
          description: entryDescription,
          reference_number: entryReference || null,
          is_posted: true,
          posted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Create journal entry lines
      const lineInserts = validLines.map((line) => ({
        journal_entry_id: entry.id,
        account_id: line.accountId,
        debit_amount: parseFloat(line.debit) || 0,
        credit_amount: parseFloat(line.credit) || 0,
        description: line.description || null,
      }));

      const { error: linesError } = await supabase
        .from("journal_entry_lines")
        .insert(lineInserts);

      if (linesError) throw linesError;

      toast.success("Journal entry created");
      setIsNewEntryDialogOpen(false);
      resetForm();
      loadEntries();
    } catch (error) {
      console.error("Error creating entry:", error);
      toast.error("Failed to create journal entry");
    }
  };

  const resetForm = () => {
    setEntryDate(new Date().toISOString().split("T")[0]);
    setEntryDescription("");
    setEntryReference("");
    setLines([
      { accountId: "", debit: "", credit: "", description: "" },
      { accountId: "", debit: "", credit: "", description: "" },
    ]);
    setCalculatedTaxes([]);
    setTaxContext({ numberOfDays: 1, numberOfAdults: 1 });
    setShowTaxContext(false);
  };

  const filteredEntries = entries.filter((entry) => {
    if (!searchTerm) return true;
    return (
      entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.reference_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Journal Entries</h3>
        <Dialog open={isNewEntryDialogOpen} onOpenChange={setIsNewEntryDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Journal Entry</DialogTitle>
              <DialogDescription>
                Create a new journal entry with debit and credit lines. Taxes are auto-calculated for revenue accounts.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Reference #</Label>
                  <Input
                    placeholder="Optional"
                    value={entryReference}
                    onChange={(e) => setEntryReference(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    placeholder="Entry description"
                    value={entryDescription}
                    onChange={(e) => setEntryDescription(e.target.value)}
                  />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-32">Debit</TableHead>
                    <TableHead className="w-32">Credit</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={line.accountId}
                          onValueChange={(value) => updateLine(index, "accountId", value)}
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
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Line description"
                          value={line.description}
                          onChange={(e) => updateLine(index, "description", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={line.debit}
                          onChange={(e) => updateLine(index, "debit", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={line.credit}
                          onChange={(e) => updateLine(index, "credit", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 2}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={2} className="text-right font-semibold">
                      Totals:
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${getTotalDebits().toFixed(2)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${getTotalCredits().toFixed(2)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* Tax Calculation Panel */}
              {(calculatedTaxes.length > 0 || showTaxContext) && (
                <Card className="p-4 bg-muted/30 border-dashed">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Auto-Calculated Taxes</span>
                    </div>
                    {calculatedTaxes.length > 0 && (
                      <Button size="sm" variant="secondary" onClick={addTaxLinesToEntry}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add Tax Lines
                      </Button>
                    )}
                  </div>
                  
                  {showTaxContext && (
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <Label className="text-xs">Number of Days</Label>
                        <Input
                          type="number"
                          min="1"
                          value={taxContext.numberOfDays}
                          onChange={(e) => handleTaxContextChange("numberOfDays", parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Number of Adults</Label>
                        <Input
                          type="number"
                          min="1"
                          value={taxContext.numberOfAdults}
                          onChange={(e) => handleTaxContextChange("numberOfAdults", parseInt(e.target.value) || 1)}
                        />
                      </div>
                    </div>
                  )}
                  
                  {calculatedTaxes.length > 0 ? (
                    <div className="space-y-1">
                      {calculatedTaxes.map((tax, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {tax.taxAccountCode} - {tax.taxAccountName}
                            <span className="text-xs ml-2">({tax.description})</span>
                          </span>
                          <span className="font-medium">${tax.calculatedAmount.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                        <span>Total Taxes</span>
                        <span>${getTotalTaxAmount(calculatedTaxes).toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Enter days/adults above to calculate flat-rate taxes
                    </p>
                  )}
                </Card>
              )}

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
                <div className="flex items-center gap-4">
                  {!isBalanced() && getTotalDebits() > 0 && (
                    <span className="text-destructive text-sm">
                      Out of balance: ${Math.abs(getTotalDebits() - getTotalCredits()).toFixed(2)}
                    </span>
                  )}
                  <Button onClick={handleCreateEntry} disabled={!isBalanced()}>
                    Post Entry
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search entries..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : filteredEntries.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No journal entries found</p>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{entry.description}</span>
                  {entry.reference_number && (
                    <Badge variant="outline">Ref: {entry.reference_number}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={entry.is_posted ? "default" : "secondary"}>
                    {entry.is_posted ? "Posted" : "Draft"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(entry.entry_date), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
              <Table>
                <TableBody>
                  {entry.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-sm">
                        {line.accounts?.code}
                      </TableCell>
                      <TableCell>{line.accounts?.name}</TableCell>
                      <TableCell className="text-right">
                        {line.debit_amount > 0 ? `$${line.debit_amount.toFixed(2)}` : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.credit_amount > 0 ? `$${line.credit_amount.toFixed(2)}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
};