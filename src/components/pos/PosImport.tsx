import { useState } from "react";
import Papa from "papaparse";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet, Package } from "lucide-react";

interface Props {
  propertyId: string;
  onImported: () => void;
}

const ITEMS_TEMPLATE = `category,name,sku,base_price,cost,track_inventory,size,color,barcode,price_override,stock_qty,reorder_point
Apparel,Camp T-Shirt,TSHIRT,24.99,8.50,true,S,Black,TSHIRT-S-BLK,,10,3
Apparel,Camp T-Shirt,TSHIRT,24.99,8.50,true,M,Black,TSHIRT-M-BLK,,15,3
Apparel,Camp T-Shirt,TSHIRT,24.99,8.50,true,L,Black,TSHIRT-L-BLK,,15,3
Apparel,Camp T-Shirt,TSHIRT,24.99,8.50,true,L,Red,TSHIRT-L-RED,26.99,8,3
Beverages,Bottled Water,WATER-500,2.00,0.40,true,,,072000000015,,48,12
Beverages,Coffee (Large),COFFEE-LG,4.50,,false,,,,,0,`;

const INVOICE_TEMPLATE = `barcode,sku,qty,unit_cost,note
TSHIRT-S-BLK,,12,8.50,PO#4432
TSHIRT-M-BLK,,24,8.50,PO#4432
,WATER-500,144,0.38,Case of 6x24`;

const downloadCsv = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const parseFile = (file: File): Promise<any[]> =>
  new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => {
        const k = h.trim().toLowerCase().replace(/[\s\-]+/g, "_");
        const aliases: Record<string, string> = {
          price: "base_price",
          unit_price: "base_price",
          retail_price: "base_price",
          item_name: "name",
          product_name: "name",
          product: "name",
          item: "name",
          category_name: "category",
          department: "category",
          upc: "barcode",
          ean: "barcode",
          item_sku: "sku",
          product_sku: "sku",
          unit_cost: "cost",
          item_cost: "cost",
          qty_on_hand: "stock_qty",
          quantity: "stock_qty",
          stock: "stock_qty",
          on_hand: "stock_qty",
          reorder: "reorder_point",
          min_qty: "reorder_point",
          override_price: "price_override",
          variant_price: "price_override",
        };
        return aliases[k] || k;
      },
      complete: (r) => resolve(r.data as any[]),
      error: reject,
    });
  });

const truthy = (v: any) =>
  v === true || ["true", "1", "yes", "y", "t", "on", "enabled"].includes(String(v ?? "").trim().toLowerCase());

const parseImportNumber = (value: any): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "").trim();
  if (!text) return null;

  const isNegative = /^\(.*\)$/.test(text);
  text = text.replace(/^\((.*)\)$/, "$1").replace(/[^0-9,.-]/g, "");
  if (!text || text === "." || text === "," || text === "-" || text === "-.") return null;

  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    text = lastComma > lastDot
      ? text.replace(/\./g, "").replace(/,/g, ".")
      : text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimals = text.length - lastComma - 1;
    text = decimals > 0 && decimals <= 2 ? text.replace(/,/g, ".") : text.replace(/,/g, "");
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return isNegative ? -parsed : parsed;
};

export const PosImport = ({ propertyId, onImported }: Props) => {
  const [itemsFile, setItemsFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [itemsPreview, setItemsPreview] = useState<any[] | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"upsert" | "update_only" | "create_only">("upsert");
  const [diff, setDiff] = useState<{ create: number; update: number; skip: number } | null>(null);

  const exportItems = async () => {
    setBusy(true);
    try {
      const [{ data: cats }, { data: its }, { data: vars }] = await Promise.all([
        supabase.from("pos_categories").select("id,name").eq("property_id", propertyId),
        supabase.from("pos_items").select("*").eq("property_id", propertyId),
        supabase.from("pos_item_variants").select("*").eq("property_id", propertyId),
      ]);
      const catById = new Map((cats || []).map((c: any) => [c.id, c.name]));
      const itemById = new Map((its || []).map((i: any) => [i.id, i]));
      const rows: any[] = [];
      const seenItems = new Set<string>();
      (vars || []).forEach((v: any) => {
        const item = itemById.get(v.item_id);
        if (!item) return;
        seenItems.add(item.id);
        rows.push({
          category: catById.get(item.category_id) || "",
          name: item.name,
          sku: item.sku || "",
          base_price: item.base_price ?? "",
          cost: item.cost ?? "",
          track_inventory: item.track_inventory,
          size: v.size || "",
          color: v.color || "",
          barcode: v.barcode || "",
          price_override: v.price_override ?? "",
          stock_qty: v.stock_qty ?? 0,
          reorder_point: v.reorder_point ?? "",
        });
      });
      // Items with no variants
      (its || []).forEach((item: any) => {
        if (seenItems.has(item.id)) return;
        rows.push({
          category: catById.get(item.category_id) || "",
          name: item.name,
          sku: item.sku || "",
          base_price: item.base_price ?? "",
          cost: item.cost ?? "",
          track_inventory: item.track_inventory,
          size: "",
          color: "",
          barcode: "",
          price_override: "",
          stock_qty: "",
          reorder_point: "",
        });
      });
      const csv = Papa.unparse(rows);
      downloadCsv(csv, `pos-items-export-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`Exported ${rows.length} rows`);
    } finally {
      setBusy(false);
    }
  };

  const previewItems = async (file: File) => {
    setItemsFile(file);
    setDiff(null);
    try {
      const rows = await parseFile(file);
      setItemsPreview(rows);
      // Compute diff against existing items (match by sku, else category+name)
      const { data: its } = await supabase
        .from("pos_items")
        .select("id,name,sku,category_id,pos_categories(name)")
        .eq("property_id", propertyId);
      const bySku = new Map<string, any>();
      const byKey = new Map<string, any>();
      (its || []).forEach((i: any) => {
        if (i.sku) bySku.set(i.sku.trim().toLowerCase(), i);
        const cn = i.pos_categories?.name?.toLowerCase() || "";
        byKey.set(`${cn}::${i.name.toLowerCase()}`, i);
      });
      const seen = new Set<string>();
      let create = 0, update = 0;
      rows.forEach((r: any) => {
        const cat = String(r.category || "").trim().toLowerCase();
        const name = String(r.name || "").trim().toLowerCase();
        const sku = r.sku ? String(r.sku).trim().toLowerCase() : "";
        if (!cat || !name) return;
        const key = sku ? `sku:${sku}` : `nk:${cat}::${name}`;
        if (seen.has(key)) return;
        seen.add(key);
        const match = (sku && bySku.get(sku)) || byKey.get(`${cat}::${name}`);
        if (match) update++;
        else create++;
      });
      setDiff({ create, update, skip: 0 });
    } catch (e: any) {
      toast.error("Failed to parse CSV: " + e.message);
    }
  };



  const previewInvoice = async (file: File) => {
    setInvoiceFile(file);
    try {
      const rows = await parseFile(file);
      setInvoicePreview(rows);
    } catch (e: any) {
      toast.error("Failed to parse CSV: " + e.message);
    }
  };

  const importItems = async () => {
    if (!itemsPreview?.length) return;
    setBusy(true);
    try {
      const { data: catsData } = await supabase
        .from("pos_categories")
        .select("id,name")
        .eq("property_id", propertyId);
      const catMap = new Map<string, string>(
        (catsData || []).map((c: any) => [c.name.toLowerCase(), c.id])
      );

      const { data: itemsData } = await supabase
        .from("pos_items")
        .select("id,name,sku,category_id")
        .eq("property_id", propertyId);
      const itemBySku = new Map<string, any>();
      const itemByKey = new Map<string, any>();
      (itemsData || []).forEach((i: any) => {
        if (i.sku) itemBySku.set(i.sku.trim().toLowerCase(), i);
        itemByKey.set(`${i.category_id}::${i.name.toLowerCase()}`, i);
      });

      const { data: varsData } = await supabase
        .from("pos_item_variants")
        .select("id,item_id,size,color,barcode")
        .eq("property_id", propertyId);
      const varByBarcode = new Map<string, any>();
      const varByKey = new Map<string, any>();
      (varsData || []).forEach((v: any) => {
        if (v.barcode) varByBarcode.set(v.barcode.trim().toLowerCase(), v);
        varByKey.set(
          `${v.item_id}::${(v.size || "").toLowerCase()}::${(v.color || "").toLowerCase()}`,
          v
        );
      });

      let createdCats = 0,
        createdItems = 0,
        updatedItems = 0,
        createdVariants = 0,
        updatedVariants = 0,
        skipped = 0,
        errors = 0;

      const groups = new Map<string, { header: any; rows: any[] }>();
      for (const r of itemsPreview) {
        const cat = String(r.category || "").trim();
        const name = String(r.name || "").trim();
        if (!cat || !name) {
          errors++;
          continue;
        }
        const key = `${cat.toLowerCase()}::${name.toLowerCase()}`;
        if (!groups.has(key)) groups.set(key, { header: r, rows: [] });
        groups.get(key)!.rows.push(r);
      }

      for (const { header, rows } of groups.values()) {
        const catName = String(header.category).trim();
        let catId = catMap.get(catName.toLowerCase());
        if (!catId) {
          if (mode === "update_only") {
            skipped++;
            continue;
          }
          const { data, error } = await supabase
            .from("pos_categories")
            .insert({ property_id: propertyId, name: catName, sort_order: catMap.size })
            .select("id")
            .single();
          if (error) {
            errors++;
            continue;
          }
          catId = data.id;
          catMap.set(catName.toLowerCase(), catId);
          createdCats++;
        }

        const sku = header.sku ? String(header.sku).trim() : "";
        const itemKey = `${catId}::${String(header.name).trim().toLowerCase()}`;
        const existing =
          (sku && itemBySku.get(sku.toLowerCase())) || itemByKey.get(itemKey);
        const hasVariants = rows.some(
          (r) => (r.size && String(r.size).trim()) || (r.color && String(r.color).trim())
        );

        // Pick pricing from any row in the group that has values (last non-empty wins).
        // Fixes: if a user edits price on a variant row (not the first), we still pick it up.
        const pickLast = (field: string) => {
          for (let i = rows.length - 1; i >= 0; i--) {
            const v = rows[i]?.[field];
            if (v !== undefined && v !== null && String(v).trim() !== "") return v;
          }
          return undefined;
        };
        const basePriceRaw = pickLast("base_price");
        const costRaw = pickLast("cost");
        const trackInvRaw = pickLast("track_inventory");

        const itemPayload: any = {
          category_id: catId,
          name: String(header.name).trim(),
          sku: sku || null,
          has_variants: hasVariants,
        };
        if (basePriceRaw !== undefined) {
          const parsed = parseImportNumber(basePriceRaw);
          if (parsed === null) {
            errors++;
            continue;
          }
          itemPayload.base_price = parsed;
        }
        if (costRaw !== undefined) {
          const parsed = parseImportNumber(costRaw);
          if (parsed === null) {
            errors++;
            continue;
          }
          itemPayload.cost = parsed;
        }
        if (trackInvRaw !== undefined)
          itemPayload.track_inventory = truthy(trackInvRaw);


        let itemId: string;
        if (existing) {
          if (mode === "create_only") {
            skipped++;
            continue;
          }
          const { data: updRows, error } = await supabase
            .from("pos_items")
            .update(itemPayload)
            .eq("id", existing.id)
            .select("id");
          if (error || !updRows || updRows.length === 0) {
            errors++;
            continue;
          }
          itemId = existing.id;
          updatedItems++;

        } else {
          if (mode === "update_only") {
            skipped++;
            continue;
          }
          const { data, error } = await supabase
            .from("pos_items")
            .insert({
              property_id: propertyId,
              ...itemPayload,
              base_price: itemPayload.base_price ?? 0,
              track_inventory: itemPayload.track_inventory ?? true,
            })
            .select("id")
            .single();
          if (error) {
            errors++;
            continue;
          }
          itemId = data.id;
          itemByKey.set(itemKey, { id: itemId, name: itemPayload.name, category_id: catId });
          if (sku) itemBySku.set(sku.toLowerCase(), { id: itemId });
          createdItems++;
        }

        for (const r of rows) {
          const size = r.size ? String(r.size).trim() : null;
          const color = r.color ? String(r.color).trim() : null;
          const barcode = r.barcode ? String(r.barcode).trim() : null;
          const variantKey = `${itemId}::${(size || "").toLowerCase()}::${(color || "").toLowerCase()}`;
          const existingVar =
            (barcode && varByBarcode.get(barcode.toLowerCase())) || varByKey.get(variantKey);

          const varPayload: any = { size, color };
          if (barcode) varPayload.barcode = barcode;
          // Explicitly set price_override: empty clears it, value updates it
          if (r.price_override !== undefined) {
            const s = String(r.price_override).trim();
            const parsed = parseImportNumber(s);
            if (s !== "" && parsed === null) {
              errors++;
              continue;
            }
            varPayload.price_override = s === "" ? null : parsed;
          }
          if (r.stock_qty !== undefined && r.stock_qty !== "")
            varPayload.stock_qty = parseImportNumber(r.stock_qty) ?? 0;
          if (r.reorder_point !== undefined && r.reorder_point !== "")
            varPayload.reorder_point = parseImportNumber(r.reorder_point) ?? null;

          if (existingVar) {
            if (mode === "create_only") {
              skipped++;
              continue;
            }
            const { data: updV, error } = await supabase
              .from("pos_item_variants")
              .update(varPayload)
              .eq("id", existingVar.id)
              .select("id");
            if (error || !updV || updV.length === 0) errors++;
            else updatedVariants++;

          } else {
            if (mode === "update_only") {
              skipped++;
              continue;
            }
            const { error } = await supabase.from("pos_item_variants").insert({
              property_id: propertyId,
              item_id: itemId,
              ...varPayload,
              stock_qty: varPayload.stock_qty ?? 0,
            });
            if (error) errors++;
            else createdVariants++;
          }
        }
      }

      toast.success(
        `${createdItems} new / ${updatedItems} updated items, ${createdVariants} new / ${updatedVariants} updated variants${
          createdCats ? `, ${createdCats} new categories` : ""
        }${skipped ? `, ${skipped} skipped` : ""}${errors ? ` (${errors} errors)` : ""}`
      );
      setItemsFile(null);
      setItemsPreview(null);
      setDiff(null);
      onImported();
    } finally {
      setBusy(false);
    }
  };



  const importInvoice = async () => {
    if (!invoicePreview?.length) return;
    setBusy(true);
    try {
      const { data: variants } = await supabase
        .from("pos_item_variants")
        .select("id,barcode,item_id,stock_qty,pos_items!inner(sku,property_id)")
        .eq("property_id", propertyId);

      const byBarcode = new Map<string, any>();
      const bySku = new Map<string, any[]>();
      (variants || []).forEach((v: any) => {
        if (v.barcode) byBarcode.set(v.barcode.trim(), v);
        const sku = v.pos_items?.sku;
        if (sku) {
          const arr = bySku.get(sku.trim()) || [];
          arr.push(v);
          bySku.set(sku.trim(), arr);
        }
      });

      let updated = 0,
        notFound = 0;
      for (const r of invoicePreview) {
        const barcode = r.barcode ? String(r.barcode).trim() : "";
        const sku = r.sku ? String(r.sku).trim() : "";
        const qty = parseImportNumber(r.qty);
        if (!qty || isNaN(qty)) continue;

        let variant: any = null;
        if (barcode) variant = byBarcode.get(barcode);
        if (!variant && sku) {
          const matches = bySku.get(sku);
          if (matches && matches.length === 1) variant = matches[0];
        }
        if (!variant) {
          notFound++;
          continue;
        }

        const newQty = Number(variant.stock_qty || 0) + qty;
        await supabase.from("pos_item_variants").update({ stock_qty: newQty }).eq("id", variant.id);
        await supabase.from("pos_inventory_movements").insert({
          property_id: propertyId,
          variant_id: variant.id,
          change_qty: qty,
          reason: "receive",
          notes: r.note ? String(r.note).trim() : "Invoice import",
        });

        // Update cost if provided
        const unitCost = parseImportNumber(r.unit_cost);
        if (unitCost !== null) {
          await supabase
            .from("pos_items")
            .update({ cost: unitCost })
            .eq("id", variant.item_id);
        }
        variant.stock_qty = newQty;
        updated++;
      }

      toast.success(
        `Received ${updated} line${updated === 1 ? "" : "s"}${notFound ? ` — ${notFound} not matched` : ""}`
      );
      setInvoiceFile(null);
      setInvoicePreview(null);
      onImported();
    } finally {
      setBusy(false);
    }
  };

  const previewCols = (rows: any[]) => (rows[0] ? Object.keys(rows[0]) : []);

  return (
    <div className="space-y-6">
      {/* Items Import */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Import Items & Variants
            </h3>
            <p className="text-sm text-muted-foreground">
              Bulk create items with size/color variants, barcodes, prices, and starting stock.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportItems} disabled={busy}>
              <Download className="h-4 w-4 mr-1" /> Export Current Items
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(ITEMS_TEMPLATE, "pos-items-template.csv")}>
              <Download className="h-4 w-4 mr-1" /> Download Template
            </Button>
          </div>
        </div>
        <Alert>
          <AlertDescription className="text-xs">
            One row per variant. Rows sharing the same <b>category</b> + <b>name</b> are grouped into
            one item. Existing items are matched by <b>SKU</b> first, then by category + name; variants
            match by <b>barcode</b> first, then size + color. Export your current items to edit them in
            a spreadsheet and re-import.
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="file"
            accept=".csv"
            className="max-w-sm"
            onChange={(e) => e.target.files?.[0] && previewItems(e.target.files[0])}
          />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="upsert">Create new + update existing</option>
            <option value="update_only">Update existing only</option>
            <option value="create_only">Create new only (skip existing)</option>
          </select>
          <Button disabled={!itemsPreview?.length || busy} onClick={importItems}>
            <Upload className="h-4 w-4 mr-1" /> Import {itemsPreview?.length || 0} rows
          </Button>
        </div>
        {diff && (
          <div className="text-xs text-muted-foreground">
            Detected: <b className="text-foreground">{diff.create}</b> new item(s),{" "}
            <b className="text-foreground">{diff.update}</b> existing item(s) will be updated.
          </div>
        )}
        {itemsPreview && itemsPreview.length > 0 && (
          <div className="border rounded max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {previewCols(itemsPreview).map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsPreview.slice(0, 20).map((r, i) => (
                  <TableRow key={i}>
                    {previewCols(itemsPreview).map((c) => (
                      <TableCell key={c} className="text-xs">
                        {r[c]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {itemsPreview.length > 20 && (
              <div className="text-xs text-muted-foreground p-2">
                …and {itemsPreview.length - 20} more rows
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Invoice / Stock Receiving */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Package className="h-4 w-4" /> Import Invoice / Receive Stock
            </h3>
            <p className="text-sm text-muted-foreground">
              Upload a supplier invoice CSV to add received quantities to existing inventory. Matches
              by barcode first, then by SKU.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(INVOICE_TEMPLATE, "pos-invoice-template.csv")}
          >
            <Download className="h-4 w-4 mr-1" /> Download Template
          </Button>
        </div>
        <Alert>
          <AlertDescription className="text-xs">
            Each row: <b>barcode</b> or <b>sku</b>, <b>qty</b> received, optional <b>unit_cost</b>{" "}
            (updates item cost) and <b>note</b>. Each row creates an inventory movement with reason
            "receive" for full audit history.
          </AlertDescription>
        </Alert>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept=".csv"
            onChange={(e) => e.target.files?.[0] && previewInvoice(e.target.files[0])}
          />
          <Button disabled={!invoicePreview?.length || busy} onClick={importInvoice}>
            <Upload className="h-4 w-4 mr-1" /> Receive {invoicePreview?.length || 0} lines
          </Button>
        </div>
        {invoicePreview && invoicePreview.length > 0 && (
          <div className="border rounded max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {previewCols(invoicePreview).map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoicePreview.slice(0, 20).map((r, i) => (
                  <TableRow key={i}>
                    {previewCols(invoicePreview).map((c) => (
                      <TableCell key={c} className="text-xs">
                        {r[c]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
};
