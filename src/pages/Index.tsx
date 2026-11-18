import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Users, CheckCircle, DollarSign, TrendingUp, MapPin, Search, Briefcase, Receipt, Smartphone, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatLocalDate } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { useInternalUser } from "@/hooks/useInternalUser";
import { useProperty } from "@/contexts/PropertyContext";
import { useAuditDate } from "@/contexts/AuditDateContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";

const Index = () => {
  const navigate = useNavigate();
  const { isInternalUser, loading: internalLoading } = useInternalUser();
  const { selectedProperty } = useProperty();
  const { auditDate } = useAuditDate();
  const terminology = usePropertyTerminology();
  const { isAdminAccess } = useAdminAccess();
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    todayArrivals: 0,
    todayDepartures: 0,
    currentOccupancy: 0,
    totalRevenue: 0,
    occupancyRate: 0,
    revPerAvailable: 0,
  });
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [departures, setDepartures] = useState<any[]>([]);
  const [currentGuests, setCurrentGuests] = useState<any[]>([]);
  const [mobileCheckins, setMobileCheckins] = useState<any[]>([]);
  const [releasing, setReleasing] = useState<string | null>(null);

  // Redirect internal users to admin dashboard (but not when in admin access mode)
  useEffect(() => {
    if (!internalLoading && isInternalUser && !isAdminAccess) {
      navigate("/admin");
    }
  }, [internalLoading, isInternalUser, isAdminAccess, navigate]);

  // Redirect org admins with unfinished setup to onboarding wizard
  const { needsOnboarding, loading: onboardingLoading } = useOnboardingStatus();
  useEffect(() => {
    if (!onboardingLoading && needsOnboarding) {
      navigate("/onboarding", { replace: true });
    }
  }, [onboardingLoading, needsOnboarding, navigate]);

  useEffect(() => {
    // Load dashboard data for client users OR internal users in admin access mode
    if (!internalLoading && (!isInternalUser || isAdminAccess) && selectedProperty?.id && auditDate) {
      loadDashboardData();
    }
  }, [internalLoading, isInternalUser, isAdminAccess, selectedProperty?.id, auditDate]);

  const loadDashboardData = async () => {
    if (!selectedProperty?.id || !auditDate) return;
    
    const today = auditDate;

    // Get today's arrivals
    const { data: arrivalsData } = await supabase
      .from("reservations")
      .select("*, sites(*), guests(*)")
      .eq("property_id", selectedProperty.id)
      .eq("check_in_date", today)
      .eq("status", "CONFIRMED")
      .order("created_at", { ascending: false });

    // Get today's departures
    const { data: departuresData } = await supabase
      .from("reservations")
      .select("*, sites(*), guests(*)")
      .eq("property_id", selectedProperty.id)
      .eq("check_out_date", today)
      .in("status", ["CONFIRMED", "CHECKED_IN"])
      .order("created_at", { ascending: false });

    // Get current guests (checked in)
    const { data: currentGuestsData, count: occupiedCount } = await supabase
      .from("reservations")
      .select("*, sites(*), guests(*)", { count: "exact" })
      .eq("property_id", selectedProperty.id)
      .eq("status", "CHECKED_IN")
      .lte("check_in_date", today)
      .gte("check_out_date", today)
      .order("check_in_date", { ascending: true });

    // Fetch folio balances for current guests
    const currentGuestIds = currentGuestsData?.map((g) => g.id) || [];
    const balanceMap = new Map<string, number>();
    if (currentGuestIds.length > 0) {
      const { data: ledgerData } = await supabase
        .from("ledger_accounts")
        .select("reservation_id, balance")
        .in("reservation_id", currentGuestIds)
        .eq("ledger_type", "guest");
      for (const ld of ledgerData || []) {
        balanceMap.set(ld.reservation_id, Number(ld.balance) || 0);
      }
    }

    // Get total sites
    const { count: totalSites } = await supabase
      .from("sites")
      .select("*", { count: "exact", head: true })
      .eq("property_id", selectedProperty.id)
      .eq("is_active", true);

    // Calculate Month Revenue based on audit date month
    // = Posted Revenue - Posted Expenses + Projected Arrival Revenue
    const auditDateObj = new Date(auditDate + 'T00:00:00');
    const firstDayOfMonth = new Date(auditDateObj.getFullYear(), auditDateObj.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const lastDayOfMonth = new Date(auditDateObj.getFullYear(), auditDateObj.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    // Get all folio postings for the audit date month with account info
    const { data: monthlyPostings } = await supabase
      .from("folio_postings")
      .select(`
        debit_amount,
        credit_amount,
        account:accounts!folio_postings_account_id_fkey(account_group_id),
        ledger_account:ledger_accounts!folio_postings_ledger_account_id_fkey(property_id)
      `)
      .gte("posting_date", firstDayOfMonth)
      .lte("posting_date", lastDayOfMonth);

    // Filter postings by property and get account group types
    const propertyPostings = monthlyPostings?.filter(
      (p: any) => p.ledger_account?.property_id === selectedProperty.id
    ) || [];

    // Get account groups to determine account types
    const accountGroupIds = [...new Set(propertyPostings.map((p: any) => p.account?.account_group_id).filter(Boolean))];
    const { data: accountGroups } = await supabase
      .from("account_groups")
      .select("id, account_type")
      .in("id", accountGroupIds.length > 0 ? accountGroupIds : ['00000000-0000-0000-0000-000000000000']);

    const groupTypeMap = new Map(accountGroups?.map(g => [g.id, g.account_type]) || []);

    // Sum posted revenue (credits to Revenue accounts)
    const postedMonthlyRevenue = propertyPostings
      .filter((p: any) => groupTypeMap.get(p.account?.account_group_id) === 'revenue')
      .reduce((sum: number, p: any) => sum + (Number(p.credit_amount) || 0), 0);

    // Sum posted expenses (debits to Expense accounts)
    const postedMonthlyExpenses = propertyPostings
      .filter((p: any) => groupTypeMap.get(p.account?.account_group_id) === 'expense')
      .reduce((sum: number, p: any) => sum + (Number(p.debit_amount) || 0), 0);

    // Get projected revenue from CONFIRMED reservations arriving after audit date but within audit month
    const { data: futureArrivals } = await supabase
      .from("reservations")
      .select("total_price")
      .eq("property_id", selectedProperty.id)
      .eq("status", "CONFIRMED")
      .gt("check_in_date", today)
      .lte("check_in_date", lastDayOfMonth);

    const projectedMonthlyRevenue = futureArrivals
      ?.reduce((sum, r) => sum + (Number(r.total_price) || 0), 0) || 0;

    const totalRevenue = postedMonthlyRevenue - postedMonthlyExpenses + projectedMonthlyRevenue;

    // Calculate RevPAR/RevPAS: Posted revenue + projected arrival revenue for audit date
    let postedRevenue = 0;
    let projectedRevenue = 0;

    // Get posted revenue from folio_postings for audit date where account has include_in_nightly_kpis = true
    const { data: postedData } = await supabase
      .from("folio_postings")
      .select(`
        credit_amount,
        account:accounts!folio_postings_account_id_fkey(include_in_nightly_kpis)
      `)
      .eq("posting_date", today);

    if (postedData) {
      postedRevenue = postedData
        .filter((p: any) => p.account?.include_in_nightly_kpis === true)
        .reduce((sum: number, p: any) => sum + (parseFloat(p.credit_amount) || 0), 0);
    }

    // Get projected revenue from CONFIRMED arrivals for audit date
    if (arrivalsData && arrivalsData.length > 0) {
      // Get rates with their revenue accounts
      const reservationIds = arrivalsData.map(r => r.id);
      const rateIds = arrivalsData.map(r => r.rate_id).filter(Boolean);
      
      // Fetch rates with revenue account info
      const { data: ratesData } = await supabase
        .from("rates")
        .select(`
          id,
          revenue_account:accounts!rates_revenue_account_id_fkey(include_in_nightly_kpis)
        `)
        .in("id", rateIds);
      
      const rateKpiMap = new Map(ratesData?.map(r => [r.id, r.revenue_account?.include_in_nightly_kpis === true]) || []);

      // Fetch reservation add-ons with their account info
      const { data: addOnsData } = await supabase
        .from("reservation_add_ons")
        .select(`
          reservation_id,
          quantity,
          price_at_booking,
          add_on:add_ons(
            charge_type,
            account:accounts!add_ons_account_id_fkey(include_in_nightly_kpis)
          )
        `)
        .in("reservation_id", reservationIds);

      for (const arrival of arrivalsData) {
        const checkIn = new Date(arrival.check_in_date);
        const checkOut = new Date(arrival.check_out_date);
        const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Rate revenue (one night's portion)
        if (arrival.rate_id && rateKpiMap.get(arrival.rate_id)) {
          const nightlyRate = Number(arrival.total_price) / nights;
          projectedRevenue += nightlyRate;
        }

        // Add-on revenue
        const resAddOns = addOnsData?.filter(a => a.reservation_id === arrival.id) || [];
        for (const addon of resAddOns) {
          if (addon.add_on?.account?.include_in_nightly_kpis === true) {
            const addonAmount = Number(addon.price_at_booking) * addon.quantity;
            if (addon.add_on.charge_type === 'nightly') {
              projectedRevenue += addonAmount;
            } else {
              // One-time add-ons are included on arrival date (first night)
              projectedRevenue += addonAmount;
            }
          }
        }
      }
    }

    const revPerAvailable = totalSites ? (postedRevenue + projectedRevenue) / totalSites : 0;

    // Mobile check-ins that need staff review (CHECK_IN_HOLD or flagged)
    const { data: mobileData } = await supabase
      .from("reservations")
      .select("id, confirmation_number, status, checkin_source, checkin_hold_reason, needs_staff_review, check_in_date, check_out_date, site_id, sites(site_number, maintenance_status), site_types(name), guests(first_name, last_name, phone)")
      .eq("property_id", selectedProperty.id)
      .or("status.eq.CHECK_IN_HOLD,needs_staff_review.eq.true")
      .order("checkin_hold_at", { ascending: false })
      .limit(20);

    setArrivals(arrivalsData || []);
    setDepartures(departuresData || []);
    setMobileCheckins(mobileData || []);
    setCurrentGuests(
      (currentGuestsData || []).map((g) => ({
        ...g,
        folioBalance: balanceMap.get(g.id) ?? 0,
      }))
    );
    setStats({
      todayArrivals: arrivalsData?.length || 0,
      todayDepartures: departuresData?.length || 0,
      currentOccupancy: occupiedCount || 0,
      totalRevenue,
      occupancyRate: totalSites ? ((occupiedCount || 0) / totalSites) * 100 : 0,
      revPerAvailable,
    });
  };

  const filterItems = (items: any[]) => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) => {
      const firstName = item.guests?.first_name?.toLowerCase() || "";
      const lastName = item.guests?.last_name?.toLowerCase() || "";
      const siteNumber = item.sites?.site_number?.toLowerCase() || "";
      return (
        firstName.includes(query) ||
        lastName.includes(query) ||
        `${firstName} ${lastName}`.includes(query) ||
        siteNumber.includes(query)
      );
    });
  };

  const filteredArrivals = useMemo(() => filterItems(arrivals), [arrivals, searchQuery]);
  const filteredCurrentGuests = useMemo(() => filterItems(currentGuests), [currentGuests, searchQuery]);
  const filteredDepartures = useMemo(() => filterItems(departures), [departures, searchQuery]);

  const StatTile = ({
    label,
    value,
    sub,
    Icon,
    onClick,
    tone = "primary",
    delay = 0,
  }: {
    label: string;
    value: string | number;
    sub?: string;
    Icon: any;
    onClick?: () => void;
    tone?: "primary" | "accent" | "success" | "muted";
    delay?: number;
  }) => {
    const toneClasses: Record<string, string> = {
      primary: "from-primary/15 to-primary/0 text-primary",
      accent: "from-accent/20 to-accent/0 text-accent",
      success: "from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-400",
      muted: "from-muted/60 to-muted/0 text-muted-foreground",
    };
    return (
      <Card
        onClick={onClick}
        style={{ animationDelay: `${delay}ms` }}
        className={`relative overflow-hidden p-4 sm:p-5 animate-slide-up ${
          onClick ? "cursor-pointer hover-lift active:scale-[0.98]" : ""
        }`}
      >
        <div
          className={`absolute inset-0 bg-gradient-to-br ${toneClasses[tone]} opacity-60 pointer-events-none`}
        />
        <div className="relative flex items-start justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium truncate">
              {label}
            </p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight mt-1 text-foreground truncate">{value}</p>
            {sub && <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
          </div>
          <div className="rounded-xl bg-card/80 backdrop-blur p-2 sm:p-2.5 shadow-elev-sm border border-border/50 shrink-0">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
      </Card>
    );
  };


  const ListCard = ({
    title,
    items,
    Icon,
    tone,
    emptyText,
    onItemClick,
    rightLabel,
    secondaryAction,
  }: {
    title: string;
    items: any[];
    Icon: any;
    tone: string;
    emptyText: string;
    onItemClick: (item: any) => void;
    rightLabel: (item: any) => React.ReactNode;
    secondaryAction?: (item: any) => React.ReactNode;
  }) => (
    <Card className="p-4 sm:p-5 flex flex-col animate-slide-up">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 tracking-tight min-w-0">
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${tone}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{title}</span>
        </h3>
        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
          {items.length}
        </span>
      </div>
      <ScrollArea className="h-[320px] sm:h-[420px] md:h-[520px] -mr-3 pr-3">

        <div className="space-y-1">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-xs py-6 text-center">{emptyText}</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                onClick={() => onItemClick(item)}
                className="group flex justify-between items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/60 bg-card hover:bg-muted/60 hover:border-primary/40 shadow-sm hover:shadow transition-all cursor-pointer active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-tight truncate group-hover:text-primary transition-colors">
                    {item.guests?.first_name} {item.guests?.last_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {item.sites
                      ? `${terminology.site} ${item.sites.site_number}`
                      : "Unassigned"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {rightLabel(item)}
                  {secondaryAction && (
                    <div onClick={(e) => e.stopPropagation()}>
                      {secondaryAction(item)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 gradient-hero p-4 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs uppercase tracking-widest text-primary/70 font-semibold mb-1 truncate">
                {selectedProperty?.name ?? "Trailblazer PMS"}
              </p>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
                Welcome back.
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Today's overview, audit metrics, and live guest activity.
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search guests or sites…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 bg-card/80 backdrop-blur border-border/60 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">

          <StatTile
            label="Today's Arrivals"
            value={stats.todayArrivals}
            Icon={Calendar}
            tone="primary"
            delay={0}
            onClick={() => navigate("/reservations?filter=arrivals")}
          />
          <StatTile
            label="Today's Departures"
            value={stats.todayDepartures}
            Icon={CheckCircle}
            tone="accent"
            delay={60}
            onClick={() =>
              navigate(
                `${terminology.isHotel ? "/in-house-guests" : "/in-park-guests"}?filter=departures`,
              )
            }
          />
          <StatTile
            label="Current Occupancy"
            value={stats.currentOccupancy}
            sub={`${stats.occupancyRate.toFixed(1)}% occupied`}
            Icon={MapPin}
            tone="success"
            delay={120}
            onClick={() =>
              navigate(terminology.isHotel ? "/in-house-guests" : "/in-park-guests")
            }
          />
          <StatTile
            label={terminology.isHotel ? "RevPAR" : "RevPAS"}
            value={`$${stats.revPerAvailable.toFixed(2)}`}
            sub={`per ${terminology.site.toLowerCase()}`}
            Icon={TrendingUp}
            tone="primary"
            delay={180}
          />
          <StatTile
            label="Month Revenue"
            value={`$${stats.totalRevenue.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}`}
            Icon={DollarSign}
            tone="accent"
            delay={240}
          />
        </div>

        {/* Mobile check-in alerts */}
        {mobileCheckins.length > 0 && (
          <Card className="p-4 sm:p-5 border-amber-500/40 bg-amber-500/5 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700">
                  <Smartphone className="h-3.5 w-3.5" />
                </span>
                Mobile check-ins need triage
              </h3>
              <span className="text-xs font-semibold text-amber-700 bg-amber-500/15 px-2 py-0.5 rounded-full">
                {mobileCheckins.length}
              </span>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {mobileCheckins.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md border border-amber-500/30 bg-card">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {m.guests?.first_name} {m.guests?.last_name}
                      </span>
                      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">#{m.confirmation_number}</span>
                      {m.status === "CHECK_IN_HOLD" && (
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-amber-700 bg-amber-500/15 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Hold
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.sites?.site_number ? `Site ${m.sites.site_number}` : "No site"} · {m.site_types?.name ?? ""} · {m.checkin_hold_reason?.replace(/_/g, " ") ?? "Awaiting review"}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => navigate(`/check-in?reservationId=${m.id}`)}
                    >
                      Open
                    </Button>
                    {m.status === "CHECK_IN_HOLD" && m.sites?.maintenance_status === "available" && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 text-xs"
                        disabled={releasing === m.id}
                        onClick={async () => {
                          setReleasing(m.id);
                          const { error } = await supabase.from("reservations").update({
                            status: "CHECKED_IN",
                            needs_staff_review: false,
                            checkin_hold_reason: null,
                          }).eq("id", m.id);
                          setReleasing(null);
                          if (!error) loadDashboardData();
                        }}
                      >
                        Release to site
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Lists */}
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ListCard
            title="Today's Arrivals"
            items={filteredArrivals}
            Icon={Users}
            tone="bg-primary/10 text-primary"
            emptyText={searchQuery ? "No matching arrivals" : "No arrivals today"}
            onItemClick={(a) => navigate(`/check-in?reservationId=${a.id}`)}
            rightLabel={(a) => (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-md">
                {a.status}
              </span>
            )}
          />
          <ListCard
            title={`${terminology.isHotel ? "In-House" : "In-Park"} Guests`}
            items={filteredCurrentGuests}
            Icon={Users}
            tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            emptyText={searchQuery ? "No matching guests" : "No guests currently checked in"}
            onItemClick={(g) =>
              navigate(`/reservation/edit?id=${g.id}&focus=folio`)
            }
            rightLabel={(g) => (
              <div className="text-right">
                <div
                  className={`text-xs font-semibold tabular-nums ${
                    (g.folioBalance || 0) > 0
                      ? "text-orange-500"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  ${(g.folioBalance || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatLocalDate(g.check_out_date, "MM/dd/yyyy")}
                </div>
              </div>
            )}
            secondaryAction={(g) => (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1"
                onClick={() =>
                  navigate(`/reservation/edit?id=${g.id}&quickPost=1`)
                }
                title="Quick post to folio"
              >
                <Receipt className="h-3.5 w-3.5" />
                Post
              </Button>
            )}
          />
          <ListCard
            title="Today's Departures"
            items={filteredDepartures}
            Icon={Briefcase}
            tone="bg-accent/15 text-accent"
            emptyText={searchQuery ? "No matching departures" : "No departures today"}
            onItemClick={(d) =>
              navigate(`/reservation/edit?id=${d.id}&focus=folio`)
            }
            rightLabel={(d) => (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-accent bg-accent/10 px-2 py-1 rounded-md">
                {d.status}
              </span>
            )}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};


export default Index;
