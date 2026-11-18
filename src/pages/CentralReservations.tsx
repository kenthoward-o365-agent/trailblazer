import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Search, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface Brand { id: string; name: string; }
interface Region { id: string; brand_id: string; name: string; }
interface Property { id: string; name: string; address: string | null; brand_id: string | null; region_id: string | null; booking_public_slug: string | null; }
interface SiteType { id: string; property_id: string; name: string; max_occupancy: number | null; }

interface Availability {
  property: Property;
  brand?: Brand;
  region?: Region;
  siteTypes: (SiteType & { available: number })[];
}

export default function CentralReservations() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [checkIn, setCheckIn] = useState<string>("");
  const [checkOut, setCheckOut] = useState<string>("");
  const [minOccupancy, setMinOccupancy] = useState<number>(1);
  const [results, setResults] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    (async () => {
      const [b, r, p] = await Promise.all([
        supabase.from("brands").select("id,name").eq("is_active", true).order("name"),
        supabase.from("regions").select("id,brand_id,name").eq("is_active", true).order("name"),
        supabase.from("properties").select("id,name,address,brand_id,region_id,booking_public_slug").order("name"),
      ]);
      setBrands((b.data ?? []) as Brand[]);
      setRegions((r.data ?? []) as Region[]);
      setProperties((p.data ?? []) as Property[]);
    })();
  }, []);

  const filteredRegions = useMemo(
    () => brandFilter === "all" ? regions : regions.filter((r) => r.brand_id === brandFilter),
    [regions, brandFilter]
  );

  const scopedProperties = useMemo(() => {
    return properties.filter((p) => {
      if (brandFilter !== "all" && p.brand_id !== brandFilter) return false;
      if (regionFilter !== "all" && p.region_id !== regionFilter) return false;
      return true;
    });
  }, [properties, brandFilter, regionFilter]);

  async function search() {
    if (!checkIn || !checkOut || new Date(checkIn) >= new Date(checkOut)) {
      toast.error("Please choose valid check-in and check-out dates");
      return;
    }
    setLoading(true);
    setSearched(true);
    const propIds = scopedProperties.map((p) => p.id);
    if (propIds.length === 0) { setResults([]); setLoading(false); return; }

    // Load site types + reservations that overlap the window in one shot
    const [{ data: siteTypesData }, { data: reservations }, { data: sites }] = await Promise.all([
      supabase.from("site_types").select("id,property_id,name,max_occupancy").in("property_id", propIds),
      supabase.from("reservations").select("property_id,site_type_id,check_in_date,check_out_date,status")
        .in("property_id", propIds)
        .in("status", ["CONFIRMED", "CHECKED_IN"])
        .lt("check_in_date", checkOut)
        .gt("check_out_date", checkIn),
      supabase.from("sites").select("property_id,site_type_id,is_active").in("property_id", propIds),
    ]);

    const inventoryBy: Record<string, number> = {}; // key `${prop}:${siteType}`
    (sites ?? []).forEach((s: any) => {
      if (!s.is_active) return;
      const k = `${s.property_id}:${s.site_type_id}`;
      inventoryBy[k] = (inventoryBy[k] ?? 0) + 1;
    });
    const bookedBy: Record<string, number> = {};
    (reservations ?? []).forEach((r: any) => {
      const k = `${r.property_id}:${r.site_type_id}`;
      bookedBy[k] = (bookedBy[k] ?? 0) + 1;
    });

    const byProp: Record<string, Availability> = {};
    scopedProperties.forEach((p) => {
      byProp[p.id] = {
        property: p,
        brand: brands.find((b) => b.id === p.brand_id),
        region: regions.find((r) => r.id === p.region_id),
        siteTypes: [],
      };
    });
    (siteTypesData ?? []).forEach((st: any) => {
      if ((st.max_occupancy ?? 999) < minOccupancy) return;
      const k = `${st.property_id}:${st.id}`;
      const avail = Math.max(0, (inventoryBy[k] ?? 0) - (bookedBy[k] ?? 0));
      if (avail > 0 && byProp[st.property_id]) {
        byProp[st.property_id].siteTypes.push({ ...st, available: avail });
      }
    });

    setResults(Object.values(byProp).filter((r) => r.siteTypes.length > 0));
    setLoading(false);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-3xl font-bold">Central Reservations</h1>
          <p className="text-muted-foreground">Cross-park availability search across the portfolio. Route callers to the best-fit park in the network.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Search availability</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div>
                <Label>Brand</Label>
                <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v); setRegionFilter("all"); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All brands</SelectItem>
                    {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Region</Label>
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All regions</SelectItem>
                    {filteredRegions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Check-in</Label>
                <Input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
              </div>
              <div>
                <Label>Check-out</Label>
                <Input type="date" min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </div>
              <div>
                <Label>Guests</Label>
                <Input type="number" min={1} max={20} value={minOccupancy} onChange={(e) => setMinOccupancy(parseInt(e.target.value) || 1)} />
              </div>
              <Button onClick={search} disabled={loading}>
                <Search className="w-4 h-4 mr-1" />{loading ? "Searching…" : "Search"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Scope: {scopedProperties.length} propert{scopedProperties.length === 1 ? "y" : "ies"} in view.
            </p>
          </CardContent>
        </Card>

        {searched && !loading && (
          <Card>
            <CardHeader>
              <CardTitle>{results.length} park{results.length === 1 ? "" : "s"} with availability</CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No availability for these dates. Try widening the brand or region filter, or shift the dates.
                </p>
              )}
              {results.map((r) => (
                <div key={r.property.id} className="border rounded-lg p-4 mb-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <h3 className="font-semibold text-lg">{r.property.name}</h3>
                        {r.brand && <Badge variant="secondary">{r.brand.name}</Badge>}
                        {r.region && <Badge variant="outline">{r.region.name}</Badge>}
                      </div>
                      {r.property.address && <p className="text-sm text-muted-foreground ml-6">{r.property.address}</p>}
                    </div>
                    {r.property.booking_public_slug && (
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/b/${r.property.booking_public_slug}?checkin=${checkIn}&checkout=${checkOut}`} target="_blank" rel="noreferrer">
                          Book <ExternalLink className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </div>
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow><TableHead>Site type</TableHead><TableHead>Max occupancy</TableHead><TableHead>Available</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.siteTypes.map((st) => (
                        <TableRow key={st.id}>
                          <TableCell>{st.name}</TableCell>
                          <TableCell>{st.max_occupancy ?? "—"}</TableCell>
                          <TableCell><Badge>{st.available}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
