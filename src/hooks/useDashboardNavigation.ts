import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Map,
  CalendarRange,
  Mail,
  Wrench,
  BedDouble,
  MapPin,
  UsersRound,
  History,
  UserCog,
  Building2,
  CalendarCheck,
  Rocket,
  Store,
  Tent,
  Sparkles,
  BookOpen,
  MessageSquare,
  Bike,
  Globe,
  Network,
  Award,
  Layers,
  TrendingUp,
  Radio,
  ArrowRightLeft,
  FileBarChart,
  ShieldCheck,
  Gauge,
  Activity,
  Palette,
  Webhook,

} from "lucide-react";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";

export interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
}

export interface SettingsSubItem {
  label: string;
  path: string;
}

export interface AdminSubItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
}

export const useDashboardNavigation = (isInternalUser: boolean) => {
  const location = useLocation();
  const terminology = usePropertyTerminology();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  // Settings sub-items
  const settingsItems: SettingsSubItem[] = [
    { label: "Property", path: "/settings/property" },
    { label: "Site Types", path: "/settings/site-types" },
    { label: "Booking Engine", path: "/settings/booking-engine" },
    { label: "Channel Manager", path: "/settings/channel-manager" },

    { label: "Accounting", path: "/accounting" },
    { label: "Reservations", path: "/settings/reservations" },
    { label: "Rates", path: "/rates" },
    { label: "Point of Sale", path: "/settings/pos" },
    { label: "Users", path: "/users" },
  ];

  // Reports sub-items
  const reportsItems: SettingsSubItem[] = [
    { label: "Accounting", path: "/reports" },
    { label: "Change Journal", path: "/reports/change-journal" },
  ];

  // Admin sub-items (internal users)
  const adminItems: AdminSubItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    { icon: Building2, label: "Customers", path: "/admin/customers" },
    { icon: MapPin, label: "Properties", path: "/admin/properties" },
    { icon: Rocket, label: "Booking Engines", path: "/admin/booking-engines" },
    { icon: UserCog, label: "Internal Users", path: "/admin/users" },
    { icon: Users, label: "User Access", path: "/admin/user-access" },
    { icon: History, label: "Admin Access Audit", path: "/admin/access-audit" },
    { icon: Network, label: "Enterprise Hierarchy", path: "/admin/enterprise" },
    { icon: Award, label: "Memberships", path: "/admin/memberships" },
    { icon: Layers, label: "Rate Templates", path: "/admin/rate-templates" },
    { icon: TrendingUp, label: "Portfolio Yield", path: "/admin/portfolio-yield" },
    { icon: Radio, label: "Channel Governance", path: "/admin/channel-governance" },
    { icon: ArrowRightLeft, label: "Intercompany Transfers", path: "/admin/intercompany-transfers" },
    { icon: Building2, label: "Consolidated AR", path: "/admin/consolidated-ar" },
    { icon: Wrench, label: "Regional Ops", path: "/admin/regional-ops" },
    { icon: FileBarChart, label: "Executive Reports", path: "/admin/executive-reports" },
    { icon: ShieldCheck, label: "Compliance Center", path: "/admin/compliance" },
    { icon: Gauge, label: "API Quotas", path: "/admin/api-quotas" },
    { icon: Activity, label: "Status Incidents", path: "/admin/status-incidents" },
    { icon: Palette, label: "Brand White-Label", path: "/admin/white-label" },
    { icon: Webhook, label: "Webhook Catalog", path: "/admin/webhook-catalog" },
  ];


  // Campground-only nav
  const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: Map, label: "Map", path: "/map" },
    { icon: CalendarRange, label: "Booking Chart", path: "/booking-chart" },
    { icon: Globe, label: "Central Reservations", path: "/central-reservations" },
    {
      icon: terminology.isHotel ? BedDouble : Tent,
      label: terminology.isHotel ? "In-House Guests" : "In Park Guests",
      path: terminology.isHotel ? "/in-house-guests" : "/in-park-guests",
    },
    { icon: MessageSquare, label: "Guest Messaging", path: "/messaging" },
    { icon: Calendar, label: "Reservations", path: "/reservations" },
    { icon: Store, label: "Point of Sale", path: "/pos" },
    { icon: Bike, label: "Rentals", path: "/rentals" },
    { icon: UsersRound, label: "Group Blocks", path: "/group-blocks" },
    { icon: History, label: "Guest History", path: "/guest-history" },
    { icon: Users, label: "Guest Profiles", path: "/guests" },
    { icon: Mail, label: "CRM", path: "/crm" },
    { icon: Wrench, label: "Maintenance", path: "/site-turnover" },
    { icon: CalendarCheck, label: "Day-End Close", path: "/dayend-close" },
    { icon: BookOpen, label: "Knowledge Base", path: "/knowledge-base" },
  ];

  // Check if current path is a settings, reports, or admin page
  const isSettingsPath = settingsItems.some(item => location.pathname.startsWith(item.path));
  const isReportsPath = reportsItems.some(item => location.pathname.startsWith(item.path));
  const isAdminPath = location.pathname.startsWith("/admin");

  // Auto-expand sections based on current path
  useEffect(() => {
    if (isSettingsPath && !isInternalUser) {
      setSettingsOpen(true);
    }
    if (isReportsPath && !isInternalUser) {
      setReportsOpen(true);
    }
    if (isAdminPath || isInternalUser) {
      setAdminOpen(true);
    }
  }, [isSettingsPath, isReportsPath, isAdminPath, isInternalUser]);

  const isActivePath = (path: string) => location.pathname === path;

  return {
    navItems,
    settingsItems,
    reportsItems,
    adminItems,
    settingsOpen,
    setSettingsOpen,
    reportsOpen,
    setReportsOpen,
    adminOpen,
    setAdminOpen,
    isSettingsPath,
    isReportsPath,
    isAdminPath,
    isActivePath,
  };
};
