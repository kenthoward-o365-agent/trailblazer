import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, LogOut, HelpCircle, Building2, ChevronDown, AlertTriangle, Shield, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

// Parse date string as local date (not UTC) for display
const parseLocalDateForDisplay = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

interface Property {
  id: string;
  name: string;
}

interface ClientHeaderProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  properties: Property[];
  selectedProperty: Property | null;
  propertyLoading: boolean;
  auditDate: string | null;
  calendarDate: string;
  isAuditDateBehind: boolean;
  daysBehind: number;
  auditLoading: boolean;
  staffName: string;
  onPropertySwitch: (propertyId: string) => void;
  onLogout: () => void;
  // Admin access props
  isAdminAccess?: boolean;
  adminPropertyName?: string | null;
  onExitAdminAccess?: () => void;
}

export const ClientHeader = ({
  mobileMenuOpen,
  setMobileMenuOpen,
  properties,
  selectedProperty,
  propertyLoading,
  auditDate,
  calendarDate,
  isAuditDateBehind,
  daysBehind,
  auditLoading,
  staffName,
  onPropertySwitch,
  onLogout,
  isAdminAccess = false,
  adminPropertyName,
  onExitAdminAccess,
}: ClientHeaderProps) => {
  const navigate = useNavigate();
  const hasMultipleProperties = properties.length > 1;

  return (
    <>
      {/* Admin Access Banner */}
      {isAdminAccess && (
        <div className="bg-gradient-accent text-accent-foreground px-4 py-2 flex items-center justify-between shadow-elev-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="font-semibold text-sm">Trailblazer Admin Access</span>
            {adminPropertyName && <span className="text-sm opacity-90">— {adminPropertyName}</span>}
          </div>
          {onExitAdminAccess && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-accent-foreground hover:bg-black/10"
              onClick={onExitAdminAccess}
            >
              <X className="h-4 w-4 mr-1" />
              Exit Admin Access
            </Button>
          )}
        </div>
      )}

      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <BrandLogo size="xl" artwork="app" />
          </div>
          <div className="flex items-center gap-2">
            {!propertyLoading && selectedProperty && (
              hasMultipleProperties ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden sm:flex items-center gap-1.5 border border-sidebar-border bg-sidebar-accent/30 rounded-full px-3 h-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      <Building2 className="h-3.5 w-3.5 text-sidebar-primary" />
                      <span className="font-medium">{selectedProperty.name}</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border shadow-elev-lg">
                    {properties.map((property) => (
                      <DropdownMenuItem
                        key={property.id}
                        onClick={() => onPropertySwitch(property.id)}
                        className={property.id === selectedProperty.id ? "bg-accent/10 text-foreground" : ""}
                      >
                        <Building2 className="h-4 w-4 mr-2 text-primary" />
                        {property.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-sidebar-foreground border border-sidebar-border bg-sidebar-accent/30 rounded-full px-3 h-8">
                  <Building2 className="h-3.5 w-3.5 text-sidebar-primary" />
                  {selectedProperty.name}
                </span>
              )
            )}
            {/* Audit / Calendar Date Pills */}
            {!auditLoading && (
              <div className="hidden sm:flex items-center gap-2">
                <div
                  className={`flex flex-col items-end px-3 py-1 rounded-lg border ${
                    isAuditDateBehind
                      ? "border-destructive/60 bg-destructive/10"
                      : "border-sidebar-border bg-sidebar-accent/30"
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 leading-none">
                    Audit
                  </span>
                  <span
                    className={`text-xs font-semibold leading-tight ${
                      isAuditDateBehind ? "text-destructive-foreground" : "text-sidebar-foreground"
                    }`}
                  >
                    {auditDate ? format(parseLocalDateForDisplay(auditDate), "MMM dd, yyyy") : "-"}
                  </span>
                </div>
                {isAuditDateBehind && (
                  <Badge
                    variant="destructive"
                    className="cursor-pointer gap-1 animate-fade-in"
                    onClick={() => navigate("/dayend-close")}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {daysBehind}d behind
                  </Badge>
                )}
                <div className="hidden md:flex flex-col items-end px-3 py-1 rounded-lg border border-sidebar-border bg-sidebar-accent/30">
                  <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 leading-none">
                    Today
                  </span>
                  <span className="text-xs leading-tight text-sidebar-foreground/90">
                    {format(parseLocalDateForDisplay(calendarDate), "MMM dd, yyyy")}
                  </span>
                </div>
              </div>
            )}
            <span className="text-sm text-sidebar-foreground/70 hidden lg:block px-2">{staffName}</span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => navigate("/help")}>
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground px-2 sm:px-3" onClick={onLogout}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>
    </>
  );
};

