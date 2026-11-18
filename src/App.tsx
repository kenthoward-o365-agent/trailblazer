import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuditDateProvider } from "@/contexts/AuditDateContext";
import { PropertyProvider } from "@/contexts/PropertyContext";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Reservations from "./pages/Reservations";
import InParkGuests from "./pages/InParkGuests";
import Rates from "./pages/Rates";
import Reports from "./pages/Reports";
import TrailGuideItems from "./pages/TrailGuideItems";
import Map from "./pages/Map";
import MapEditor from "./pages/MapEditor";
import Book from "./pages/Book";
import Confirm from "./pages/Confirm";
import Accounting from "./pages/Accounting";
import UserManagement from "./pages/UserManagement";
import BookingChart from "./pages/BookingChart";
import SiteMaintenance from "./pages/SiteMaintenance";
import WorkOrders from "./pages/WorkOrders";
import WorkOrderDetail from "./pages/WorkOrderDetail";

import GuestProfiles from "./pages/GuestProfiles";
import GuestProfile from "./pages/GuestProfile";
import CheckIn from "./pages/CheckIn";
import GuestHistory from "./pages/GuestHistory";
import FolioReview from "./pages/FolioReview";
import DayendClose from "./pages/DayendClose";
import ReservationEdit from "./pages/ReservationEdit";
import CRM from "./pages/CRM";
import CampaignEditor from "./pages/CampaignEditor";
import ReservationSettings from "./pages/ReservationSettings";
import PropertySettings from "./pages/PropertySettings";
import ChannelManager from "./pages/ChannelManager";

import ChangePassword from "./pages/ChangePassword";
import SuspendedAccount from "./pages/SuspendedAccount";
import NotFound from "./pages/NotFound";
import GroupBlocks from "./pages/GroupBlocks";
import GroupBlockDetail from "./pages/GroupBlockDetail";
import KnowledgeBase from "./pages/KnowledgeBase";
import ChangeJournal from "./pages/ChangeJournal";
import Onboarding from "./pages/Onboarding";
import OnboardingAgent from "./pages/OnboardingAgent";
import GuestMessaging from "./pages/GuestMessaging";
import GuestMessagingSettings from "./pages/GuestMessagingSettings";
import Rentals from "./pages/Rentals";

// Admin pages
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminProperties from "./pages/admin/AdminProperties";
import AdminUserAccess from "./pages/admin/AdminUserAccess";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAccessAudit from "./pages/admin/AdminAccessAudit";
import AdminBookingEngine from "./pages/admin/AdminBookingEngine";
import BookingEngineSettings from "./pages/BookingEngineSettings";
import { PublicBookingLayout } from "./components/booking/PublicBookingLayout";
import BookingSearch from "./pages/public/BookingSearch";
import BookingCheckout from "./pages/public/BookingCheckout";
import BookingConfirmation from "./pages/public/BookingConfirmation";
import BookingManage from "./pages/public/BookingManage";
import GuestLogin from "./pages/public/GuestLogin";
import MyTrip from "./pages/public/MyTrip";
import OnlineCheckIn from "./pages/public/OnlineCheckIn";
import OAuthConsent from "./pages/OAuthConsent";
import PosTerminal from "./pages/pos/PosTerminal";
import PosSetup from "./pages/pos/PosSetup";
import SiteTypesSettings from "./pages/SiteTypesSettings";
import EnterpriseHierarchy from "./pages/admin/EnterpriseHierarchy";
import Memberships from "./pages/admin/Memberships";
import RateTemplates from "./pages/admin/RateTemplates";
import PortfolioYield from "./pages/admin/PortfolioYield";
import ChannelGovernance from "./pages/admin/ChannelGovernance";
import IntercompanyTransfers from "./pages/admin/IntercompanyTransfers";
import ConsolidatedAR from "./pages/admin/ConsolidatedAR";
import RegionalOps from "./pages/admin/RegionalOps";
import ExecutiveReports from "./pages/admin/ExecutiveReports";
import CentralReservations from "./pages/CentralReservations";
import ComplianceCenter from "./pages/admin/ComplianceCenter";
import ApiQuotas from "./pages/admin/ApiQuotas";
import StatusIncidentsAdmin from "./pages/admin/StatusIncidentsAdmin";
import BrandWhiteLabel from "./pages/admin/BrandWhiteLabel";
import WebhookCatalog from "./pages/admin/WebhookCatalog";
import PublicStatus from "./pages/public/Status";
import Trust from "./pages/public/Trust";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep responses "fresh" for 30s → no duplicate refetches during quick nav
      staleTime: 30_000,
      // Keep unused data in memory for 5m so back-nav is instant
      gcTime: 5 * 60_000,
      // Don't hammer the DB every time the user Alt-Tabs
      refetchOnWindowFocus: false,
      // One retry is enough for transient blips; more just piles load on
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      retry: 0,
    },
  },
});


const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="roommaster-theme">
      <PropertyProvider>
        <AuditDateProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
        <AppErrorBoundary fallbackPath="/">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/suspended" element={<SuspendedAccount />} />
          <Route path="/book" element={<Book />} />
          <Route path="/confirm/:id" element={<Confirm />} />
          {/* Public booking engine */}
          <Route path="/b/:slug" element={<PublicBookingLayout />}>
            <Route index element={<BookingSearch />} />
            <Route path="checkout/:holdId" element={<BookingCheckout />} />
            <Route path="confirmation/:reservationId" element={<BookingConfirmation />} />
            <Route path="manage" element={<BookingManage />} />
            <Route path="login" element={<GuestLogin />} />
            <Route path="my-trip" element={<MyTrip />} />
            <Route path="checkin/:confirmation" element={<OnlineCheckIn />} />

          </Route>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/channel-manager"
            element={
              <ProtectedRoute>
                <ChannelManager />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reservations"
            element={
              <ProtectedRoute>
                <Reservations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rates"
            element={
              <ProtectedRoute>
                <Rates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/change-journal"
            element={
              <ProtectedRoute>
                <ChangeJournal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/trailguide-items"
            element={
              <ProtectedRoute>
                <TrailGuideItems />
              </ProtectedRoute>
            }
          />

          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <Map />
              </ProtectedRoute>
            }
          />
          <Route
            path="/map-editor"
            element={
              <ProtectedRoute>
                <MapEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting"
            element={
              <ProtectedRoute>
                <Accounting />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/booking-chart"
            element={
              <ProtectedRoute>
                <BookingChart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/site-turnover"
            element={
              <ProtectedRoute>
                <SiteMaintenance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/site-turnover/work-orders"
            element={
              <ProtectedRoute>
                <WorkOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/site-turnover/work-orders/:id"
            element={
              <ProtectedRoute>
                <WorkOrderDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/source-of-business"
            element={<Navigate to="/settings/reservations" replace />}
          />
          <Route
            path="/group-blocks"
            element={
              <ProtectedRoute>
                <GroupBlocks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/group-blocks/new"
            element={
              <ProtectedRoute>
                <GroupBlockDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/group-blocks/:id"
            element={
              <ProtectedRoute>
                <GroupBlockDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guests"
            element={
              <ProtectedRoute>
                <GuestProfiles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guests/:id"
            element={
              <ProtectedRoute>
                <GuestProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/check-in"
            element={
              <ProtectedRoute>
                <CheckIn />
              </ProtectedRoute>
            }
          />
          <Route
            path="/in-park-guests"
            element={
              <ProtectedRoute>
                <InParkGuests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/in-house-guests"
            element={
              <ProtectedRoute>
                <InParkGuests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guest-history"
            element={
              <ProtectedRoute>
                <GuestHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guest-history/:folioId"
            element={
              <ProtectedRoute>
                <FolioReview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dayend-close"
            element={
              <ProtectedRoute>
                <DayendClose />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reservation/edit"
            element={
              <ProtectedRoute>
                <ReservationEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm"
            element={
              <ProtectedRoute>
                <CRM />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crm/:id"
            element={
              <ProtectedRoute>
                <CampaignEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/reservations"
            element={
              <ProtectedRoute>
                <ReservationSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/property"
            element={
              <ProtectedRoute>
                <PropertySettings />
              </ProtectedRoute>
            }
          />
          {/* Legacy hotel-only routes — redirect to dashboard */}
          <Route path="/settings/rooms" element={<Navigate to="/" replace />} />
          <Route path="/housekeeping" element={<Navigate to="/site-turnover" replace />} />
          <Route path="/housekeeping/mobile" element={<Navigate to="/site-turnover" replace />} />
          <Route
            path="/settings/booking-engine"
            element={
              <ProtectedRoute>
                <BookingEngineSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <PosTerminal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/pos"
            element={
              <ProtectedRoute>
                <PosSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/site-types"
            element={
              <ProtectedRoute>
                <SiteTypesSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/help"
            element={
              <ProtectedRoute>
                <KnowledgeBase />
              </ProtectedRoute>
            }
          />
          <Route
            path="/knowledge-base"
            element={
              <ProtectedRoute>
                <KnowledgeBase />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding-agent"
            element={
              <ProtectedRoute>
                <OnboardingAgent />
              </ProtectedRoute>
            }
          />
          <Route path="/messaging" element={<ProtectedRoute><GuestMessaging /></ProtectedRoute>} />
          <Route path="/settings/messaging" element={<ProtectedRoute><GuestMessagingSettings /></ProtectedRoute>} />
          <Route path="/rentals" element={<ProtectedRoute><Rentals /></ProtectedRoute>} />



          {/* Admin Routes (Internal Users) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/customers"
            element={
              <ProtectedRoute>
                <AdminCustomers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/properties"
            element={
              <ProtectedRoute>
                <AdminProperties />
              </ProtectedRoute>
            }
          />
          {/* Redirects for old admin routes */}
          <Route path="/admin/organizations" element={<Navigate to="/admin/customers" replace />} />
          <Route path="/admin/subscriptions" element={<Navigate to="/admin/customers" replace />} />
          <Route path="/admin/property-groups" element={<Navigate to="/admin/customers" replace />} />
          <Route
            path="/admin/user-access"
            element={
              <ProtectedRoute>
                <AdminUserAccess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/access-audit"
            element={
              <ProtectedRoute>
                <AdminAccessAudit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/booking-engines"
            element={
              <ProtectedRoute>
                <AdminBookingEngine />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/enterprise"
            element={<ProtectedRoute><EnterpriseHierarchy /></ProtectedRoute>}
          />
          <Route
            path="/admin/memberships"
            element={<ProtectedRoute><Memberships /></ProtectedRoute>}
          />
          <Route
            path="/admin/rate-templates"
            element={<ProtectedRoute><RateTemplates /></ProtectedRoute>}
          />
          <Route
            path="/admin/portfolio-yield"
            element={<ProtectedRoute><PortfolioYield /></ProtectedRoute>}
          />
          <Route
            path="/admin/channel-governance"
            element={<ProtectedRoute><ChannelGovernance /></ProtectedRoute>}
          />
          <Route path="/admin/intercompany-transfers" element={<ProtectedRoute><IntercompanyTransfers /></ProtectedRoute>} />
          <Route path="/admin/consolidated-ar" element={<ProtectedRoute><ConsolidatedAR /></ProtectedRoute>} />
          <Route path="/admin/regional-ops" element={<ProtectedRoute><RegionalOps /></ProtectedRoute>} />
          <Route path="/admin/executive-reports" element={<ProtectedRoute><ExecutiveReports /></ProtectedRoute>} />
          <Route path="/admin/compliance" element={<ProtectedRoute><ComplianceCenter /></ProtectedRoute>} />
          <Route path="/admin/api-quotas" element={<ProtectedRoute><ApiQuotas /></ProtectedRoute>} />
          <Route path="/admin/status-incidents" element={<ProtectedRoute><StatusIncidentsAdmin /></ProtectedRoute>} />
          <Route path="/admin/white-label" element={<ProtectedRoute><BrandWhiteLabel /></ProtectedRoute>} />
          <Route path="/admin/webhook-catalog" element={<ProtectedRoute><WebhookCatalog /></ProtectedRoute>} />
          <Route path="/status" element={<PublicStatus />} />
          <Route path="/trust" element={<Trust />} />
          <Route
            path="/central-reservations"
            element={<ProtectedRoute><CentralReservations /></ProtectedRoute>}
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </AppErrorBoundary>
          </BrowserRouter>
          </TooltipProvider>
        </AuditDateProvider>
      </PropertyProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
