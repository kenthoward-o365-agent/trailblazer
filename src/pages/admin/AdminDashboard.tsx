import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useInternalUser } from "@/hooks/useInternalUser";
import { Building2, Users, CreditCard, MapPin, Shield, TrendingUp, DollarSign, PauseCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  totalOrganizations: number;
  totalProperties: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  suspendedSubscriptions: number;
  mrr: number;
  arr: number;
  mrrPerSite: number;
  mrrFlat: number;
  arpa: number; // average revenue per account
}

interface RevenueRow {
  organization_id: string;
  name: string;
  monthly: number;
  model: "per_site" | "flat";
  billing_cycle: string;
  suspended: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export default function AdminDashboard() {
  const { isInternalUser, loading } = useInternalUser();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrganizations: 0,
    totalProperties: 0,
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    suspendedSubscriptions: 0,
    mrr: 0,
    arr: 0,
    mrrPerSite: 0,
    mrrFlat: 0,
    arpa: 0,
  });
  const [topAccounts, setTopAccounts] = useState<RevenueRow[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading && !isInternalUser) navigate("/");
  }, [loading, isInternalUser, navigate]);

  useEffect(() => {
    if (isInternalUser) loadStats();
  }, [isInternalUser]);

  const loadStats = async () => {
    try {
      const [orgsResult, propsResult, subsResult, sitesResult] = await Promise.all([
        supabase.from("organizations").select("id, name", { count: "exact" }),
        supabase.from("properties").select("id, organization_id", { count: "exact" }),
        supabase.from("subscriptions").select("*"),
        supabase.from("sites").select("id, property_id"),
      ]);

      const orgs = orgsResult.data ?? [];
      const props = propsResult.data ?? [];
      const subs = (subsResult.data ?? []) as any[];
      const sites = sitesResult.data ?? [];

      // Sites per org
      const propToOrg = new Map(props.map((p: any) => [p.id, p.organization_id]));
      const sitesPerOrg = new Map<string, number>();
      for (const s of sites) {
        const orgId = propToOrg.get((s as any).property_id);
        if (!orgId) continue;
        sitesPerOrg.set(orgId, (sitesPerOrg.get(orgId) || 0) + 1);
      }

      let mrrPerSite = 0;
      let mrrFlat = 0;
      let active = 0;
      let suspended = 0;
      const rows: RevenueRow[] = [];

      for (const sub of subs) {
        if (sub.suspended_at) { suspended++; continue; }
        active++;

        const cycleFactor = sub.billing_cycle === "annual" ? 1 / 12 : 1;
        const model: "per_site" | "flat" = sub.pricing_model === "flat" ? "flat" : "per_site";
        let monthly = 0;
        if (model === "flat") {
          monthly = Number(sub.flat_amount ?? 0) * cycleFactor;
          mrrFlat += monthly;
        } else {
          const siteCount = sitesPerOrg.get(sub.organization_id) || 0;
          monthly = Number(sub.price_per_site ?? 0) * siteCount * cycleFactor;
          mrrPerSite += monthly;
        }

        const org = orgs.find((o: any) => o.id === sub.organization_id);
        rows.push({
          organization_id: sub.organization_id,
          name: org?.name ?? "Unknown",
          monthly,
          model,
          billing_cycle: sub.billing_cycle,
          suspended: false,
        });
      }

      const mrr = mrrPerSite + mrrFlat;
      const arr = mrr * 12;
      const arpa = active ? mrr / active : 0;

      setStats({
        totalOrganizations: orgsResult.count || 0,
        totalProperties: propsResult.count || 0,
        totalSubscriptions: subs.length,
        activeSubscriptions: active,
        suspendedSubscriptions: suspended,
        mrr, arr, mrrPerSite, mrrFlat, arpa,
      });
      setTopAccounts(rows.sort((a, b) => b.monthly - a.monthly).slice(0, 8));
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Trailblazer Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Live subscription revenue and platform metrics.
          </p>
        </div>

        {/* Revenue KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loadingStats ? "…" : fmt(stats.mrr)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Per-site {fmt(stats.mrrPerSite)} · Flat {fmt(stats.mrrFlat)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ARR</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {loadingStats ? "…" : fmt(stats.arr)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Annualized run-rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ARPA</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? "…" : fmt(stats.arpa)}
              </div>
              <p className="text-xs text-muted-foreground">Average monthly revenue per active customer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
              <PauseCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? "…" : stats.activeSubscriptions}
                <span className="text-sm text-muted-foreground font-normal"> active</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.suspendedSubscriptions} suspended · {stats.totalSubscriptions} total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate("/admin/customers")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Customers</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? "…" : stats.totalOrganizations}
              </div>
              <p className="text-xs text-muted-foreground">Organizations on the platform</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate("/admin/properties")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Properties</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? "…" : stats.totalProperties}
              </div>
              <p className="text-xs text-muted-foreground">Campgrounds managed</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate("/admin/users")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Internal Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <Shield className="h-5 w-5 inline mr-1" />
              </div>
              <p className="text-xs text-muted-foreground">Manage Trailblazer staff</p>
            </CardContent>
          </Card>
        </div>

        {/* Top accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Top revenue accounts</CardTitle>
            <CardDescription>Live MRR contribution from active subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : topAccounts.length === 0 ? (
              <div className="text-sm text-muted-foreground">No active subscriptions yet.</div>
            ) : (
              <div className="divide-y">
                {topAccounts.map((r) => (
                  <div
                    key={r.organization_id}
                    className="flex items-center justify-between py-2 cursor-pointer hover:bg-accent/50 -mx-2 px-2 rounded"
                    onClick={() => navigate("/admin/customers")}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate font-medium">{r.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {r.model === "flat" ? "Flat" : "Per-site"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{r.billing_cycle}</Badge>
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{fmt(r.monthly)}/mo</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
