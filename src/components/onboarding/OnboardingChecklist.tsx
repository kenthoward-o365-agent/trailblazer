import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  route?: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { id: "coa", title: "Chart of Accounts", description: "GL accounts aligned to your external accounting.", route: "/accounting" },
  { id: "taxes", title: "Taxes", description: "Sales, occupancy, and compound taxes.", route: "/accounting" },
  { id: "users", title: "Roles & Users", description: "Invite your first admin, manager, and front desk.", route: "/user-management" },
  { id: "site_types", title: "Site Types", description: "Back-in, Pull-thru, Tent, Cabin, etc.", route: "/settings/site-types" },
  { id: "sites", title: "Sites & Map", description: "Bulk-create sites and lay them out visually.", route: "/map-editor" },
  { id: "rates", title: "Rates", description: "Daily, weekly, monthly, seasons, packages.", route: "/rates" },
  { id: "reservation_settings", title: "Reservation Settings", description: "Deposits, guarantees, source of business.", route: "/settings/reservations" },
  { id: "booking_engine", title: "Booking Engine", description: "Launch your direct booking website.", route: "/settings/booking-engine" },
  { id: "crm", title: "CRM", description: "Reg Card, Confirmation Letter, OTA→Direct campaign.", route: "/crm" },
  { id: "pos", title: "Point of Sale (optional)", description: "Camp store, items, and bill-to-room.", route: "/pos/setup" },
];

interface Props {
  currentStep: string;
  progress: Record<string, "complete" | "in_progress" | undefined>;
  onSelect: (stepId: string) => void;
  onToggleComplete?: (stepId: string, complete: boolean) => void;
}

export const OnboardingChecklist = ({ currentStep, progress, onSelect, onToggleComplete }: Props) => {
  const completedCount = ONBOARDING_STEPS.filter((s) => progress[s.id] === "complete").length;
  const percent = Math.round((completedCount / ONBOARDING_STEPS.length) * 100);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-2">
        <h2 className="font-semibold">Setup Progress</h2>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {completedCount} of {ONBOARDING_STEPS.length} steps complete
        </p>
        <p className="text-[11px] text-muted-foreground/80 leading-snug">
          Tip: click the circle to mark a step done yourself, or click the step name to chat with the agent.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {ONBOARDING_STEPS.map((step, i) => {
          const status = progress[step.id];
          const isActive = currentStep === step.id;
          const isDone = status === "complete";
          return (
            <div
              key={step.id}
              className={cn(
                "w-full rounded-md border px-2 py-2.5 transition-colors flex items-start gap-2",
                "hover:bg-muted/60 hover:border-primary/40",
                isActive ? "border-primary bg-primary/5" : "border-border/60 bg-card"
              )}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleComplete?.(step.id, !isDone);
                }}
                title={isDone ? "Mark as not done" : "Mark as complete"}
                className="mt-0.5 shrink-0 rounded-full hover:scale-110 transition-transform"
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{i + 1}.</span>
                  <span className="text-sm font-medium truncate">{step.title}</span>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary ml-auto" />}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                  {step.description}
                </p>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
