import { Button } from "@/components/ui/button";
import { FileText, Settings, Shield, PanelLeftClose, PanelLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CollapsibleNavSection } from "./CollapsibleNavSection";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { NavItem, SettingsSubItem, AdminSubItem } from "@/hooks/useDashboardNavigation";
import { cn } from "@/lib/utils";

interface SidebarNavigationProps {
  isInternalUser: boolean;
  isSuperAdmin: boolean;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  navItems: NavItem[];
  settingsItems: SettingsSubItem[];
  reportsItems: SettingsSubItem[];
  adminItems: AdminSubItem[];
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  reportsOpen: boolean;
  setReportsOpen: (open: boolean) => void;
  adminOpen: boolean;
  setAdminOpen: (open: boolean) => void;
  isSettingsPath: boolean;
  isReportsPath: boolean;
  isAdminPath: boolean;
  isActivePath: (path: string) => boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const navItemBase =
  "w-full justify-start gap-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200";

const activeItemClass =
  "relative bg-sidebar-accent text-sidebar-accent-foreground shadow-elev-sm before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r before:bg-sidebar-primary";

export const SidebarNavigation = ({
  isInternalUser,
  isSuperAdmin,
  mobileMenuOpen,
  setMobileMenuOpen,
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
  sidebarCollapsed,
  setSidebarCollapsed,
}: SidebarNavigationProps) => {
  const navigate = useNavigate();

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleExpandSidebar = () => setSidebarCollapsed(false);

  const ToggleButton = () => (
    <div className="p-2 border-b border-sidebar-border flex justify-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
      </Button>
    </div>
  );

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = isActivePath(item.path);

    if (sidebarCollapsed) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("w-full h-9", navItemBase, isActive && activeItemClass)}
              onClick={() => handleNavigation(item.path)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Button
        key={item.path}
        variant="ghost"
        className={cn(navItemBase, isActive && activeItemClass)}
        onClick={() => handleNavigation(item.path)}
      >
        <Icon className="mr-2 h-4 w-4" />
        {item.label}
      </Button>
    );
  };

  const renderSubItem = (item: SettingsSubItem) => {
    if (sidebarCollapsed) return null;
    const isActive = isActivePath(item.path);
    return (
      <Button
        key={item.path}
        variant="ghost"
        size="sm"
        className={cn(
          "w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
        )}
        onClick={() => handleNavigation(item.path)}
      >
        {item.label}
      </Button>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          mobileMenuOpen ? "block" : "hidden",
          "md:block border-r border-sidebar-border bg-sidebar text-sidebar-foreground min-h-screen transition-all duration-200",
          sidebarCollapsed ? "w-14" : "w-64",
        )}
      >
        <ToggleButton />
        <nav className="p-2 space-y-1">
          {isInternalUser ? (
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sidebar-primary flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5" />
                  Trailblazer Admin
                </div>
              )}
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActivePath(item.path);
                if (sidebarCollapsed) {
                  return (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("w-full h-9", navItemBase, isActive && activeItemClass)}
                          onClick={() => handleNavigation(item.path)}
                        >
                          <Icon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                }
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    className={cn(navItemBase, isActive && activeItemClass)}
                    onClick={() => handleNavigation(item.path)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          ) : (
            <>
              {navItems.map(renderNavItem)}

              <CollapsibleNavSection
                icon={FileText}
                title="Reports"
                isActive={isReportsPath}
                open={reportsOpen}
                onOpenChange={setReportsOpen}
                collapsed={sidebarCollapsed}
                onExpandSidebar={handleExpandSidebar}
              >
                {reportsItems.map(renderSubItem)}
              </CollapsibleNavSection>

              <CollapsibleNavSection
                icon={Settings}
                title="Settings"
                isActive={isSettingsPath}
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                collapsed={sidebarCollapsed}
                onExpandSidebar={handleExpandSidebar}
              >
                {settingsItems.map(renderSubItem)}
              </CollapsibleNavSection>

              {isSuperAdmin && (
                <CollapsibleNavSection
                  icon={Shield}
                  title="Trailblazer Admin"
                  isActive={isAdminPath}
                  open={adminOpen}
                  onOpenChange={setAdminOpen}
                  collapsed={sidebarCollapsed}
                  onExpandSidebar={handleExpandSidebar}
                >
                  {adminItems.map((item) => {
                    if (sidebarCollapsed) return null;
                    const Icon = item.icon;
                    const isActive = isActivePath(item.path);
                    return (
                      <Button
                        key={item.path}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                        )}
                        onClick={() => handleNavigation(item.path)}
                      >
                        <Icon className="mr-2 h-3 w-3" />
                        {item.label}
                      </Button>
                    );
                  })}
                </CollapsibleNavSection>
              )}
            </>
          )}
        </nav>
      </aside>
    </TooltipProvider>
  );
};
