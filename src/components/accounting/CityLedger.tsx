import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { 
  Plus, 
  Search, 
  Building2, 
  ArrowLeft,
  FileText,
  Mail,
  Printer,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useProperty } from "@/contexts/PropertyContext";
import { CityLedgerAgingChart } from "./CityLedgerAgingChart";
import { CityLedgerInvoices } from "./CityLedgerInvoices";
import { CityLedgerPayment } from "./CityLedgerPayment";
import { CityLedgerStatement } from "./CityLedgerStatement";
import { CityLedgerAgingReport } from "./CityLedgerAgingReport";

interface LedgerAccount {
  id: string;
  ledger_type: string;
  balance: number;
  is_active: boolean;
  opened_at: string;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  street_address: string | null;
  street_address_2: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  country: string | null;
  phone: string | null;
  payment_terms_days: number | null;
  credit_limit: number | null;
  account_number: string | null;
  guest_id: string | null;
  guests?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface Invoice {
  id: string;
  city_ledger_account_id: string;
  source_folio_id: string | null;
  reservation_id: string | null;
  confirmation_number: string | null;
  guest_name: string | null;
  room_number: string | null;
  checkout_date: string | null;
  transfer_date: string;
  original_amount: number;
  paid_amount: number;
  status: "open" | "partial" | "paid";
  notes: string | null;
  property_id: string;
  created_at: string;
}

type AccountFilter = "all" | "with_balance" | "overdue";

export const CityLedger = () => {
  const { selectedProperty } = useProperty();
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<LedgerAccount | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [isNewAccountDialogOpen, setIsNewAccountDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isStatementDialogOpen, setIsStatementDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("accounts");

  // New account form state
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newStreetAddress, setNewStreetAddress] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newZipcode, setNewZipcode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPaymentTerms, setNewPaymentTerms] = useState("30");

  useEffect(() => {
    if (selectedProperty?.id) {
      loadAccounts();
    }
  }, [selectedProperty?.id]);

  const loadAccounts = async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ledger_accounts")
        .select(`
          *,
          guests (
            first_name,
            last_name,
            email
          )
        `)
        .eq("property_id", selectedProperty.id)
        .eq("ledger_type", "city")
        .eq("is_active", true)
        .order("company_name");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error loading accounts:", error);
      toast.error("Failed to load city ledger accounts");
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async (accountId: string) => {
    try {
      const { data, error } = await supabase
        .from("city_ledger_invoices")
        .select("*")
        .eq("city_ledger_account_id", accountId)
        .order("transfer_date", { ascending: false });

      if (error) throw error;
      // Cast status to the correct union type
      const typedData = (data || []).map(inv => ({
        ...inv,
        status: inv.status as "open" | "partial" | "paid"
      }));
      setInvoices(typedData);
    } catch (error) {
      console.error("Error loading invoices:", error);
      toast.error("Failed to load invoices");
    }
  };

  const handleSelectAccount = (account: LedgerAccount) => {
    setSelectedAccount(account);
    loadInvoices(account.id);
    setActiveTab("detail");
  };

  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    setInvoices([]);
    setActiveTab("accounts");
  };

  const handleCreateAccount = async () => {
    if (!newCompanyName) {
      toast.error("Please enter a company name");
      return;
    }

    if (!selectedProperty?.id) {
      toast.error("No property selected");
      return;
    }

    try {
      // Generate account number
      const accountNumber = `CL-${Date.now().toString(36).toUpperCase()}`;

      const { error } = await supabase.from("ledger_accounts").insert({
        property_id: selectedProperty.id,
        ledger_type: "city",
        company_name: newCompanyName,
        contact_name: newContactName || null,
        contact_email: newContactEmail || null,
        street_address: newStreetAddress || null,
        city: newCity || null,
        state: newState || null,
        zipcode: newZipcode || null,
        phone: newPhone || null,
        payment_terms_days: parseInt(newPaymentTerms) || 30,
        account_number: accountNumber,
        balance: 0,
      });

      if (error) throw error;

      toast.success("City ledger account created");
      setIsNewAccountDialogOpen(false);
      resetNewAccountForm();
      loadAccounts();
    } catch (error) {
      console.error("Error creating account:", error);
      toast.error("Failed to create account");
    }
  };

  const resetNewAccountForm = () => {
    setNewCompanyName("");
    setNewContactName("");
    setNewContactEmail("");
    setNewStreetAddress("");
    setNewCity("");
    setNewState("");
    setNewZipcode("");
    setNewPhone("");
    setNewPaymentTerms("30");
  };

  const getAccountName = (account: LedgerAccount) => {
    if (account.company_name) return account.company_name;
    if (account.guests) {
      return `${account.guests.first_name} ${account.guests.last_name}`;
    }
    return "Unknown";
  };

  const getAgingData = (accountInvoices: Invoice[]) => {
    const now = new Date();
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };

    accountInvoices.forEach((inv) => {
      const balance = inv.original_amount - inv.paid_amount;
      if (balance <= 0) return;

      const days = differenceInDays(now, new Date(inv.transfer_date));
      if (days <= 30) aging.current += balance;
      else if (days <= 60) aging.days30 += balance;
      else if (days <= 90) aging.days60 += balance;
      else if (days <= 120) aging.days90 += balance;
      else aging.over90 += balance;
    });

    return aging;
  };

  const getAgingBadge = (openedAt: string) => {
    const days = differenceInDays(new Date(), new Date(openedAt));
    if (days <= 30) return <Badge variant="secondary">{days}d</Badge>;
    if (days <= 60) return <Badge className="bg-yellow-500/10 text-yellow-700">{days}d</Badge>;
    if (days <= 90) return <Badge className="bg-orange-500/10 text-orange-700">{days}d</Badge>;
    return <Badge variant="destructive">{days}d</Badge>;
  };

  const filteredAccounts = accounts.filter((account) => {
    // Search filter
    if (searchTerm) {
      const name = getAccountName(account).toLowerCase();
      if (!name.includes(searchTerm.toLowerCase())) return false;
    }

    // Status filter
    if (filter === "with_balance" && account.balance <= 0) return false;
    if (filter === "overdue") {
      const days = differenceInDays(new Date(), new Date(account.opened_at));
      if (days <= 30 || account.balance <= 0) return false;
    }

    return true;
  });

  const handlePaymentComplete = () => {
    setIsPaymentDialogOpen(false);
    loadAccounts();
    if (selectedAccount) {
      loadInvoices(selectedAccount.id);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="detail" disabled={!selectedAccount}>
            Account Detail
          </TabsTrigger>
          <TabsTrigger value="aging">Aging Report</TabsTrigger>
        </TabsList>

        {/* Accounts List Tab */}
        <TabsContent value="accounts" className="mt-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">City Ledger Accounts</h3>
              <Dialog open={isNewAccountDialogOpen} onOpenChange={setIsNewAccountDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New Account
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>New City Ledger Account</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                      <Label>Company Name *</Label>
                      <Input
                        placeholder="Company name"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Contact Name</Label>
                        <Input
                          placeholder="Contact name"
                          value={newContactName}
                          onChange={(e) => setNewContactName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Contact Email</Label>
                        <Input
                          type="email"
                          placeholder="email@company.com"
                          value={newContactEmail}
                          onChange={(e) => setNewContactEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Street Address</Label>
                      <Input
                        placeholder="Street address"
                        value={newStreetAddress}
                        onChange={(e) => setNewStreetAddress(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>City</Label>
                        <Input
                          placeholder="City"
                          value={newCity}
                          onChange={(e) => setNewCity(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>State</Label>
                        <Input
                          placeholder="State"
                          value={newState}
                          onChange={(e) => setNewState(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Zipcode</Label>
                        <Input
                          placeholder="Zipcode"
                          value={newZipcode}
                          onChange={(e) => setNewZipcode(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Phone</Label>
                        <Input
                          placeholder="Phone"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Payment Terms (days)</Label>
                        <Input
                          type="number"
                          placeholder="30"
                          value={newPaymentTerms}
                          onChange={(e) => setNewPaymentTerms(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button onClick={handleCreateAccount} className="w-full">
                      Create Account
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={filter === "with_balance" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("with_balance")}
                >
                  With Balance
                </Button>
                <Button
                  variant={filter === "overdue" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("overdue")}
                >
                  Overdue
                </Button>
              </div>
            </div>

            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : filteredAccounts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No accounts found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Age</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow
                      key={account.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSelectAccount(account)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{getAccountName(account)}</div>
                            {account.account_number && (
                              <div className="text-xs text-muted-foreground">
                                {account.account_number}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {account.contact_name || "-"}
                          {account.contact_email && (
                            <div className="text-xs text-muted-foreground">
                              {account.contact_email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{account.phone || "-"}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-semibold ${
                            account.balance > 0 ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          ${Math.abs(account.balance).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>{getAgingBadge(account.opened_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Account Detail Tab */}
        <TabsContent value="detail" className="mt-4">
          {selectedAccount && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <Button variant="ghost" size="sm" onClick={handleBackToAccounts}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {getAccountName(selectedAccount)}
                      </h3>
                      {selectedAccount.account_number && (
                        <p className="text-sm text-muted-foreground">
                          Account #: {selectedAccount.account_number}
                        </p>
                      )}
                      <div className="text-sm text-muted-foreground mt-1">
                        {selectedAccount.street_address && <div>{selectedAccount.street_address}</div>}
                        {(selectedAccount.city || selectedAccount.state || selectedAccount.zipcode) && (
                          <div>
                            {selectedAccount.city}, {selectedAccount.state} {selectedAccount.zipcode}
                          </div>
                        )}
                        {selectedAccount.contact_name && <div>Contact: {selectedAccount.contact_name}</div>}
                        {selectedAccount.contact_email && <div>{selectedAccount.contact_email}</div>}
                        {selectedAccount.phone && <div>{selectedAccount.phone}</div>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Balance Due</p>
                    <p
                      className={`text-2xl font-bold ${
                        selectedAccount.balance > 0 ? "text-destructive" : "text-primary"
                      }`}
                    >
                      ${Math.abs(selectedAccount.balance).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Terms: Net {selectedAccount.payment_terms_days || 30}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setIsPaymentDialogOpen(true)}>
                    Post Payment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsStatementDialogOpen(true)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Statement
                  </Button>
                </div>
              </Card>

              {/* Aging Chart */}
              <div className="grid md:grid-cols-3 gap-4">
                <Card className="p-4 md:col-span-1">
                  <h4 className="font-medium mb-2">Invoice Aging</h4>
                  <CityLedgerAgingChart data={getAgingData(invoices)} size="small" />
                </Card>
                <Card className="p-4 md:col-span-2">
                  <h4 className="font-medium mb-2">Aging Summary</h4>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {[
                      { label: "Current", value: getAgingData(invoices).current, color: "text-green-600" },
                      { label: "1-30", value: getAgingData(invoices).days30, color: "text-yellow-600" },
                      { label: "31-60", value: getAgingData(invoices).days60, color: "text-orange-600" },
                      { label: "61-90", value: getAgingData(invoices).days90, color: "text-red-600" },
                      { label: "90+", value: getAgingData(invoices).over90, color: "text-red-800" },
                    ].map((item) => (
                      <div key={item.label} className="p-2 rounded-lg bg-muted/50">
                        <div className="text-xs text-muted-foreground">{item.label}</div>
                        <div className={`font-semibold ${item.color}`}>
                          ${item.value.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Invoices */}
              <Card className="p-4">
                <h4 className="font-medium mb-4">Invoices</h4>
                <CityLedgerInvoices invoices={invoices} />
              </Card>

              {/* Payment Dialog */}
              <CityLedgerPayment
                open={isPaymentDialogOpen}
                onOpenChange={setIsPaymentDialogOpen}
                account={selectedAccount}
                invoices={invoices.filter((i) => i.status !== "paid")}
                onComplete={handlePaymentComplete}
              />

              {/* Statement Dialog */}
              <CityLedgerStatement
                open={isStatementDialogOpen}
                onOpenChange={setIsStatementDialogOpen}
                account={selectedAccount}
                invoices={invoices}
              />
            </div>
          )}
        </TabsContent>

        {/* Aging Report Tab */}
        <TabsContent value="aging" className="mt-4">
          <CityLedgerAgingReport
            accounts={accounts}
            propertyId={selectedProperty?.id || ""}
            onSelectAccount={handleSelectAccount}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
