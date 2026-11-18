import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Bike } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["golf_cart", "bicycle", "kayak", "paddleboard", "tube", "boat", "other"] as const;

type RentalItem = {
  id: string;
  property_id: string;
  name: string;
  code: string | null;
  description: string | null;
  category: string;
  tracking_mode: "quantity" | "individual";
  total_quantity: number;
  hourly_rate: number | null;
  daily_rate: number | null;
  stay_rate: number | null;
  deposit_amount: number;
  is_active: boolean;
  messaging_offerable: boolean;
};

type RentalUnit = {
  id: string;
  rental_item_id: string;
  unit_label: string;
  asset_tag: string | null;
  status: string;
  notes: string | null;
};

type RentalReservation = {
  id: string;
  rental_item_id: string;
  rental_unit_id: string | null;
  reservation_id: string | null;
  guest_id: string | null;
  quantity: number;
  start_at: string;
  end_at: string;
  pricing_mode: string;
  rate_applied: number;
  total_charge: number;
  deposit_charged: number;
  source: string;
  status: string;
  notes: string | null;
};

const emptyItem = (): Partial<RentalItem> => ({
  name: "",
  category: "golf_cart",
  tracking_mode: "quantity",
  total_quantity: 1,
  hourly_rate: null,
  daily_rate: null,
  stay_rate: null,
  deposit_amount: 0,
  is_active: true,
  messaging_offerable: true,
});

export default function Rentals() {
  const { selectedProperty } = useProperty();
  const [items, setItems] = useState<RentalItem[]>([]);
  const [units, setUnits] = useState<RentalUnit[]>([]);
  const [bookings, setBookings] = useState<RentalReservation[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemDialog, setItemDialog] = useState(false);
  const [editItem, setEditItem] = useState<Partial<RentalItem> | null>(null);

  const [unitDialog, setUnitDialog] = useState(false);
  const [editUnit, setEditUnit] = useState<Partial<RentalUnit> | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const load = async () => {
    if (!selectedProperty?.id) return;
    setLoading(true);
    const [i, u, b] = await Promise.all([
      supabase.from("rental_items").select("*").eq("property_id", selectedProperty.id).order("name"),
      supabase.from("rental_units").select("*").eq("property_id", selectedProperty.id).order("unit_label"),
      supabase
        .from("rental_reservations")
        .select("*")
        .eq("property_id", selectedProperty.id)
        .order("start_at", { ascending: false })
        .limit(200),
    ]);
    setItems((i.data || []) as RentalItem[]);
    setUnits((u.data || []) as RentalUnit[]);
    setBookings((b.data || []) as RentalReservation[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedProperty?.id]);

  const saveItem = async () => {
    if (!editItem || !selectedProperty?.id) return;
    if (!editItem.name) {
      toast.error("Name is required");
      return;
    }
    const payload: any = {
      property_id: selectedProperty.id,
      name: editItem.name,
      code: editItem.code || null,
      description: editItem.description || null,
      category: editItem.category || "other",
      tracking_mode: editItem.tracking_mode || "quantity",
      total_quantity: editItem.total_quantity ?? 0,
      hourly_rate: editItem.hourly_rate ?? null,
      daily_rate: editItem.daily_rate ?? null,
      stay_rate: editItem.stay_rate ?? null,
      deposit_amount: editItem.deposit_amount ?? 0,
      is_active: editItem.is_active ?? true,
      messaging_offerable: editItem.messaging_offerable ?? true,
    };
    const { error } = editItem.id
      ? await supabase.from("rental_items").update(payload).eq("id", editItem.id)
      : await supabase.from("rental_items").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setItemDialog(false);
    setEditItem(null);
    load();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this rental item? This cannot be undone.")) return;
    const { error } = await supabase.from("rental_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const saveUnit = async () => {
    if (!editUnit || !selectedItemId) return;
    if (!editUnit.unit_label) {
      toast.error("Label is required");
      return;
    }
    const payload: any = {
      rental_item_id: selectedItemId,
      unit_label: editUnit.unit_label,
      asset_tag: editUnit.asset_tag || null,
      status: editUnit.status || "available",
      notes: editUnit.notes || null,
    };
    const { error } = editUnit.id
      ? await supabase.from("rental_units").update(payload).eq("id", editUnit.id)
      : await supabase.from("rental_units").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setUnitDialog(false);
    setEditUnit(null);
    load();
  };

  const deleteUnit = async (id: string) => {
    if (!confirm("Delete this unit?")) return;
    const { error } = await supabase.from("rental_units").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const updateBookingStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "checked_out") patch.checked_out_at = new Date().toISOString();
    if (status === "returned") patch.returned_at = new Date().toISOString();
    const { error } = await supabase.from("rental_reservations").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  };

  const itemById = (id: string) => items.find((i) => i.id === id);

  const outCount = (itemId: string) =>
    bookings
      .filter((b) => b.rental_item_id === itemId && ["reserved", "checked_out"].includes(b.status))
      .reduce((sum, b) => sum + b.quantity, 0);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Bike className="h-6 w-6" /> Rentals
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage golf carts, bicycles, kayaks and other rentable inventory.
            </p>
          </div>
        </div>

        <Tabs defaultValue="catalog">
          <TabsList>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="units">Units</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
          </TabsList>

          {/* CATALOG */}
          <TabsContent value="catalog" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditItem(emptyItem());
                  setItemDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> New rental item
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>On hand</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead>Hourly</TableHead>
                      <TableHead>Daily</TableHead>
                      <TableHead>Stay</TableHead>
                      <TableHead>Deposit</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && (
                      <TableRow>
                        <TableCell colSpan={11}>Loading...</TableCell>
                      </TableRow>
                    )}
                    {!loading && items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                          No rental items yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {items.map((it) => {
                      const total =
                        it.tracking_mode === "individual"
                          ? units.filter((u) => u.rental_item_id === it.id && u.status !== "retired").length
                          : it.total_quantity;
                      return (
                        <TableRow key={it.id}>
                          <TableCell className="font-medium">{it.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{it.category.replace("_", " ")}</Badge>
                          </TableCell>
                          <TableCell className="capitalize">{it.tracking_mode}</TableCell>
                          <TableCell>{total}</TableCell>
                          <TableCell>{outCount(it.id)}</TableCell>
                          <TableCell>{it.hourly_rate != null ? `$${it.hourly_rate}` : "—"}</TableCell>
                          <TableCell>{it.daily_rate != null ? `$${it.daily_rate}` : "—"}</TableCell>
                          <TableCell>{it.stay_rate != null ? `$${it.stay_rate}` : "—"}</TableCell>
                          <TableCell>${it.deposit_amount}</TableCell>
                          <TableCell>
                            <Badge variant={it.is_active ? "default" : "secondary"}>
                              {it.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditItem(it);
                                  setItemDialog(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => deleteItem(it.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* UNITS */}
          <TabsContent value="units" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Individual units</CardTitle>
                <CardDescription>
                  Track individual assets (e.g. Golf Cart #3). Only shown for items with tracking mode set to Individual.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Label>Rental item</Label>
                  <Select value={selectedItemId ?? ""} onValueChange={(v) => setSelectedItemId(v)}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {items
                        .filter((i) => i.tracking_mode === "individual")
                        .map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={!selectedItemId}
                    onClick={() => {
                      setEditUnit({ status: "available" });
                      setUnitDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add unit
                  </Button>
                </div>

                {selectedItemId && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Asset tag</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {units
                        .filter((u) => u.rental_item_id === selectedItemId)
                        .map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.unit_label}</TableCell>
                            <TableCell>{u.asset_tag || "—"}</TableCell>
                            <TableCell className="capitalize">
                              <Badge variant="outline">{u.status.replace("_", " ")}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{u.notes}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditUnit(u);
                                    setUnitDialog(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => deleteUnit(u.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BOOKINGS */}
          <TabsContent value="bookings" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Pricing</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-40">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No rental bookings yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {bookings.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>{itemById(b.rental_item_id)?.name || "—"}</TableCell>
                        <TableCell>{b.quantity}</TableCell>
                        <TableCell className="text-sm">{new Date(b.start_at).toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{new Date(b.end_at).toLocaleString()}</TableCell>
                        <TableCell className="capitalize">{b.pricing_mode}</TableCell>
                        <TableCell>${b.total_charge}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{b.source.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge>{b.status.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {b.status === "reserved" && (
                              <Button size="sm" variant="outline" onClick={() => updateBookingStatus(b.id, "checked_out")}>
                                Check out
                              </Button>
                            )}
                            {b.status === "checked_out" && (
                              <Button size="sm" variant="outline" onClick={() => updateBookingStatus(b.id, "returned")}>
                                Return
                              </Button>
                            )}
                            {["reserved", "checked_out"].includes(b.status) && (
                              <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(b.id, "cancelled")}>
                                Cancel
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Item dialog */}
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editItem?.id ? "Edit rental item" : "New rental item"}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Name</Label>
                <Input value={editItem.name || ""} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={editItem.code || ""}
                  onChange={(e) => setEditItem({ ...editItem, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editItem.category}
                  onValueChange={(v) => setEditItem({ ...editItem, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editItem.description || ""}
                  onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tracking mode</Label>
                <Select
                  value={editItem.tracking_mode}
                  onValueChange={(v: any) => setEditItem({ ...editItem, tracking_mode: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantity">Quantity only</SelectItem>
                    <SelectItem value="individual">Individual units</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total quantity</Label>
                <Input
                  type="number"
                  min={0}
                  value={editItem.total_quantity ?? 0}
                  disabled={editItem.tracking_mode === "individual"}
                  onChange={(e) =>
                    setEditItem({ ...editItem, total_quantity: parseInt(e.target.value || "0", 10) })
                  }
                />
                {editItem.tracking_mode === "individual" && (
                  <p className="text-xs text-muted-foreground">Managed via the Units tab.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Hourly rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editItem.hourly_rate ?? ""}
                  onChange={(e) =>
                    setEditItem({ ...editItem, hourly_rate: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Daily rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editItem.daily_rate ?? ""}
                  onChange={(e) =>
                    setEditItem({ ...editItem, daily_rate: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Stay rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editItem.stay_rate ?? ""}
                  onChange={(e) =>
                    setEditItem({ ...editItem, stay_rate: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Deposit</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editItem.deposit_amount ?? 0}
                  onChange={(e) =>
                    setEditItem({ ...editItem, deposit_amount: Number(e.target.value || 0) })
                  }
                />
              </div>
              <div className="flex items-center justify-between col-span-2 pt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editItem.is_active ?? true}
                    onCheckedChange={(v) => setEditItem({ ...editItem, is_active: v })}
                  />
                  <Label>Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editItem.messaging_offerable ?? true}
                    onCheckedChange={(v) => setEditItem({ ...editItem, messaging_offerable: v })}
                  />
                  <Label>Offer via Guest Messaging AI</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveItem}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit dialog */}
      <Dialog open={unitDialog} onOpenChange={setUnitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUnit?.id ? "Edit unit" : "New unit"}</DialogTitle>
          </DialogHeader>
          {editUnit && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={editUnit.unit_label || ""}
                  onChange={(e) => setEditUnit({ ...editUnit, unit_label: e.target.value })}
                  placeholder="e.g. Cart #3"
                />
              </div>
              <div className="space-y-2">
                <Label>Asset tag</Label>
                <Input
                  value={editUnit.asset_tag || ""}
                  onChange={(e) => setEditUnit({ ...editUnit, asset_tag: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editUnit.status || "available"}
                  onValueChange={(v) => setEditUnit({ ...editUnit, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="in_use">In use</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editUnit.notes || ""}
                  onChange={(e) => setEditUnit({ ...editUnit, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveUnit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
