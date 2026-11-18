import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { PosImport } from "@/components/pos/PosImport";

interface Outlet { id: string; name: string; code: string | null; is_active: boolean; }
interface Category {
  id: string; name: string; sort_order: number; is_active: boolean;
  revenue_ledger_account_id: string | null;
}
interface Item {
  id: string; category_id: string | null; name: string; sku: string | null;
  image_url: string | null; base_price: number; cost: number | null;
  track_inventory: boolean; has_variants: boolean; is_active: boolean;
  revenue_ledger_account_id: string | null; tax_profile_id: string | null;
}
interface Variant {
  id: string; item_id: string; size: string | null; color: string | null;
  barcode: string | null; price_override: number | null; stock_qty: number;
  reorder_point: number | null; is_active: boolean;
}
interface RevenueAccount { id: string; code: string; name: string; }
interface TaxProfile { id: string; calculation_type: string; rate_value: number; revenue_account_id: string | null; }

const PosSetup = () => {
  const { selectedProperty } = useProperty();
  const propertyId = selectedProperty?.id;

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [revenueAccounts, setRevenueAccounts] = useState<RevenueAccount[]>([]);
  const [taxProfiles, setTaxProfiles] = useState<TaxProfile[]>([]);

  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [stockDialogVariant, setStockDialogVariant] = useState<Variant | null>(null);
  const [stockAdjust, setStockAdjust] = useState("");
  const [stockReason, setStockReason] = useState("receive");

  const refresh = async () => {
    if (!propertyId) return;
    const [{ data: os }, { data: cs }, { data: its }, { data: vs }, { data: ra }, { data: tp }] = await Promise.all([
      supabase.from("pos_outlets").select("*").eq("property_id", propertyId).order("name"),
      supabase.from("pos_categories").select("*").eq("property_id", propertyId).order("sort_order"),
      supabase.from("pos_items").select("*").eq("property_id", propertyId).order("name"),
      supabase.from("pos_item_variants").select("*").eq("property_id", propertyId),
      supabase.from("accounts")
        .select("id, code, name, account_groups!inner(account_type)")
        .eq("property_id", propertyId)
        .eq("account_groups.account_type", "revenue")
        .eq("is_active", true)
        .order("code"),
      supabase.from("account_taxes").select("id, calculation_type, rate_value, revenue_account_id").eq("property_id", propertyId).eq("is_active", true),
    ]);
    setOutlets((os as Outlet[]) || []);
    setCategories((cs as Category[]) || []);
    setItems((its as Item[]) || []);
    setVariants((vs as Variant[]) || []);
    setRevenueAccounts(((ra as any[]) || []).map((a) => ({ id: a.id, code: a.code, name: a.name })));
    setTaxProfiles((tp as TaxProfile[]) || []);
  };

  useEffect(() => { refresh(); }, [propertyId]);

  // Outlets
  const addOutlet = async () => {
    const name = prompt("Outlet name?");
    if (!name || !propertyId) return;
    const { error } = await supabase.from("pos_outlets").insert({ property_id: propertyId, name });
    if (error) toast.error(error.message); else refresh();
  };
  const toggleOutlet = async (o: Outlet) => {
    await supabase.from("pos_outlets").update({ is_active: !o.is_active }).eq("id", o.id);
    refresh();
  };
  const removeOutlet = async (o: Outlet) => {
    if (!confirm(`Delete outlet "${o.name}"?`)) return;
    await supabase.from("pos_outlets").delete().eq("id", o.id);
    refresh();
  };

  // Categories
  const openNewCategory = () => {
    setEditingCategory({ name: "", sort_order: categories.length, revenue_ledger_account_id: null });
    setCategoryDialogOpen(true);
  };
  const openEditCategory = (c: Category) => { setEditingCategory(c); setCategoryDialogOpen(true); };
  const removeCategory = async (c: Category) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    await supabase.from("pos_categories").delete().eq("id", c.id);
    refresh();
  };

  const openNewItem = () => {
    setEditingItem({
      id: "", category_id: categories[0]?.id || null, name: "", sku: null, image_url: null,
      base_price: 0, cost: null, track_inventory: true, has_variants: false, is_active: true,
      revenue_ledger_account_id: null, tax_profile_id: null,
    });
    setItemDialogOpen(true);
  };

  const stockAdjustSubmit = async () => {
    if (!stockDialogVariant || !propertyId) return;
    const delta = parseFloat(stockAdjust);
    if (isNaN(delta)) return toast.error("Enter a number");
    const newQty = Number(stockDialogVariant.stock_qty) + delta;
    await supabase.from("pos_item_variants").update({ stock_qty: newQty }).eq("id", stockDialogVariant.id);
    await supabase.from("pos_inventory_movements").insert({
      property_id: propertyId, variant_id: stockDialogVariant.id, change_qty: delta, reason: stockReason,
    });
    setStockDialogVariant(null); setStockAdjust(""); refresh();
    toast.success("Stock updated");
  };

  const acctLabel = (id: string | null) => {
    if (!id) return "—";
    const a = revenueAccounts.find((x) => x.id === id);
    return a ? `${a.code} · ${a.name}` : "—";
  };
  const taxesForAccount = (accountId: string | null) => {
    if (!accountId) return [] as TaxProfile[];
    return taxProfiles.filter((t) => t.revenue_account_id === accountId);
  };
  const taxSummary = (accountId: string | null) => {
    const list = taxesForAccount(accountId);
    if (list.length === 0) return "—";
    return list
      .map((t) => (t.calculation_type === "percentage" ? `${Number(t.rate_value).toFixed(2)}%` : `$${Number(t.rate_value).toFixed(2)}`))
      .join(" + ");
  };

  if (!propertyId) {
    return <DashboardLayout><div className="p-6">Select a property to configure POS.</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Point of Sale Setup</h1>
          <p className="text-muted-foreground">Outlets, categories, items, and inventory</p>
        </div>

        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items">Items & Inventory</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="outlets">Outlets</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-3">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">Items</h2>
              <Button onClick={openNewItem} disabled={categories.length === 0}>
                <Plus className="h-4 w-4 mr-1" /> New Item
              </Button>
            </div>
            {categories.length === 0 && (
              <Card className="p-4 text-sm text-muted-foreground">Create at least one category before adding items.</Card>
            )}
            {revenueAccounts.length === 0 && (
              <Card className="p-4 text-sm text-muted-foreground">
                No revenue accounts found. Set up your Chart of Accounts in <b>Accounting</b> so POS sales can post to GL.
              </Card>
            )}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>GL Account</TableHead>
                    <TableHead>Tax</TableHead>
                    <TableHead>Variants</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => {
                    const vs = variants.filter((v) => v.item_id === i.id);
                    const stock = vs.reduce((s, v) => s + Number(v.stock_qty || 0), 0);
                    const cat = categories.find((c) => c.id === i.category_id);
                    const gl = i.revenue_ledger_account_id ?? cat?.revenue_ledger_account_id ?? null;
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.name}</TableCell>
                        <TableCell>{cat?.name || "—"}</TableCell>
                        <TableCell>${Number(i.base_price).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{acctLabel(gl)}{!i.revenue_ledger_account_id && gl && <span className="text-muted-foreground"> (cat)</span>}</TableCell>
                        <TableCell className="text-xs">{taxSummary(gl)}</TableCell>
                        <TableCell>{vs.length}</TableCell>
                        <TableCell>
                          {i.track_inventory ? <Badge variant={stock <= 0 ? "destructive" : "secondary"}>{stock}</Badge> : "—"}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingItem(i); setItemDialogOpen(true); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {items.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No items yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            {items.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2"><Package className="h-4 w-4" /> Variants & Stock</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead><TableHead>Size</TableHead><TableHead>Color</TableHead>
                      <TableHead>Barcode</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((v) => {
                      const item = items.find((i) => i.id === v.item_id);
                      return (
                        <TableRow key={v.id}>
                          <TableCell>{item?.name}</TableCell>
                          <TableCell>{v.size || "—"}</TableCell>
                          <TableCell>{v.color || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{v.barcode || "—"}</TableCell>
                          <TableCell>${Number(v.price_override ?? item?.base_price ?? 0).toFixed(2)}</TableCell>
                          <TableCell>{Number(v.stock_qty)}</TableCell>
                          <TableCell><Button size="sm" variant="outline" onClick={() => setStockDialogVariant(v)}>Adjust</Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="categories">
            <div className="flex justify-between mb-3">
              <h2 className="text-lg font-semibold">Categories</h2>
              <Button onClick={openNewCategory}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>GL Account</TableHead><TableHead>Taxes (from GL)</TableHead>
                  <TableHead>Order</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-xs">{acctLabel(c.revenue_ledger_account_id)}</TableCell>
                      <TableCell className="text-xs">{taxSummary(c.revenue_ledger_account_id)}</TableCell>
                      <TableCell>{c.sort_order}</TableCell>
                      <TableCell className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditCategory(c)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => removeCategory(c)}><Trash2 className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {categories.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No categories</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="outlets">
            <div className="flex justify-between mb-3">
              <h2 className="text-lg font-semibold">Outlets</h2>
              <Button onClick={addOutlet}><Plus className="h-4 w-4 mr-1" /> Add Outlet</Button>
            </div>
            <Card>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {outlets.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell><Switch checked={o.is_active} onCheckedChange={() => toggleOutlet(o)} /></TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => removeOutlet(o)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {outlets.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No outlets</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <PosImport propertyId={propertyId} onImported={refresh} />
          </TabsContent>
        </Tabs>
      </div>

      <ItemEditorDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        item={editingItem}
        categories={categories}
        variants={variants.filter((v) => v.item_id === editingItem?.id)}
        propertyId={propertyId}
        revenueAccounts={revenueAccounts}
        taxProfiles={taxProfiles}
        onSaved={() => { setItemDialogOpen(false); refresh(); }}
      />

      <CategoryEditorDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        category={editingCategory}
        propertyId={propertyId}
        revenueAccounts={revenueAccounts}
        taxProfiles={taxProfiles}
        onSaved={() => { setCategoryDialogOpen(false); refresh(); }}
      />

      <Dialog open={!!stockDialogVariant} onOpenChange={(v) => !v && setStockDialogVariant(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">Current: <b>{Number(stockDialogVariant?.stock_qty || 0)}</b></div>
            <div>
              <Label>Change (+ receive / − remove)</Label>
              <Input type="number" step="0.01" value={stockAdjust} onChange={(e) => setStockAdjust(e.target.value)} />
            </div>
            <div>
              <Label>Reason</Label>
              <Select value={stockReason} onValueChange={setStockReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receive">Receive shipment</SelectItem>
                  <SelectItem value="adjustment">Manual adjustment</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="damage">Damage / write-off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialogVariant(null)}>Cancel</Button>
            <Button onClick={stockAdjustSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

// -------- Category editor --------
const CategoryEditorDialog = ({ open, onOpenChange, category, propertyId, revenueAccounts, taxProfiles, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  category: Partial<Category> | null; propertyId: string;
  revenueAccounts: RevenueAccount[]; taxProfiles: TaxProfile[]; onSaved: () => void;
}) => {
  const [form, setForm] = useState<Partial<Category> | null>(category);
  useEffect(() => { setForm(category); }, [category, open]);
  if (!form) return null;

  const glTaxes = form.revenue_ledger_account_id
    ? taxProfiles.filter((t) => t.revenue_account_id === form.revenue_ledger_account_id)
    : [];

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    const payload = {
      property_id: propertyId,
      name: form.name,
      sort_order: form.sort_order ?? 0,
      revenue_ledger_account_id: form.revenue_ledger_account_id || null,
    };
    const { error } = form.id
      ? await supabase.from("pos_categories").update(payload).eq("id", form.id)
      : await supabase.from("pos_categories").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Category saved");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{form.id ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Default GL Revenue Account</Label>
            <Select value={form.revenue_ledger_account_id || "none"} onValueChange={(v) => setForm({ ...form, revenue_ledger_account_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Select revenue account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {revenueAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border p-3 bg-muted/30">
            <Label className="text-xs uppercase text-muted-foreground">Taxes applied</Label>
            {glTaxes.length === 0 ? (
              <p className="text-sm mt-1">No taxes configured on this revenue account.</p>
            ) : (
              <ul className="text-sm mt-1 space-y-0.5">
                {glTaxes.map((t) => (
                  <li key={t.id}>
                    • {t.calculation_type === "percentage" ? `${Number(t.rate_value).toFixed(2)}%` : `$${Number(t.rate_value).toFixed(2)}`} ({t.calculation_type})
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Taxes are inherited from the Revenue Account (Accounting → Chart of Accounts). This avoids double-taxing sales.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// -------- Item editor with variants --------
interface ItemEditorProps {
  open: boolean; onOpenChange: (v: boolean) => void; item: Item | null;
  categories: Category[]; variants: Variant[]; propertyId: string;
  revenueAccounts: RevenueAccount[]; taxProfiles: TaxProfile[]; onSaved: () => void;
}

const ItemEditorDialog = ({ open, onOpenChange, item, categories, variants, propertyId, revenueAccounts, taxProfiles, onSaved }: ItemEditorProps) => {
  const [form, setForm] = useState<Item | null>(item);
  const [rows, setRows] = useState<Partial<Variant>[]>([]);
  const [sizesInput, setSizesInput] = useState("");
  const [colorsInput, setColorsInput] = useState("");

  useEffect(() => {
    setForm(item);
    setRows(item?.id ? variants : [{ size: null, color: null, stock_qty: 0 }]);
    setSizesInput(""); setColorsInput("");
  }, [item?.id, open]);

  if (!form) return null;

  const cat = categories.find((c) => c.id === form.category_id);
  const effectiveGl = form.revenue_ledger_account_id ?? cat?.revenue_ledger_account_id ?? null;
  const glTaxes = effectiveGl ? taxProfiles.filter((t) => t.revenue_account_id === effectiveGl) : [];

  const generateMatrix = () => {
    const sizes = sizesInput.split(",").map((s) => s.trim()).filter(Boolean);
    const colors = colorsInput.split(",").map((s) => s.trim()).filter(Boolean);
    const list: Partial<Variant>[] = [];
    const sArr = sizes.length ? sizes : [null];
    const cArr = colors.length ? colors : [null];
    for (const s of sArr) for (const c of cArr) list.push({ size: s, color: c, stock_qty: 0 });
    setRows(list);
    setForm({ ...form, has_variants: true });
  };

  const updateRow = (idx: number, patch: Partial<Variant>) => {
    setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  };
  const addRow = () => setRows((r) => [...r, { size: null, color: null, stock_qty: 0 }]);
  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    const payload = {
      category_id: form.category_id, name: form.name, sku: form.sku,
      image_url: form.image_url, base_price: form.base_price, cost: form.cost,
      track_inventory: form.track_inventory, has_variants: form.has_variants,
      revenue_ledger_account_id: form.revenue_ledger_account_id || null,
      tax_profile_id: null,
    };
    let itemId = form.id;
    if (!itemId) {
      const { data, error } = await supabase.from("pos_items").insert({ property_id: propertyId, ...payload }).select("id").single();
      if (error) return toast.error(error.message);
      itemId = data.id;
    } else {
      const { error } = await supabase.from("pos_items").update(payload).eq("id", itemId);
      if (error) return toast.error(error.message);
    }

    for (const r of rows) {
      if (r.id) {
        await supabase.from("pos_item_variants").update({
          size: r.size, color: r.color,
          price_override: r.price_override, stock_qty: r.stock_qty ?? 0, reorder_point: r.reorder_point,
        }).eq("id", r.id);
      } else {
        await supabase.from("pos_item_variants").insert({
          property_id: propertyId, item_id: itemId!,
          size: r.size, color: r.color,
          price_override: r.price_override, stock_qty: r.stock_qty ?? 0, reorder_point: r.reorder_point,
        });
      }
    }
    toast.success("Item saved");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>{form.id ? "Edit Item" : "New Item"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={form.category_id || ""} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>SKU</Label>
            <Input value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div>
            <Label>Image URL</Label>
            <Input value={form.image_url || ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
          </div>
          <div>
            <Label>Base Price</Label>
            <Input type="number" step="0.01" value={form.base_price}
              onChange={(e) => setForm({ ...form, base_price: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <Label>Cost</Label>
            <Input type="number" step="0.01" value={form.cost ?? ""}
              onChange={(e) => setForm({ ...form, cost: e.target.value ? parseFloat(e.target.value) : null })} />
          </div>
          <div>
            <Label>GL Revenue Account {cat?.revenue_ledger_account_id && !form.revenue_ledger_account_id && (
              <span className="text-xs text-muted-foreground font-normal">(inherits from category)</span>
            )}</Label>
            <Select
              value={form.revenue_ledger_account_id || "inherit"}
              onValueChange={(v) => setForm({ ...form, revenue_ledger_account_id: v === "inherit" ? null : v, tax_profile_id: null })}
            >
              <SelectTrigger><SelectValue placeholder="Select revenue account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">
                  — Use category default{cat?.revenue_ledger_account_id ? ` (${revenueAccounts.find(a => a.id === cat.revenue_ledger_account_id)?.code || ""})` : ""} —
                </SelectItem>
                {revenueAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border p-3 bg-muted/30">
            <Label className="text-xs uppercase text-muted-foreground">Taxes applied</Label>
            {glTaxes.length === 0 ? (
              <p className="text-sm mt-1">No taxes configured on this revenue account.</p>
            ) : (
              <ul className="text-sm mt-1 space-y-0.5">
                {glTaxes.map((t) => (
                  <li key={t.id}>
                    • {t.calculation_type === "percentage" ? `${Number(t.rate_value).toFixed(2)}%` : `$${Number(t.rate_value).toFixed(2)}`} ({t.calculation_type})
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Taxes come from the item's Revenue Account (Chart of Accounts) — no per-item override, to prevent double-taxation.
            </p>
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <Switch checked={form.track_inventory} onCheckedChange={(v) => setForm({ ...form, track_inventory: v })} />
            <Label>Track inventory</Label>
          </div>
        </div>

        <div className="border-t pt-3 mt-2 space-y-2">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1">
              <Label>Sizes (comma separated)</Label>
              <Input placeholder="S, M, L, XL" value={sizesInput} onChange={(e) => setSizesInput(e.target.value)} />
            </div>
            <div className="flex-1">
              <Label>Colors (comma separated)</Label>
              <Input placeholder="Red, Blue, Black" value={colorsInput} onChange={(e) => setColorsInput(e.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={generateMatrix}>Generate Matrix</Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Size</TableHead><TableHead>Color</TableHead>
                <TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Reorder</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id || i}>
                  <TableCell><Input value={r.size || ""} onChange={(e) => updateRow(i, { size: e.target.value || null })} /></TableCell>
                  <TableCell><Input value={r.color || ""} onChange={(e) => updateRow(i, { color: e.target.value || null })} /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={r.price_override ?? ""} onChange={(e) => updateRow(i, { price_override: e.target.value ? parseFloat(e.target.value) : null })} /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={r.stock_qty ?? 0} onChange={(e) => updateRow(i, { stock_qty: parseFloat(e.target.value) || 0 })} /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={r.reorder_point ?? ""} onChange={(e) => updateRow(i, { reorder_point: e.target.value ? parseFloat(e.target.value) : null })} /></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => removeRow(i)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-3 w-3 mr-1" /> Add variant row</Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save Item</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PosSetup;
