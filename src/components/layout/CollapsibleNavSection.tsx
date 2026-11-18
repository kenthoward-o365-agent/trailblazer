import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CollapsibleNavSectionProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  isActive: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  collapsed?: boolean;
  onExpandSidebar?: () => void;
}

export const CollapsibleNavSection = ({
  icon: Icon,
  title,
  isActive,
  open,
  onOpenChange,
  children,
  collapsed = false,
  onExpandSidebar,
}: CollapsibleNavSectionProps) => {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`w-full h-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
              isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
            }`}
            onClick={() => {
              if (onExpandSidebar) onExpandSidebar();
              onOpenChange(true);
            }}
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{title}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={`w-full justify-between text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""
          }`}
        >
          <div className="flex items-center">
            <Icon className="mr-2 h-4 w-4" />
            {title}
          </div>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4 space-y-0.5 mt-1 border-l border-sidebar-border ml-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

