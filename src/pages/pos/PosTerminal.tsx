import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { useAuditDate } from "@/contexts/AuditDateContext";
import { toast } from "sonner";
import { Trash2, Plus, Minus, CreditCard, DollarSign, Home, ScanBarcode, Loader2, ShoppingCart, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdyenDropIn } from "@/components/payments/AdyenDropIn";
import { useNavigate, Link } from "react-router-dom";

interface Outlet { id: string; name: string; }
interface Category { id: string; name: string; }
interface Item {
  id: string;
  name: string;
  category_id: string | null;
  image_url: string | null;
  base_price: number;
  has_variants: boolean;
  track_inventory: boolean;
  is_active: boolean;
}
interface Variant {
  id: string;
  item_id: string;
  size: string | null;
  color: string | null;
  barcode: string | null;
  price_override: number | null;
  stock_qty: number;
  is_active: boolean;
}

interface CartLine {
  key: string;
  variant_id: string;
  item_id: string;
  item_name: string;
  variant_label: string;
  qty: number;
  unit_price: number;
}

interface InHouseReservation {
  id: string;
  confirmation_number: string | null;
  site_number: string | null;
  guest_name: string;
}

const PosTerminal = () => {
  const { selectedProperty } = useProperty();
  const { auditDate } = useAuditDate();
  const navigate = useNavigate();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [variantPickerItem, setVariantPickerItem] = useState<Item | null>(null);
  const [tenderOpen, setTenderOpen] = useState(false);
  const [tenderMode, setTenderMode] = useState<"card" | "cash" | "room" | null>(null);
  const [cashTendered, setCashTendered] = useState("");
  const [roomSearch, setRoomSearch] = useState("");
  const [roomLast, setRoomLast] = useState("");
  const [inHouse, setInHouse] = useState<InHouseReservation[]>([]);
  const [processing, setProcessing] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const scannerRef = useRef<HTMLInputElement>(null);

  const propertyId = selectedProperty?.id;

  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      const [{ data: os }, { data: cs }, { data: its }, { data: vs }] = await Promise.all([
        supabase.from("pos_outlets").select("id, name").eq("property_id", propertyId).eq("is_active", true).order("name"),
        supabase.from("pos_categories").select("id, name").eq("property_id", propertyId).eq("is_active", true).order("sort_order"),
        supabase.from("pos_items").select("*").eq("property_id", propertyId).eq("is_active", true).order("name"),
        supabase.from("pos_item_variants").select("*").eq("property_id", propertyId).eq("is_active", true),
      ]);
      setOutlets(os || []);
      setCategories(cs || []);
      setItems((its as Item[]) || []);
      setVariants((vs as Variant[]) || []);
      if (os?.[0] && !outletId) setOutletId(os[0].id);
    })();
  }, [propertyId]);

  useEffect(() => {
    scannerRef.current?.focus();
  }, []);

  const variantsByItem = useMemo(() => {
    const m = new Map<string, Variant[]>();
    for (const v of variants) {
      const arr = m.get(v.item_id) || [];
      arr.push(v);
      m.set(v.item_id, arr);
    }
    return m;
  }, [variants]);

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      if (activeCat !== "all" && i.category_id !== activeCat) return false;
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, activeCat, search]);

  const addToCart = (item: Item, variant: Variant) => {
    const price = variant.price_override ?? item.base_price;
    const label = [variant.size, variant.color].filter(Boolean).join(" / ") || "";
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.variant_id === variant.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          key: crypto.randomUUID(),
          variant_id: variant.id,
          item_id: item.id,
          item_name: item.name,
          variant_label: label,
          qty: 1,
          unit_price: Number(price),
        },
      ];
    });
  };

  const handleItemClick = (item: Item) => {
    const vs = variantsByItem.get(item.id) || [];
    if (item.has_variants && vs.length > 1) {
      setVariantPickerItem(item);
      return;
    }
    const v = vs[0];
    if (!v) {
      toast.error("This item has no variants configured. Add one in POS Setup.");
      return;
    }
    addToCart(item, v);
  };

  const handleBarcode = async (code: string) => {
    if (!code || !propertyId) return;
    const v = variants.find((x) => x.barcode === code);
    if (!v) {
      toast.error(`Barcode ${code} not found`);
      return;
    }
    const item = items.find((i) => i.id === v.item_id);
    if (!item) return;
    addToCart(item, v);
  };

  const subtotal = cart.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const tax = 0; // MVP: tax handled at accounting level; add per-category tax profile later
  const total = subtotal + tax;

  const updateQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
        .filter((l) => l.qty > 0),
    );
  };

  const openTender = (mode: "card" | "cash" | "room") => {
    if (cart.length === 0) return toast.error("Cart is empty");
    if (!outletId) return toast.error("Select an outlet first");
    setTenderMode(mode);
    setTenderOpen(true);
    setCashTendered("");
    if (mode === "room") loadInHouse();
  };

  const loadInHouse = async () => {
    if (!propertyId) return;
    const { data } = await supabase
      .from("reservations")
      .select("id, confirmation_number, site_id, sites(site_number), guests(first_name, last_name)")
      .eq("property_id", propertyId)
      .eq("status", "CHECKED_IN")
      .limit(500);
    const list: InHouseReservation[] = (data || []).map((r: any) => ({
      id: r.id,
      confirmation_number: r.confirmation_number,
      site_number: r.sites?.site_number || null,
      guest_name: [r.guests?.first_name, r.guests?.last_name].filter(Boolean).join(" ") || "Guest",
    }));
    setInHouse(list);
  };

  const filteredInHouse = useMemo(() => {
    return inHouse.filter((r) => {
      if (roomSearch && !(r.site_number || "").toLowerCase().includes(roomSearch.toLowerCase())) return false;
      if (roomLast && !r.guest_name.toLowerCase().includes(roomLast.toLowerCase())) return false;
      return true;
    });
  }, [inHouse, roomSearch, roomLast]);

  const decrementStock = async (lines: CartLine[]) => {
    for (const l of lines) {
      const v = variants.find((x) => x.id === l.variant_id);
      if (!v) continue;
      const item = items.find((i) => i.id === l.item_id);
      if (!item?.track_inventory) continue;
      const newQty = Number(v.stock_qty) - l.qty;
      await supabase.from("pos_item_variants").update({ stock_qty: newQty }).eq("id", v.id);
      await supabase.from("pos_inventory_movements").insert({
        property_id: propertyId!,
        variant_id: v.id,
        outlet_id: outletId,
        change_qty: -l.qty,
        reason: "sale",
      });
    }
  };

  const createOrder = async (opts: {
    tender_type: string;
    reservation_id?: string;
    folio_posting_id?: string;
    payment_transaction_id?: string;
    amount_tendered?: number;
    change_due?: number;
  }) => {
    if (!propertyId) throw new Error("No property");
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    const { data: order, error } = await supabase
      .from("pos_orders")
      .insert({
        property_id: propertyId,
        outlet_id: outletId,
        status: "paid",
        subtotal,
        tax,
        discount: 0,
        total,
        tender_type: opts.tender_type,
        amount_tendered: opts.amount_tendered,
        change_due: opts.change_due,
        reservation_id: opts.reservation_id,
        folio_posting_id: opts.folio_posting_id,
        payment_transaction_id: opts.payment_transaction_id,
        cashier_user_id: user?.id,
        cashier_name: user?.email,
        closed_at: new Date().toISOString(),
      })
      .select("id, order_number")
      .single();
    if (error) throw error;
    const lines = cart.map((l) => ({
      property_id: propertyId,
      order_id: order.id,
      variant_id: l.variant_id,
      item_name: l.item_name,
      variant_label: l.variant_label,
      qty: l.qty,
      unit_price: l.unit_price,
      line_total: l.qty * l.unit_price,
    }));
    await supabase.from("pos_order_items").insert(lines);
    await decrementStock(cart);
    return order;
  };

  const finalizeCash = async () => {
    setProcessing(true);
    try {
      const tendered = parseFloat(cashTendered || "0");
      if (tendered < total) {
        toast.error("Insufficient cash tendered");
        setProcessing(false);
        return;
      }
      const order = await createOrder({
        tender_type: "cash",
        amount_tendered: tendered,
        change_due: tendered - total,
      });
      toast.success(`Order ${order.order_number} paid. Change: $${(tendered - total).toFixed(2)}`);
      resetSale();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const finalizeRoomCharge = async (r: InHouseReservation) => {
    if (!propertyId) return;
    setProcessing(true);
    try {
      // Find guest ledger for reservation
      const { data: ledger } = await supabase
        .from("ledger_accounts")
        .select("id, balance")
        .eq("reservation_id", r.id)
        .eq("ledger_type", "guest")
        .maybeSingle();
      if (!ledger) {
        toast.error("No guest folio found for this reservation");
        setProcessing(false);
        return;
      }
      // Get current running balance
      const { data: last } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", ledger.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const currentBal = Number(last?.running_balance ?? ledger.balance ?? 0);
      const newBal = currentBal + total;
      const { data: userData } = await supabase.auth.getUser();
      const { data: posting, error: pErr } = await supabase
        .from("folio_postings")
        .insert({
          property_id: propertyId,
          ledger_account_id: ledger.id,
          posting_type: "charge",
          description: `POS charge - ${cart.length} item(s)`,
          amount: total,
          debit_amount: total,
          credit_amount: 0,
          running_balance: newBal,
          posting_date: auditDate,
          posted_by: userData.user?.id,
          posted_by_name: userData.user?.email,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;
      const order = await createOrder({
        tender_type: "room_charge",
        reservation_id: r.id,
        folio_posting_id: posting.id,
      });
      toast.success(`Order ${order.order_number} charged to ${r.guest_name}`);
      resetSale();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const finalizeCard = async (result: { sessionId: string }) => {
    setProcessing(true);
    try {
      // Look up most recent successful transaction for this session
      const { data: tx } = await supabase
        .from("payment_transactions")
        .select("id")
        .eq("property_id", propertyId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const order = await createOrder({
        tender_type: "card",
        payment_transaction_id: tx?.id,
      });
      toast.success(`Order ${order.order_number} paid by card`);
      resetSale();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const resetSale = () => {
    setCart([]);
    setTenderOpen(false);
    setTenderMode(null);
    setCashTendered("");
    setRoomSearch("");
    setRoomLast("");
    setMobileCartOpen(false);
    scannerRef.current?.focus();
  };

  if (!propertyId) {
    return (
      <DashboardLayout>
        <div className="p-6">Select a property to use POS.</div>
      </DashboardLayout>
    );
  }

  if (outlets.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">Point of Sale</h1>
          <Card className="p-8 text-center">
            <p className="mb-4">No outlets configured yet.</p>
            <Button asChild>
              <Link to="/settings/pos">Go to POS Setup</Link>
            </Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const activeOutlet = outlets.find((o) => o.id === outletId);

  const cartItemCount = cart.reduce((s, l) => s + l.qty, 0);

  const CartBody = (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {cart.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-12">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <Plus className="h-6 w-6 opacity-50" />
            </div>
            <div className="text-sm">Tap items to add</div>
          </div>
        )}
        {cart.map((l) => (
          <div key={l.key} className="rounded-lg border bg-background p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{l.item_name}</div>
                {l.variant_label && (
                  <div className="text-[11px] text-muted-foreground">{l.variant_label}</div>
                )}
                <div className="text-[11px] text-muted-foreground">${l.unit_price.toFixed(2)} each</div>
              </div>
              <div className="text-sm font-bold">${(l.unit_price * l.qty).toFixed(2)}</div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => updateQty(l.key, -1)}>
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center text-sm font-semibold">{l.qty}</span>
                <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => updateQty(l.key, 1)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>${tax.toFixed(2)}</span></div>
        <div className="flex justify-between font-bold text-xl pt-1"><span>Total</span><span>${total.toFixed(2)}</span></div>
      </div>

      <div className="p-3 grid grid-cols-3 gap-2 border-t bg-muted/30">
        <Button size="lg" className="h-14 flex-col gap-0.5 text-xs" onClick={() => openTender("cash")} disabled={cart.length === 0} variant="secondary">
          <DollarSign className="h-5 w-5" />
          Cash
        </Button>
        <Button size="lg" className="h-14 flex-col gap-0.5 text-xs" onClick={() => openTender("card")} disabled={cart.length === 0}>
          <CreditCard className="h-5 w-5" />
          Card
        </Button>
        <Button size="lg" className="h-14 flex-col gap-0.5 text-xs" onClick={() => openTender("room")} disabled={cart.length === 0} variant="outline">
          <Home className="h-5 w-5" />
          Room
        </Button>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/95 p-0 sm:p-3 md:p-5">
      {/* Terminal bezel */}
      <div className="w-full h-full max-w-[1600px] rounded-none sm:rounded-[28px] bg-primary shadow-2xl p-0 sm:p-2 md:p-3">
        {/* Screen */}
        <div className="w-full h-full rounded-none sm:rounded-[20px] bg-background overflow-hidden flex flex-col">
          {/* Top bar */}
          <div className="shrink-0 flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:h-14 border-b bg-card">
            <Select value={outletId} onValueChange={setOutletId}>
              <SelectTrigger className="w-40 md:w-56 h-10 font-semibold">
                <SelectValue placeholder="Outlet" />
              </SelectTrigger>
              <SelectContent>
                {outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[140px] md:max-w-lg order-3 md:order-none w-full md:w-auto">
              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={scannerRef}
                placeholder="Scan barcode…"
                className="pl-9 h-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleBarcode((e.target as HTMLInputElement).value.trim());
                    (e.target as HTMLInputElement).value = "";
                  }
                }}
              />
            </div>
            <Input
              placeholder="Search items"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="hidden md:block max-w-xs h-10"
            />
            <div className="ml-auto flex items-center gap-1 md:gap-2">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/settings/pos")}>Setup</Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                <Home className="h-4 w-4 md:mr-1" /> <span className="hidden sm:inline">Exit</span>
              </Button>
            </div>
          </div>

          {/* Mobile: category chips + search */}
          <div className="md:hidden shrink-0 border-b bg-muted/30 px-2 py-2 space-y-2">
            <Input
              placeholder="Search items"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                onClick={() => setActiveCat("all")}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${activeCat === "all" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}
              >
                All ({items.length})
              </button>
              {categories.map((c) => {
                const count = items.filter((i) => i.category_id === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${activeCat === c.id ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}
                  >
                    {c.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body: three panes on md+, single pane on mobile */}
          <div className="flex-1 min-h-0 flex">
            {/* Category rail (desktop/tablet only) */}
            <div className="hidden md:flex w-40 lg:w-48 shrink-0 border-r bg-muted/40 flex-col">
              <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Categories
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
                <CategoryTile
                  label="All Items"
                  active={activeCat === "all"}
                  onClick={() => setActiveCat("all")}
                  count={items.length}
                />
                {categories.map((c) => {
                  const count = items.filter((i) => i.category_id === c.id).length;
                  return (
                    <CategoryTile
                      key={c.id}
                      label={c.name}
                      active={activeCat === c.id}
                      onClick={() => setActiveCat(c.id)}
                      count={count}
                    />
                  );
                })}
              </div>
            </div>

            {/* Item grid */}
            <div className="flex-1 min-w-0 p-3 sm:p-4 pb-24 md:pb-4 overflow-hidden flex flex-col">
              <div className="flex items-baseline justify-between mb-2 px-1">
                <h2 className="text-sm font-semibold text-muted-foreground truncate">
                  {activeCat === "all" ? "All Items" : categories.find((c) => c.id === activeCat)?.name}
                </h2>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{filteredItems.length} items</span>
              </div>
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 auto-rows-[8rem] sm:auto-rows-[8.5rem]">
                  {filteredItems.map((item) => {
                    const vs = variantsByItem.get(item.id) || [];
                    const stock = vs.reduce((s, v) => s + Number(v.stock_qty || 0), 0);
                    const outOfStock = item.track_inventory && stock <= 0;
                    const catIndex = item.category_id
                      ? categories.findIndex((c) => c.id === item.category_id)
                      : -1;
                    const tone = getCategoryTone(catIndex, item.id);
                    const hasImage = !!item.image_url;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        disabled={outOfStock}
                        className={`group relative rounded-xl overflow-hidden text-left flex flex-col transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${
                          hasImage ? "bg-card border border-border" : ""
                        }`}
                        style={
                          hasImage
                            ? undefined
                            : {
                                background: `linear-gradient(160deg, hsl(${tone.h} ${tone.s}% ${tone.l}%) 0%, hsl(${tone.h} ${tone.s}% ${Math.max(tone.l - 8, 20)}%) 100%)`,
                                color: tone.fg,
                                boxShadow: `inset 0 -2px 0 hsl(${tone.h} ${tone.s}% ${Math.max(tone.l - 14, 15)}%)`,
                              }
                        }
                      >
                        {hasImage ? (
                          <>
                            <div className="flex-1 bg-muted/60 overflow-hidden">
                              <img src={item.image_url!} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="p-2 shrink-0">
                              <div className="text-sm font-semibold truncate">{item.name}</div>
                              <div className="flex justify-between items-center mt-0.5">
                                <span className="text-sm font-bold text-primary">${Number(item.base_price).toFixed(2)}</span>
                                {item.track_inventory && (
                                  <Badge variant={outOfStock ? "destructive" : "secondary"} className="text-[9px] px-1.5 py-0">
                                    {stock}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex-1 p-3 flex flex-col justify-between">
                            <div className="text-[13px] font-bold leading-tight line-clamp-3 drop-shadow-sm">
                              {item.name}
                            </div>
                            <div className="flex items-end justify-between mt-2">
                              <span className="text-base font-extrabold tracking-tight">
                                ${Number(item.base_price).toFixed(2)}
                              </span>
                              {item.track_inventory && (
                                <span
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ background: "rgba(0,0,0,0.22)", color: tone.fg }}
                                >
                                  {outOfStock ? "OUT" : stock}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <div className="col-span-full text-center text-muted-foreground py-12">
                      No items found. <Link to="/settings/pos" className="underline">Add items in POS Setup</Link>.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cart (desktop/tablet only) */}
            <div className="hidden md:flex w-72 lg:w-80 xl:w-96 shrink-0 border-l bg-card flex-col">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Order</div>
                  <div className="text-sm font-semibold">{activeOutlet?.name || "New Sale"}</div>
                </div>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setCart([])}>Clear</Button>
                )}
              </div>
              {CartBody}
            </div>
          </div>

          {/* Mobile: floating cart bar */}
          {cart.length > 0 && (
            <button
              onClick={() => setMobileCartOpen(true)}
              className="md:hidden fixed bottom-3 left-3 right-3 z-50 rounded-2xl bg-primary text-primary-foreground shadow-2xl px-4 py-3 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-[10px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                </div>
                <span className="text-sm font-semibold">View cart</span>
              </div>
              <span className="text-base font-bold">${total.toFixed(2)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile cart sheet */}
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="bottom" className="p-0 h-[90vh] flex flex-col md:hidden">
          <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <SheetTitle className="text-base">
              {activeOutlet?.name || "New Sale"} · {cartItemCount} item{cartItemCount === 1 ? "" : "s"}
            </SheetTitle>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCart([])}>Clear</Button>
            )}
          </SheetHeader>
          <div className="flex-1 min-h-0 flex flex-col">{CartBody}</div>
        </SheetContent>
      </Sheet>


      {/* Variant picker */}
      <Dialog open={!!variantPickerItem} onOpenChange={(v) => !v && setVariantPickerItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{variantPickerItem?.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {(variantPickerItem ? variantsByItem.get(variantPickerItem.id) || [] : []).map((v) => {
              const label = [v.size, v.color].filter(Boolean).join(" / ");
              return (
                <Button
                  key={v.id}
                  variant="outline"
                  className="h-auto flex flex-col py-3"
                  disabled={variantPickerItem?.track_inventory && Number(v.stock_qty) <= 0}
                  onClick={() => {
                    if (variantPickerItem) addToCart(variantPickerItem, v);
                    setVariantPickerItem(null);
                  }}
                >
                  <span>{label || "Default"}</span>
                  <span className="text-xs text-muted-foreground">Stock: {Number(v.stock_qty)}</span>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tender dialog */}
      <Dialog open={tenderOpen} onOpenChange={setTenderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {tenderMode === "cash" && "Cash Payment"}
              {tenderMode === "card" && "Card / Digital Wallet"}
              {tenderMode === "room" && "Charge to Room"}
            </DialogTitle>
          </DialogHeader>
          <div className="text-2xl font-bold text-center py-2">Total: ${total.toFixed(2)}</div>

          {tenderMode === "cash" && (
            <div className="space-y-3">
              <Input
                type="number"
                step="0.01"
                placeholder="Amount tendered"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
              />
              {parseFloat(cashTendered || "0") >= total && (
                <div className="text-sm">Change: <b>${(parseFloat(cashTendered) - total).toFixed(2)}</b></div>
              )}
              <Button className="w-full" onClick={finalizeCash} disabled={processing}>
                {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Complete Sale
              </Button>
            </div>
          )}

          {tenderMode === "card" && propertyId && (
            <div>
              <AdyenDropIn
                propertyId={propertyId}
                amount={Math.round(total * 100)}
                mode="sale"
                onComplete={(res) => finalizeCard(res)}
                onError={(e) => toast.error(e)}
              />
            </div>
          )}

          {tenderMode === "room" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Site #" value={roomSearch} onChange={(e) => setRoomSearch(e.target.value)} />
                <Input placeholder="Last name" value={roomLast} onChange={(e) => setRoomLast(e.target.value)} />
              </div>
              <div className="max-h-64 overflow-auto border rounded">
                {filteredInHouse.map((r) => (
                  <button
                    key={r.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted flex justify-between items-center"
                    onClick={() => finalizeRoomCharge(r)}
                    disabled={processing}
                  >
                    <div>
                      <div className="font-medium">{r.guest_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Site {r.site_number || "—"} · {r.confirmation_number}
                      </div>
                    </div>
                    <Home className="h-4 w-4" />
                  </button>
                ))}
                {filteredInHouse.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">No matching in-house guests</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

function CategoryTile({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg px-3 py-3 transition-all active:scale-[0.97] ${
        active
          ? "bg-primary text-primary-foreground shadow-md"
          : "bg-card border border-border hover:border-primary/40 hover:bg-card/80"
      }`}
    >
      <div className="text-sm font-semibold leading-tight">{label}</div>
      <div className={`text-[10px] mt-0.5 ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
        {count} {count === 1 ? "item" : "items"}
      </div>
    </button>
  );
}

// Category color palette derived from Trailblazer logo:
// deep emerald, forest, sage, aged gold, amber, terracotta, sunset orange, clay
const CATEGORY_TONES: { h: number; s: number; l: number; fg: string }[] = [
  { h: 162, s: 55, l: 32, fg: "#f7f4ec" }, // emerald
  { h: 152, s: 40, l: 38, fg: "#f7f4ec" }, // forest
  { h: 95,  s: 30, l: 42, fg: "#f7f4ec" }, // sage
  { h: 43,  s: 62, l: 48, fg: "#1a1a1a" }, // aged gold
  { h: 32,  s: 78, l: 52, fg: "#1a1a1a" }, // amber
  { h: 18,  s: 65, l: 48, fg: "#f7f4ec" }, // terracotta
  { h: 25,  s: 85, l: 52, fg: "#1a1a1a" }, // sunset orange
  { h: 12,  s: 45, l: 42, fg: "#f7f4ec" }, // clay
  { h: 175, s: 45, l: 34, fg: "#f7f4ec" }, // teal-emerald
  { h: 50,  s: 55, l: 55, fg: "#1a1a1a" }, // wheat
];

function getCategoryTone(catIndex: number, seed: string) {
  if (catIndex >= 0) return CATEGORY_TONES[catIndex % CATEGORY_TONES.length];
  // uncategorized: hash seed for stable variety
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return CATEGORY_TONES[h % CATEGORY_TONES.length];
}

export default PosTerminal;
