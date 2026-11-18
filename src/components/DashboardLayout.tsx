import { ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuditDate } from "@/contexts/AuditDateContext";
import { useProperty } from "@/contexts/PropertyContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useInternalUser } from "@/hooks/useInternalUser";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { useDashboardNavigation } from "@/hooks/useDashboardNavigation";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { InactivityWarning } from "@/components/InactivityWarning";
import { InternalHeader } from "@/components/layout/InternalHeader";
import { ClientHeader } from "@/components/layout/ClientHeader";
import { SidebarNavigation } from "@/components/layout/SidebarNavigation";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TrailGuideLauncher } from "@/components/trailguide/TrailGuidePanel";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const [staffName, setStaffName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Auto-collapse on tablet widths (<1024px). Respect stored preference on desktop.
    if (typeof window !== "undefined" && window.innerWidth < 1024) return true;
    const stored = localStorage.getItem("sidebarCollapsed");
    return stored === "true";
  });
  const { auditDate, calendarDate, isAuditDateBehind, daysBehind, loading: auditLoading } = useAuditDate();
  const { properties, selectedProperty, setSelectedPropertyId, loading: propertyLoading } = useProperty();
  const { isSuperAdmin } = useSuperAdmin();
  const { isInternalUser, internalRole, loading: internalLoading } = useInternalUser();
  const { isAdminAccess, propertyName: adminPropertyName, endAdminAccess } = useAdminAccess();

  const navigation = useDashboardNavigation(isInternalUser);

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Auto-collapse sidebar when viewport crosses into tablet range
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1024) setSidebarCollapsed(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    loadStaffProfile();
  }, []);

  const loadStaffProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.user_metadata) {
      const firstName = user.user_metadata.first_name || "Staff";
      const lastName = user.user_metadata.last_name || "User";
      setStaffName(`${firstName} ${lastName}`);
    }
  };

  const handleLogout = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('security_audit_logs').insert({
          user_id: user.id,
          property_id: selectedProperty?.id,
          event_type: 'logout',
          event_description: 'User logged out',
        });
      }
    } catch (e) {
      console.error('Failed to log logout event:', e);
    }
    
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const sessionTimeoutMinutes = (selectedProperty as any)?.session_timeout_minutes || 15;

  const {
    showWarning: showInactivityWarning,
    remainingSeconds,
    dismissWarning,
  } = useInactivityTimeout({
    timeoutMinutes: sessionTimeoutMinutes,
    warningMinutes: 1,
    onTimeout: handleLogout,
    enabled: !isInternalUser && !!selectedProperty,
  });

  const handlePropertySwitch = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    window.location.reload();
  };

  const handleExitAdminAccess = async () => {
    await endAdminAccess();
    navigate("/admin/properties");
  };

  if (internalLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="h-8 w-40 rounded-md bg-muted animate-pulse" />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex">
          <aside className={`hidden md:block ${sidebarCollapsed ? "w-14" : "w-64"} border-r bg-card min-h-screen transition-all duration-200`}>
            <nav className="p-4" />
          </aside>
          <main className="flex-1 p-3 sm:p-5 lg:p-6 min-w-0 overflow-x-hidden">{children}</main>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      <InactivityWarning
        open={showInactivityWarning}
        remainingSeconds={remainingSeconds}
        onContinue={dismissWarning}
      />

      {isInternalUser && !isAdminAccess ? (
        <InternalHeader
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          internalRole={internalRole}
          staffName={staffName}
          onLogout={handleLogout}
        />
      ) : (
        <ClientHeader
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          properties={properties}
          selectedProperty={selectedProperty}
          propertyLoading={propertyLoading}
          auditDate={auditDate}
          calendarDate={calendarDate}
          isAuditDateBehind={isAuditDateBehind}
          daysBehind={daysBehind}
          auditLoading={auditLoading}
          staffName={staffName}
          onPropertySwitch={handlePropertySwitch}
          onLogout={handleLogout}
          isAdminAccess={isAdminAccess}
          adminPropertyName={adminPropertyName}
          onExitAdminAccess={handleExitAdminAccess}
        />
      )}

      <div className="flex">
        <SidebarNavigation
          isInternalUser={isInternalUser && !isAdminAccess}
          isSuperAdmin={isSuperAdmin && !isAdminAccess}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          {...navigation}
        />
        <main className="flex-1 p-3 sm:p-5 lg:p-6 min-w-0 overflow-x-hidden">{children}</main>
      </div>
      {selectedProperty && <TrailGuideLauncher />}
    </div>
  );
};
