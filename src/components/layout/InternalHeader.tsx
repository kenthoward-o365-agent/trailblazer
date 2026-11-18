import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, LogOut, HelpCircle, Shield } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate } from "react-router-dom";

interface InternalHeaderProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  internalRole: string | null;
  staffName: string;
  onLogout: () => void;
}

export const InternalHeader = ({
  mobileMenuOpen,
  setMobileMenuOpen,
  internalRole,
  staffName,
  onLogout,
}: InternalHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 z-10">
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
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border">
            <Shield className="h-3 w-3 mr-1" />
            {internalRole?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
          <span className="text-sm text-sidebar-foreground/70 hidden lg:block">{staffName}</span>
          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => navigate('/help')} title="Knowledge Base">
            <HelpCircle className="h-5 w-5" />
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground px-2 sm:px-3" onClick={onLogout}>
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
