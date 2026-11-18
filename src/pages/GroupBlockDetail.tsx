import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Plus, Unlink, Building, AlertTriangle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPress } from "@/hooks/useLongPress";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { toast } from "sonner";
import { COUNTRIES } from "@/lib/countries";
import { GroupBlockAllocationGrid } from "@/components/GroupBlockAllocationGrid";
import { GroupBlockAvailabilityGrid } from "@/components/GroupBlockAvailabilityGrid";
import { GroupBlockPaymentCards } from "@/components/GroupBlockPaymentCards";
import { GroupBlockRevenueChart } from "@/components/GroupBlockRevenueChart";
import { GroupMasterDeposit } from "@/components/GroupMasterDeposit";
import { format } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";
import { lookupZip } from "@/lib/zipLookup";

interface CityLedger {
  id: string;
  company_name: string | null;
  account_number: string | null;
}
interface GroupBlockForm {
  code: string;
  description: string;
  street_address: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  contact_first_name: string;
  contact_last_name: string;
  contact_email: string;
  contact_phone: string;
  start_date: string;
  end_date: string;
  allow_other_room_types: boolean;
  allow_overbooking: boolean;
  has_master_account: boolean;
  master_contact_name: string;
  master_contact_email: string;
  master_contact_phone: string;
  charge_routing: string;
  status: string;
}

interface Allocation {
  id?: string;
  allocation_date: string;
  site_type_id: string | null;
  site_id: string | null;
  rooms_blocked: number;
  rate_id: string | null;
  override_rate: number | null;
}

interface GroupReservation {
  id: string;
  confirmation_number: string;
  site_id: string | null;
  site_type_id: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_price: number;
  guests: {
    first_name: string;
    last_name: string;
  } | null;
  sites: {
    site_number: string;
    site_types: {
      name: string;
    } | null;
  } | null;
}

interface SiteType {
  id: string;
  name: string;
}

interface Site {
  id: string;
  site_type_id: string;
}

const initialFormState: GroupBlockForm = {
  code: "",
  description: "",
  street_address: "",
  city: "",
  state: "",
  zipcode: "",
  country: "US",
  contact_first_name: "",
  contact_last_name: "",
  contact_email: "",
  contact_phone: "",
  start_date: "",
  end_date: "",
  allow_other_room_types: false,
  allow_overbooking: false,
  has_master_account: false,
  master_contact_name: "",
  master_contact_email: "",
  master_contact_phone: "",
  charge_routing: "all_charges",
  status: "active",
};

const GroupBlockDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();
  
  // Read tab from URL params (for returning from reservation edit)
  const initialTab = searchParams.get("tab") || "information";
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const [form, setForm] = useState<GroupBlockForm>(initialFormState);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [savedAllocations, setSavedAllocations] = useState<Allocation[]>([]);
  const [hasUnsavedAllocations, setHasUnsavedAllocations] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [reservations, setReservations] = useState<GroupReservation[]>([]);
  const [masterLedgerAccountId, setMasterLedgerAccountId] = useState<string | null>(null);
  const [cityLedgerAccountId, setCityLedgerAccountId] = useState<string | null>(null);
  const [cityLedgers, setCityLedgers] = useState<CityLedger[]>([]);
  const [siteTypes, setSiteTypes] = useState<SiteType[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isNew = !id;
  const duplicateFrom = location.state?.duplicateFrom;

  useEffect(() => {
    if (id) {
      loadGroupBlock();
    } else if (duplicateFrom) {
      // Pre-fill form with duplicate data (without id, dates, and code)
      setForm({
        ...initialFormState,
        description: duplicateFrom.description || "",
        street_address: duplicateFrom.street_address || "",
        city: duplicateFrom.city || "",
        state: duplicateFrom.state || "",
        zipcode: duplicateFrom.zipcode || "",
        country: duplicateFrom.country || "US",
        contact_first_name: duplicateFrom.contact_first_name || "",
        contact_last_name: duplicateFrom.contact_last_name || "",
        contact_email: duplicateFrom.contact_email || "",
        contact_phone: duplicateFrom.contact_phone || "",
        allow_other_room_types: duplicateFrom.allow_other_room_types || false,
        allow_overbooking: duplicateFrom.allow_overbooking || false,
        has_master_account: duplicateFrom.has_master_account || false,
        master_contact_name: duplicateFrom.master_contact_name || "",
        master_contact_email: duplicateFrom.master_contact_email || "",
        master_contact_phone: duplicateFrom.master_contact_phone || "",
        charge_routing: duplicateFrom.charge_routing || "all_charges",
      });
    }
  }, [id, duplicateFrom]);

  // Load city ledgers, site types, and sites for the property
  useEffect(() => {
    const loadPropertyData = async () => {
      if (!selectedProperty?.id) return;
      
      const ledgersRes = await supabase
        .from("ledger_accounts")
        .select("id, company_name, account_number")
        .eq("property_id", selectedProperty.id)
        .eq("ledger_type", "city")
        .eq("is_active", true)
        .order("company_name");

      const siteTypesRes = await supabase
        .from("site_types")
        .select("id, name")
        .eq("property_id", selectedProperty.id);

      const sitesRes = await supabase
        .from("sites")
        .select("id, site_type_id")
        .eq("property_id", selectedProperty.id)
        .eq("is_active", true);

      setCityLedgers(ledgersRes.data || []);
      setSiteTypes(siteTypesRes.data || []);
      setSites(sitesRes.data || []);
    };

    loadPropertyData();
  }, [selectedProperty?.id]);

  const loadGroupBlock = async () => {
    setLoading(true);
    const [blockRes, allocationsRes, reservationsRes] = await Promise.all([
      supabase
        .from("group_blocks")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("group_block_room_allocations")
        .select("*")
        .eq("group_block_id", id),
      supabase
        .from("reservations")
        .select(`
          id,
          confirmation_number,
          site_id,
          site_type_id,
          check_in_date,
          check_out_date,
          status,
          total_price,
          guests(first_name, last_name),
          sites(site_number, site_types(name))
        `)
        .eq("group_block_id", id)
        .order("check_in_date"),
    ]);

    if (blockRes.error || !blockRes.data) {
      toast.error("Failed to load group block");
      navigate("/group-blocks");
    } else {
      setForm({
        code: blockRes.data.code,
        description: blockRes.data.description || "",
        street_address: blockRes.data.street_address || "",
        city: blockRes.data.city || "",
        state: blockRes.data.state || "",
        zipcode: blockRes.data.zipcode || "",
        country: blockRes.data.country || "US",
        contact_first_name: blockRes.data.contact_first_name || "",
        contact_last_name: blockRes.data.contact_last_name || "",
        contact_email: blockRes.data.contact_email || "",
        contact_phone: blockRes.data.contact_phone || "",
        start_date: blockRes.data.start_date,
        end_date: blockRes.data.end_date,
        allow_other_room_types: blockRes.data.allow_other_room_types || false,
        allow_overbooking: blockRes.data.allow_overbooking || false,
        has_master_account: blockRes.data.has_master_account || false,
        master_contact_name: blockRes.data.master_contact_name || "",
        master_contact_email: blockRes.data.master_contact_email || "",
        master_contact_phone: blockRes.data.master_contact_phone || "",
        charge_routing: blockRes.data.charge_routing || "all_charges",
        status: blockRes.data.status || "active",
      });

      if (allocationsRes.data) {
        const loadedAllocations = allocationsRes.data.map((a) => ({
          id: a.id,
          allocation_date: a.allocation_date,
          site_type_id: a.site_type_id,
          site_id: a.site_id,
          rooms_blocked: a.rooms_blocked,
          rate_id: a.rate_id,
          override_rate: a.override_rate,
        }));
        setAllocations(loadedAllocations);
        setSavedAllocations(loadedAllocations);
        setHasUnsavedAllocations(false);
      }

      if (reservationsRes.data) {
        setReservations(reservationsRes.data as GroupReservation[]);
      }

      // Set master ledger account ID and city ledger account ID
      setMasterLedgerAccountId(blockRes.data.master_ledger_account_id || null);
      setCityLedgerAccountId(blockRes.data.city_ledger_account_id || null);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!selectedProperty?.id) {
      toast.error("No property selected");
      return;
    }

    if (!form.code || !form.start_date || !form.end_date) {
      toast.error("Code, start date, and end date are required");
      return;
    }

    if (form.code.length > 6) {
      toast.error("Code must be 6 characters or less");
      return;
    }

    setSaving(true);

    const payload = {
      property_id: selectedProperty.id,
      code: form.code.toUpperCase(),
      description: form.description || null,
      street_address: form.street_address || null,
      city: form.city || null,
      state: form.state || null,
      zipcode: form.zipcode || null,
      country: form.country,
      contact_first_name: form.contact_first_name || null,
      contact_last_name: form.contact_last_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      start_date: form.start_date,
      end_date: form.end_date,
      allow_other_room_types: form.allow_other_room_types,
      allow_overbooking: form.allow_overbooking,
      has_master_account: form.has_master_account,
      master_contact_name: form.master_contact_name || null,
      master_contact_email: form.master_contact_email || null,
      master_contact_phone: form.master_contact_phone || null,
      charge_routing: form.charge_routing,
      status: form.status,
      city_ledger_account_id: cityLedgerAccountId || null,
    };

    if (isNew) {
      const { data, error } = await supabase
        .from("group_blocks")
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("A group block with this code already exists");
        } else {
          toast.error("Failed to create group block");
          console.error(error);
        }
        setSaving(false);
        return;
      }

      // Create master ledger account if enabled
      if (form.has_master_account && data) {
        const { data: ledgerData, error: ledgerError } = await supabase
          .from("ledger_accounts")
          .insert({
            property_id: selectedProperty.id,
            ledger_type: "advance_deposit",
            company_name: `Group: ${form.code}`,
            contact_name: form.master_contact_name || null,
            contact_email: form.master_contact_email || null,
            balance: 0,
            is_active: true,
          })
          .select()
          .single();

        if (ledgerError) {
          console.error("Failed to create master ledger account:", ledgerError);
        } else if (ledgerData) {
          // Update the group block with the ledger account ID
          await supabase
            .from("group_blocks")
            .update({ master_ledger_account_id: ledgerData.id })
            .eq("id", data.id);
        }
      }

      // Save allocations if any
      if (allocations.length > 0 && data) {
        const allocationPayload = allocations.map((a) => ({
          group_block_id: data.id,
          allocation_date: a.allocation_date,
          site_type_id: a.site_type_id,
          site_id: a.site_id,
          rooms_blocked: a.rooms_blocked,
          rate_id: a.rate_id,
          override_rate: a.override_rate,
        }));

        const { error: allocError } = await supabase
          .from("group_block_room_allocations")
          .insert(allocationPayload);

        if (allocError) {
          console.error("Failed to save allocations:", allocError);
        }
      }

      toast.success("Group block created");
      navigate("/group-blocks");
    } else {
      const { error } = await supabase
        .from("group_blocks")
        .update(payload)
        .eq("id", id);

      if (error) {
        toast.error("Failed to update group block");
        console.error(error);
        setSaving(false);
        return;
      }

      // Create master ledger account if enabled and doesn't exist yet
      if (form.has_master_account && !masterLedgerAccountId) {
        const { data: ledgerData, error: ledgerError } = await supabase
          .from("ledger_accounts")
          .insert({
            property_id: selectedProperty.id,
            ledger_type: "advance_deposit",
            company_name: `Group: ${form.code}`,
            contact_name: form.master_contact_name || null,
            contact_email: form.master_contact_email || null,
            balance: 0,
            is_active: true,
          })
          .select()
          .single();

        if (ledgerError) {
          console.error("Failed to create master ledger account:", ledgerError);
        } else if (ledgerData) {
          await supabase
            .from("group_blocks")
            .update({ master_ledger_account_id: ledgerData.id })
            .eq("id", id);
          setMasterLedgerAccountId(ledgerData.id);
        }
      }

      // Update allocations: delete existing, insert new
      await supabase
        .from("group_block_room_allocations")
        .delete()
        .eq("group_block_id", id);

      if (allocations.length > 0) {
        // Constraint requires either site_type_id OR site_id, but not both
        const allocationPayload = allocations.map((a) => ({
          group_block_id: id,
          allocation_date: a.allocation_date,
          site_type_id: a.site_id ? null : a.site_type_id,
          site_id: a.site_id || null,
          rooms_blocked: a.rooms_blocked,
          rate_id: a.rate_id,
          override_rate: a.override_rate,
        }));

        const { error: allocError } = await supabase
          .from("group_block_room_allocations")
          .insert(allocationPayload);

        if (allocError) {
          console.error("Failed to save allocations:", allocError);
        }
      }

      // Update saved state to match current
      setSavedAllocations(allocations);
      setHasUnsavedAllocations(false);
      toast.success("Group block updated");
    }

    setSaving(false);
  };

  const commonCountries = COUNTRIES.slice(0, 4);
  const otherCountries = COUNTRIES.slice(4);

  // Detect unsaved allocation changes
  const checkForUnsavedChanges = () => {
    if (allocations.length !== savedAllocations.length) return true;
    
    const sortKey = (a: Allocation) => `${a.allocation_date}-${a.site_type_id || ''}-${a.site_id || ''}`;
    const sortedCurrent = [...allocations].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    const sortedSaved = [...savedAllocations].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    
    return sortedCurrent.some((curr, idx) => {
      const saved = sortedSaved[idx];
      return curr.allocation_date !== saved.allocation_date ||
             curr.site_type_id !== saved.site_type_id ||
             curr.site_id !== saved.site_id ||
             curr.rooms_blocked !== saved.rooms_blocked ||
             curr.override_rate !== saved.override_rate;
    });
  };

  // Update unsaved flag when allocations change
  useEffect(() => {
    if (!isNew) {
      setHasUnsavedAllocations(checkForUnsavedChanges());
    }
  }, [allocations, savedAllocations]);

  const handleBackClick = () => {
    if (hasUnsavedAllocations) {
      setPendingNavigation("/group-blocks");
      setShowUnsavedWarning(true);
    } else {
      navigate("/group-blocks");
    }
  };

  const handleDiscardChanges = () => {
    setAllocations(savedAllocations);
    setHasUnsavedAllocations(false);
    setShowUnsavedWarning(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
    }
  };

  const handleSaveAndContinue = async () => {
    setShowUnsavedWarning(false);
    await handleSave();
    if (pendingNavigation) {
      navigate(pendingNavigation);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Unsaved Changes Warning Dialog */}
      <AlertDialog open={showUnsavedWarning} onOpenChange={setShowUnsavedWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unsaved Site Allocations
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to the site block allocations. Would you like to save them before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardChanges}>
              Discard Changes
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndContinue}>
              Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBackClick}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {isNew ? "New Group Block" : `Group Block: ${form.code}`}
              </h1>
              <p className="text-muted-foreground">
                {isNew ? "Create a new group reservation block" : "Edit group block details"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedAllocations && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Unsaved site changes
              </Badge>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="information">Group Information</TabsTrigger>
            <TabsTrigger value="block">Block</TabsTrigger>
            <TabsTrigger value="reservations">Reservations</TabsTrigger>
            <TabsTrigger value="master">Master Account</TabsTrigger>
          </TabsList>

          {/* Tab 1: Group Information */}
          <TabsContent value="information" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="code">Code (6 char max) *</Label>
                      <Input
                        id="code"
                        value={form.code}
                        onChange={(e) =>
                          setForm({ ...form, code: e.target.value.toUpperCase().slice(0, 6) })
                        }
                        placeholder="GRP001"
                        maxLength={6}
                        className="font-mono"
                        disabled={!isNew}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={form.status}
                        onValueChange={(value) => setForm({ ...form, status: value })}
                        disabled={form.status === "active" && (reservations.length > 0 || savedAllocations.length > 0)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Wedding party, Corporate event, etc."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Group Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact_first_name">First Name</Label>
                      <Input
                        id="contact_first_name"
                        value={form.contact_first_name}
                        onChange={(e) => setForm({ ...form, contact_first_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_last_name">Last Name</Label>
                      <Input
                        id="contact_last_name"
                        value={form.contact_last_name}
                        onChange={(e) => setForm({ ...form, contact_last_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_email">Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={form.contact_email}
                      onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Phone</Label>
                    <Input
                      id="contact_phone"
                      value={form.contact_phone}
                      onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Address */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="street_address">Street Address</Label>
                    <Input
                      id="street_address"
                      value={form.street_address}
                      onChange={(e) => setForm({ ...form, street_address: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipcode">Zip Code</Label>
                      <Input
                        id="zipcode"
                        value={form.zipcode}
                        onChange={(e) => setForm({ ...form, zipcode: e.target.value })}
                        onBlur={async (e) => {
                          const zip = e.target.value.trim();
                          if (!zip) return;
                          const hit = await lookupZip(zip, form.country || "US");
                          if (hit) {
                            setForm((prev) => ({
                              ...prev,
                              city: prev.city || hit.city,
                              state: prev.state || hit.state,
                            }));
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Select
                        value={form.country}
                        onValueChange={(value) => setForm({ ...form, country: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {commonCountries.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                          <SelectItem disabled value="---">
                            ───────────
                          </SelectItem>
                          {otherCountries.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab 2: Block */}
          <TabsContent value="block" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[auto_1fr_280px]">
              <Card className="lg:w-[200px]">
                <CardHeader>
                  <CardTitle>Date Range</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">First Check-in Date *</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={form.start_date}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">Last Check-out Date *</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={form.end_date}
                        onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Block Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <GroupBlockAvailabilityGrid
                    startDate={form.start_date}
                    endDate={form.end_date}
                    allocations={allocations}
                    reservations={reservations.map(r => ({
                      site_id: r.site_id,
                      site_type_id: r.site_type_id,
                      check_in_date: r.check_in_date,
                      check_out_date: r.check_out_date,
                    }))}
                    siteTypes={siteTypes}
                    sites={sites}
                  />
                </CardContent>
              </Card>

              <GroupBlockRevenueChart
                allocations={allocations}
                reservations={reservations}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Site Allocations</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedProperty?.id && (
                  <GroupBlockAllocationGrid
                    groupBlockId={id || null}
                    propertyId={selectedProperty.id}
                    startDate={form.start_date}
                    endDate={form.end_date}
                    allocations={allocations}
                    onAllocationsChange={setAllocations}
                    reservations={reservations.map(r => ({
                      site_id: r.site_id,
                      check_in_date: r.check_in_date,
                      check_out_date: r.check_out_date,
                    }))}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Block Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allow_other_room_types"
                    checked={form.allow_other_room_types}
                    onChange={(e) =>
                      setForm({ ...form, allow_other_room_types: e.target.checked })
                    }
                    className="rounded border-input"
                  />
                  <Label htmlFor="allow_other_room_types" className="font-normal">
                    Allow other site types based on campground availability to book into group
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allow_overbooking"
                    checked={form.allow_overbooking}
                    onChange={(e) => setForm({ ...form, allow_overbooking: e.target.checked })}
                    className="rounded border-input"
                  />
                  <Label htmlFor="allow_overbooking" className="font-normal">
                    Allow overbookings into group block
                  </Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Reservations */}
          <TabsContent value="reservations" className="space-y-4">
            <ReservationsTab
              isNew={isNew}
              groupBlockId={id}
              reservations={reservations}
              setReservations={setReservations}
              allocations={allocations}
              terminology={terminology}
            />
          </TabsContent>

          {/* Tab 4: Master Account */}
          <TabsContent value="master" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Master Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="has_master_account"
                    checked={form.has_master_account}
                    onChange={(e) => setForm({ ...form, has_master_account: e.target.checked })}
                    className="rounded border-input"
                  />
                  <Label htmlFor="has_master_account" className="font-normal">
                    Enable Group Master Account
                  </Label>
                </div>

                {form.has_master_account && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="grid grid-cols-2 gap-4 max-w-lg">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="master_contact_name">Master Contact Name</Label>
                        <Input
                          id="master_contact_name"
                          value={form.master_contact_name}
                          onChange={(e) =>
                            setForm({ ...form, master_contact_name: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="master_contact_email">Email</Label>
                        <Input
                          id="master_contact_email"
                          type="email"
                          value={form.master_contact_email}
                          onChange={(e) =>
                            setForm({ ...form, master_contact_email: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="master_contact_phone">Phone</Label>
                        <Input
                          id="master_contact_phone"
                          value={form.master_contact_phone}
                          onChange={(e) =>
                            setForm({ ...form, master_contact_phone: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2 max-w-xs">
                      <Label>Charge Routing</Label>
                      <Select
                        value={form.charge_routing}
                        onValueChange={(value) => setForm({ ...form, charge_routing: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_charges">All Charges</SelectItem>
                          <SelectItem value="room_and_tax">Site & Tax Only</SelectItem>
                          <SelectItem value="master_account_only">Master Account Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* City Ledger Link */}
                    <div className="space-y-2 max-w-md">
                      <Label className="flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Link to City Ledger Account
                      </Label>
                      <Select
                        value={cityLedgerAccountId || "none"}
                        onValueChange={(value) => setCityLedgerAccountId(value === "none" ? null : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select city ledger account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No City Ledger</SelectItem>
                          {cityLedgers.map((cl) => (
                            <SelectItem key={cl.id} value={cl.id}>
                              {cl.company_name || "Unnamed"} {cl.account_number ? `(${cl.account_number})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Link this group to a city ledger account for direct billing
                      </p>
                    </div>

                    {/* Payment Features - Only show when group block is saved */}
                    {!isNew && id && selectedProperty?.id && (
                      <div className="space-y-4 pt-4 border-t">
                        <GroupBlockPaymentCards
                          groupBlockId={id}
                          propertyId={selectedProperty.id}
                        />
                        <GroupMasterDeposit
                          groupBlockId={id}
                          masterLedgerAccountId={masterLedgerAccountId}
                          propertyId={selectedProperty.id}
                          groupCode={form.code}
                        />
                      </div>
                    )}
                    {isNew && (
                      <div className="pt-4 border-t">
                        <p className="text-muted-foreground text-sm">
                          Save the group block to enable payment card capture and advance deposits.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

// Reservations Tab Component
interface ReservationsTabProps {
  isNew: boolean;
  groupBlockId?: string;
  reservations: GroupReservation[];
  setReservations: React.Dispatch<React.SetStateAction<GroupReservation[]>>;
  allocations: Allocation[];
  terminology: ReturnType<typeof usePropertyTerminology>;
}

const ReservationsTab = ({
  isNew,
  groupBlockId,
  reservations,
  setReservations,
  allocations,
  terminology,
}: ReservationsTabProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Calculate statistics
  const totalReservations = reservations.length;
  const totalRoomNights = reservations.reduce((acc, r) => {
    const checkIn = new Date(r.check_in_date);
    const checkOut = new Date(r.check_out_date);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    return acc + nights;
  }, 0);
  
  // Sum allocated room-nights
  const allocatedRoomNights = allocations.reduce((acc, a) => acc + a.rooms_blocked, 0);
  const pickupPercentage = allocatedRoomNights > 0 
    ? Math.round((totalRoomNights / allocatedRoomNights) * 100) 
    : 0;

  const handleAddReservation = () => {
    navigate(`/book?groupBlockId=${groupBlockId}`);
  };

  const handleViewReservation = (reservationId: string) => {
    navigate(`/reservation/edit?id=${reservationId}&from=group-block&groupBlockId=${groupBlockId}`);
  };

  // Sub-component for reservation row with long-press support
  const ReservationRow = ({ reservation }: { reservation: GroupReservation }) => {
    const longPressHandlers = useLongPress(() => handleViewReservation(reservation.id), 500);

    return (
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onDoubleClick={() => !isMobile && handleViewReservation(reservation.id)}
        {...(isMobile ? longPressHandlers : {})}
      >
        <TableCell className="font-mono">
          {reservation.confirmation_number}
        </TableCell>
        <TableCell>
          {reservation.guests
            ? `${reservation.guests.first_name} ${reservation.guests.last_name}`
            : "-"}
        </TableCell>
        <TableCell>
          {reservation.sites?.site_types?.name || "-"}
        </TableCell>
        <TableCell>
          {reservation.sites?.site_number || "-"}
        </TableCell>
        <TableCell>
          {formatLocalDate(reservation.check_in_date, "MMM d, yyyy")}
        </TableCell>
        <TableCell>
          {formatLocalDate(reservation.check_out_date, "MMM d, yyyy")}
        </TableCell>
        <TableCell>{getStatusBadge(reservation.status)}</TableCell>
        <TableCell className="text-right">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Unlink from group"
                onClick={(e) => e.stopPropagation()}
              >
                <Unlink className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unlink Reservation?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the reservation from this group block. The reservation
                  itself will not be cancelled.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleUnlinkReservation(reservation.id)}
                >
                  Unlink
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TableCell>
      </TableRow>
    );
  };

  const handleUnlinkReservation = async (reservationId: string) => {
    const { error } = await supabase
      .from("reservations")
      .update({ group_block_id: null })
      .eq("id", reservationId);

    if (error) {
      toast.error("Failed to unlink reservation");
      return;
    }

    setReservations(prev => prev.filter(r => r.id !== reservationId));
    toast.success("Reservation unlinked from group");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "outline",
      CONFIRMED: "secondary",
      CHECKED_IN: "default",
      CHECKED_OUT: "secondary",
      CANCELLED: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {status}
      </Badge>
    );
  };

  if (isNew) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Group Reservations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Save the group block first to add reservations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Reservations</p>
              <p className="text-2xl font-bold">{totalReservations}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{terminology.site} Nights Booked</p>
              <p className="text-2xl font-bold">{totalRoomNights}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Allocated</p>
              <p className="text-2xl font-bold">{allocatedRoomNights}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pickup</p>
              <p className="text-2xl font-bold">{pickupPercentage}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reservations Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Group Reservations</CardTitle>
          <Button onClick={handleAddReservation}>
            <Plus className="h-4 w-4 mr-2" />
            Add Reservation
          </Button>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No reservations linked to this group block yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conf #</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>{terminology.siteType}</TableHead>
                  <TableHead>{terminology.site} #</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((reservation) => (
                  <ReservationRow key={reservation.id} reservation={reservation} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupBlockDetail;
