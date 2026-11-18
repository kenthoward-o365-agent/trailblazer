import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, User, Mail, Phone, MapPin, DollarSign, Moon, Pencil, Cake, Heart, Home } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MonthDayPicker, formatMonthDay } from "@/components/ui/month-day-picker";
import { AutoCapInput } from "@/components/ui/auto-cap-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { COUNTRIES } from "@/lib/countries";

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string;
  phone: string | null;
  phone2: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  country: string | null;
  birthday: string | null;
  anniversary: string | null;
  likes_dislikes: string | null;
  favorite_site_id: string | null;
  created_at: string;
  origin_property_id: string | null;
}

interface FavoriteSite {
  id: string;
  site_number: string;
  site_types: { name: string } | null;
}

interface Stay {
  id: string;
  check_in_date: string;
  check_out_date: string;
  total_price: number;
  status: string;
  source_of_business: {
    code: string;
    definition: string;
  } | null;
  sites: {
    site_number: string;
  } | null;
  properties: {
    id: string;
    name: string;
  } | null;
}

interface EditForm {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phone2: string;
  streetAddress: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  birthday: string | null;
  anniversary: string | null;
  likesDislikes: string;
  favoriteSiteId: string;
}

const GuestProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [guest, setGuest] = useState<Guest | null>(null);
  const [stays, setStays] = useState<Stay[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    title: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    phone2: "",
    streetAddress: "",
    city: "",
    state: "",
    zipcode: "",
    country: "",
    birthday: null,
    anniversary: null,
    likesDislikes: "",
    favoriteSiteId: "",
  });
  const [availableSites, setAvailableSites] = useState<FavoriteSite[]>([]);
  const [favoriteSite, setFavoriteSite] = useState<FavoriteSite | null>(null);

  useEffect(() => {
    if (id) {
      loadGuestProfile();
    }
  }, [id]);

  const loadGuestProfile = async () => {
    setLoading(true);
    try {
      // Load guest with favorite site info
      const { data: guestData, error: guestError } = await supabase
        .from("guests")
        .select("*, favorite_site:favorite_site_id (id, site_number, site_types (name))")
        .eq("id", id)
        .single();

      if (guestError) throw guestError;
      setGuest(guestData);
      setFavoriteSite(guestData.favorite_site as FavoriteSite | null);

      // Load stays (org-wide for shared guest profiles)
      const { data: staysData, error: staysError } = await supabase
        .from("reservations")
        .select(`
          id,
          check_in_date,
          check_out_date,
          total_price,
          status,
          source_of_business (code, definition),
          sites (site_number),
          properties (id, name)
        `)
        .eq("guest_id", id)
        .order("check_in_date", { ascending: false });

      if (staysError) throw staysError;
      setStays(staysData as Stay[] || []);
    } catch (error) {
      console.error("Failed to load guest profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = () => {
    if (!guest) return;
    setEditForm({
      title: guest.title || "",
      firstName: guest.first_name,
      lastName: guest.last_name,
      email: guest.email,
      phone: guest.phone || "",
      phone2: guest.phone2 || "",
      streetAddress: guest.street_address || "",
      city: guest.city || "",
      state: guest.state || "",
      zipcode: guest.zipcode || "",
      country: guest.country || "",
      birthday: guest.birthday,
      anniversary: guest.anniversary,
      likesDislikes: guest.likes_dislikes || "",
      favoriteSiteId: guest.favorite_site_id || "",
    });
    
    // Load available sites for favorite room selection
    if (guest.origin_property_id) {
      loadAvailableSites(guest.origin_property_id);
    }
    
    setEditDialogOpen(true);
  };

  const loadAvailableSites = async (propertyId: string) => {
    const { data } = await supabase
      .from("sites")
      .select("id, site_number, site_types (name)")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("site_number");
    
    setAvailableSites((data as FavoriteSite[]) || []);
  };

  const saveGuestProfile = async () => {
    if (!guest) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("guests")
        .update({
          title: editForm.title || null,
          first_name: editForm.firstName,
          last_name: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone || null,
          phone2: editForm.phone2 || null,
          street_address: editForm.streetAddress || null,
          city: editForm.city || null,
          state: editForm.state || null,
          zipcode: editForm.zipcode || null,
          country: editForm.country || null,
          birthday: editForm.birthday,
          anniversary: editForm.anniversary,
          likes_dislikes: editForm.likesDislikes || null,
          favorite_site_id: editForm.favoriteSiteId || null,
        })
        .eq("id", guest.id);

      if (error) throw error;

      toast.success("Guest profile updated");
      setEditDialogOpen(false);
      loadGuestProfile();
    } catch (error) {
      console.error("Failed to update guest:", error);
      toast.error("Failed to update guest profile");
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "CHECKED_IN":
        return "bg-blue-500";
      case "CHECKED_OUT":
        return "bg-muted";
      case "CONFIRMED":
        return "bg-green-500";
      case "PENDING":
        return "bg-yellow-500";
      case "CANCELLED":
        return "bg-destructive";
      default:
        return "bg-muted";
    }
  };

  // Navigate to appropriate page based on reservation status
  const getReservationNavigationPath = (reservation: Stay): string => {
    switch (reservation.status) {
      case "CHECKED_IN":
        // Go to in-house folio
        return `/in-house-guests?reservationId=${reservation.id}`;
      case "CHECKED_OUT":
        // Go to guest history with this reservation pre-selected
        return `/guest-history?reservationId=${reservation.id}`;
      case "CONFIRMED":
      case "PENDING":
      case "CANCELLED":
      default:
        // Go to reservation edit page for viewing/modifying
        return `/reservation/edit?id=${reservation.id}`;
    }
  };

  // Only count revenue from checked-out reservations
  const totalRevenue = stays
    .filter((s) => s.status === "CHECKED_OUT")
    .reduce((sum, s) => sum + parseFloat(String(s.total_price)), 0);

  // Only count nights from checked-out reservations
  const totalNights = stays
    .filter((s) => s.status === "CHECKED_OUT")
    .reduce((sum, s) => {
      const nights = differenceInDays(new Date(s.check_out_date), new Date(s.check_in_date));
      return sum + nights;
    }, 0);

  const hasPersonalDetails = guest?.birthday || guest?.anniversary || guest?.likes_dislikes || guest?.country || favoriteSite;

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Loading guest profile...</p>
      </DashboardLayout>
    );
  }

  if (!guest) {
    return (
      <DashboardLayout>
        <p className="text-destructive">Guest not found</p>
        <Button onClick={() => navigate("/guests")} className="mt-4">
          Back to Guests
        </Button>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/guests")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {guest.title && `${guest.title} `}
                {guest.first_name} {guest.last_name}
              </h1>
              <p className="text-muted-foreground">
                Guest since {format(new Date(guest.created_at), "MMMM yyyy")}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={openEditDialog}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Contact Information */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Contact Information
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>{guest.email}</span>
              </div>
              {guest.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div>{guest.phone}</div>
                    {guest.phone2 && (
                      <div className="text-muted-foreground text-sm">{guest.phone2}</div>
                    )}
                  </div>
                </div>
              )}
              {(guest.street_address || guest.city) && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    {guest.street_address && <div>{guest.street_address}</div>}
                    {(guest.city || guest.state || guest.zipcode) && (
                      <div>
                        {guest.city && guest.city}
                        {guest.city && guest.state && ", "}
                        {guest.state}
                        {guest.zipcode && ` ${guest.zipcode}`}
                      </div>
                    )}
                    {guest.country && (
                      <div className="text-muted-foreground text-sm">
                        {COUNTRIES.find(c => c.code === guest.country)?.name || guest.country}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Personal Details */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Cake className="h-5 w-5" />
              Personal Details
            </h2>
            {hasPersonalDetails ? (
              <div className="space-y-3">
                {guest.birthday && (
                  <div className="flex items-center gap-2">
                    <Cake className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Birthday:</span>
                    <span>{formatMonthDay(guest.birthday)}</span>
                  </div>
                )}
                {guest.anniversary && (
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Anniversary:</span>
                    <span>{formatMonthDay(guest.anniversary)}</span>
                  </div>
                )}
                {guest.likes_dislikes && (
                  <div>
                    <span className="text-muted-foreground text-sm">Preferences:</span>
                    <p className="mt-1 text-sm">{guest.likes_dislikes}</p>
                  </div>
                )}
                {favoriteSite && (
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Favorite Room:</span>
                    <span>#{favoriteSite.site_number} {favoriteSite.site_types?.name ? `- ${favoriteSite.site_types.name}` : ""}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No personal details recorded</p>
            )}
          </Card>

          {/* Stats Cards */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Stay Statistics
            </h2>
            <div className="text-4xl font-bold text-primary">{totalNights}</div>
            <p className="text-muted-foreground">Total Nights</p>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Lifetime Value
            </h2>
            <div className="text-4xl font-bold text-primary">${totalRevenue.toFixed(2)}</div>
            <p className="text-muted-foreground">Total Revenue</p>
          </Card>
        </div>

        {/* Stay History */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Stay History</h2>
          {stays.length === 0 ? (
            <p className="text-muted-foreground">No stays recorded</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arrival</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stays.map((stay) => (
                  <TableRow 
                    key={stay.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(getReservationNavigationPath(stay))}
                  >
                    <TableCell>{formatLocalDate(stay.check_in_date, "MMM d, yyyy")}</TableCell>
                    <TableCell>{formatLocalDate(stay.check_out_date, "MMM d, yyyy")}</TableCell>
                    <TableCell>{stay.properties?.name || "—"}</TableCell>
                    <TableCell>{stay.sites?.site_number || "—"}</TableCell>
                    <TableCell>
                      {stay.source_of_business ? (
                        <span title={stay.source_of_business.definition}>
                          {stay.source_of_business.code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(stay.status)}>
                        {stay.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {stay.status === "CHECKED_OUT" ? (
                        <span className="font-medium">${parseFloat(String(stay.total_price)).toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">${parseFloat(String(stay.total_price)).toFixed(2)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Edit Guest Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Guest Profile</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Select 
                  value={editForm.title} 
                  onValueChange={(value) => setEditForm({ ...editForm, title: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr.">Mr.</SelectItem>
                    <SelectItem value="Mrs.">Mrs.</SelectItem>
                    <SelectItem value="Ms.">Ms.</SelectItem>
                    <SelectItem value="Dr.">Dr.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">First Name *</Label>
                <Input
                  className="h-9"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Last Name *</Label>
                <Input
                  className="h-9"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                className="h-9"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Phone 1</Label>
                <PhoneInput
                  className="h-9"
                  value={editForm.phone}
                  onChange={(value) => setEditForm({ ...editForm, phone: value })}
                  countryCode={editForm.country}
                />
              </div>
              <div>
                <Label className="text-xs">Phone 2</Label>
                <PhoneInput
                  className="h-9"
                  value={editForm.phone2}
                  onChange={(value) => setEditForm({ ...editForm, phone2: value })}
                  countryCode={editForm.country}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Street Address</Label>
              <Input
                className="h-9"
                value={editForm.streetAddress}
                onChange={(e) => setEditForm({ ...editForm, streetAddress: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">City</Label>
                <Input
                  className="h-9"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">State</Label>
                <AutoCapInput
                  className="h-9"
                  autoCapMode="upper"
                  maxLength={2}
                  value={editForm.state}
                  onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Zipcode</Label>
                <Input
                  className="h-9"
                  value={editForm.zipcode}
                  onChange={(e) => setEditForm({ ...editForm, zipcode: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Country</Label>
                <Select 
                  value={editForm.country} 
                  onValueChange={(value) => setEditForm({ ...editForm, country: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MonthDayPicker
                label="Birthday"
                value={editForm.birthday}
                onChange={(value) => setEditForm({ ...editForm, birthday: value })}
              />
              <MonthDayPicker
                label="Anniversary"
                value={editForm.anniversary}
                onChange={(value) => setEditForm({ ...editForm, anniversary: value })}
              />
            </div>

            <div>
              <Label className="text-xs">Likes/Dislikes</Label>
              <Textarea
                className="resize-none"
                maxLength={250}
                value={editForm.likesDislikes}
                onChange={(e) => setEditForm({ ...editForm, likesDislikes: e.target.value })}
                placeholder="Guest preferences..."
              />
            </div>

            <div>
              <Label className="text-xs">Favorite Room</Label>
              <Select 
                value={editForm.favoriteSiteId} 
                onValueChange={(value) => setEditForm({ ...editForm, favoriteSiteId: value === "none" ? "" : value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select favorite room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      #{site.site_number} {site.site_types?.name ? `- ${site.site_types.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!guest?.origin_property_id && (
                <p className="text-xs text-muted-foreground mt-1">Guest has no origin property set</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveGuestProfile} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default GuestProfile;
