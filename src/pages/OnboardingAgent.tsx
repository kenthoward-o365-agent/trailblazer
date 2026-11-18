import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { OnboardingChecklist, ONBOARDING_STEPS } from "@/components/onboarding/OnboardingChecklist";
import { TrailGuideConversation } from "@/components/trailguide/TrailGuidePanel";
import { useProperty } from "@/contexts/PropertyContext";
import { supabase } from "@/integrations/supabase/client";
import { Flag } from "lucide-react";

type StepStatus = Record<string, "complete" | "in_progress" | undefined>;

const OnboardingAgent = () => {
  const { selectedProperty } = useProperty();
  const propertyId = (selectedProperty as any)?.id as string | undefined;
  const [currentStep, setCurrentStep] = useState<string>(ONBOARDING_STEPS[0].id);
  const [progress, setProgress] = useState<StepStatus>({});

  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      const { data } = await supabase
        .from("onboarding_progress")
        .select("steps, current_step")
        .eq("property_id", propertyId)
        .maybeSingle();
      if (data) {
        setProgress((data.steps as StepStatus) ?? {});
        if (data.current_step) setCurrentStep(data.current_step);
      }
    })();
  }, [propertyId]);

  const persist = async (nextProgress: StepStatus, nextStep: string) => {
    if (!propertyId) return;
    await supabase
      .from("onboarding_progress")
      .upsert(
        { property_id: propertyId, steps: nextProgress, current_step: nextStep },
        { onConflict: "property_id" }
      );
  };

  const handleSelect = (stepId: string) => {
    setCurrentStep(stepId);
    persist(progress, stepId);
  };

  const handleStepComplete = (stepId: string) => {
    const next = { ...progress, [stepId]: "complete" as const };
    setProgress(next);
    persist(next, currentStep);
  };

  const handleToggleComplete = (stepId: string, complete: boolean) => {
    const next = { ...progress };
    if (complete) next[stepId] = "complete";
    else delete next[stepId];
    setProgress(next);
    persist(next, currentStep);
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] min-h-0 flex flex-col -m-3 sm:-m-6">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
              <Flag className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold truncate">TrailGuide · Setup Guide</h1>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                Same TrailGuide agent — Setup mode walks you through configuration and writes it for you when you approve.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] overflow-hidden min-h-0">
          <aside className="border-b lg:border-b-0 lg:border-r bg-card overflow-auto max-h-56 lg:max-h-none">
            <OnboardingChecklist
              currentStep={currentStep}
              progress={progress}
              onSelect={handleSelect}
              onToggleComplete={handleToggleComplete}
            />
          </aside>
          <main className="overflow-hidden min-h-0">
            {propertyId ? (
              <TrailGuideConversation
                mode="setup"
                hideModeToggle
                setupStep={currentStep}
                onSetupStepComplete={handleStepComplete}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground p-4 text-center text-sm">
                Select a property in the header to begin onboarding.
              </div>
            )}
          </main>
        </div>
      </div>

    </DashboardLayout>
  );
};

export default OnboardingAgent;
