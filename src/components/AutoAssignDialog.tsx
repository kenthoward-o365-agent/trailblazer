import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, Loader2, Wand2, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { runAutoAssignment, getEligibleReservationCount, AutoAssignmentResult } from "@/lib/autoAssignment";

type DialogStep = "config" | "preview" | "result";

interface AutoAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type DateScope = "today" | "tomorrow" | "range";

export function AutoAssignDialog({ open, onOpenChange, onComplete }: AutoAssignDialogProps) {
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();
  
  const [step, setStep] = useState<DialogStep>("config");
  const [dateScope, setDateScope] = useState<DateScope>("today");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  const [eligibleCount, setEligibleCount] = useState<number>(0);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [isFloating, setIsFloating] = useState<boolean>(true);
  const [loadingCount, setLoadingCount] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<AutoAssignmentResult | null>(null);
  const [finalResult, setFinalResult] = useState<AutoAssignmentResult | null>(null);

  // Get date range based on scope
  const getDateRange = (): { start: string; end: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (dateScope) {
      case "today":
        const todayStr = today.toISOString().split("T")[0];
        return { start: todayStr, end: todayStr };
      case "tomorrow":
        const tomorrow = addDays(today, 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];
        return { start: tomorrowStr, end: tomorrowStr };
      case "range":
        return {
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0],
        };
    }
  };

  // Load eligible count when dialog opens or dates change
  useEffect(() => {
    if (!open || !selectedProperty?.id) return;
    
    const loadCount = async () => {
      setLoadingCount(true);
      const { start, end } = getDateRange();
      const { count, skipped, isFloating: floating } = await getEligibleReservationCount(
        selectedProperty.id,
        start,
        end
      );
      setEligibleCount(count);
      setSkippedCount(skipped);
      setIsFloating(floating);
      setLoadingCount(false);
    };
    
    loadCount();
  }, [open, selectedProperty?.id, dateScope, startDate, endDate]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("config");
      setPreviewResult(null);
      setFinalResult(null);
      setDateScope("today");
      setStartDate(new Date());
      setEndDate(new Date());
    }
  }, [open]);

  const handlePreview = async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    const { start, end } = getDateRange();
    const result = await runAutoAssignment(selectedProperty.id, start, end, true);
    setPreviewResult(result);
    setStep("preview");
    setLoading(false);
  };

  const handleApply = async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    const { start, end } = getDateRange();
    const result = await runAutoAssignment(selectedProperty.id, start, end, false);
    setFinalResult(result);
    setStep("result");
    setLoading(false);
    
    if (result.assignments.length > 0) {
      onComplete?.();
    }
  };

  const handleBack = () => {
    setStep("config");
    setPreviewResult(null);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const getScopeDateLabel = (): string => {
    switch (dateScope) {
      case "today":
        return format(new Date(), "MMM d, yyyy");
      case "tomorrow":
        return format(addDays(new Date(), 1), "MMM d, yyyy");
      case "range":
        return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Auto {terminology.site} Assignment
          </DialogTitle>
          <DialogDescription>
            Optimize {terminology.site.toLowerCase()} assignments to minimize availability gaps
          </DialogDescription>
        </DialogHeader>

        {!isFloating && !loadingCount && step === "config" && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Auto-assignment is only available for properties with floating inventory mode.
              Your property is configured to assign {terminology.sites.toLowerCase()} by number.
            </AlertDescription>
          </Alert>
        )}

        {/* Step 1: Configuration */}
        {isFloating && step === "config" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Select arrivals to include</Label>
              <RadioGroup
                value={dateScope}
                onValueChange={(value) => setDateScope(value as DateScope)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="today" id="today" />
                  <Label htmlFor="today" className="font-normal cursor-pointer">
                    Today's Arrivals
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tomorrow" id="tomorrow" />
                  <Label htmlFor="tomorrow" className="font-normal cursor-pointer">
                    Tomorrow's Arrivals
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="range" id="range" />
                  <Label htmlFor="range" className="font-normal cursor-pointer">
                    Date Range
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {dateScope === "range" && (
              <div className="flex gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal flex-1",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        if (date) {
                          setStartDate(date);
                          if (date > endDate) {
                            setEndDate(date);
                          }
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal flex-1",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      disabled={(date) => date < startDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Arrival date(s):</span>
                <span className="text-sm font-medium">{getScopeDateLabel()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Eligible reservations:</span>
                {loadingCount ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Badge variant="secondary">{eligibleCount}</Badge>
                )}
              </div>
              {skippedCount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Skipped (locked/group):</span>
                  <Badge variant="outline">{skippedCount}</Badge>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && previewResult && (
          <div className="space-y-4">
            <Alert>
              <Wand2 className="h-4 w-4" />
              <AlertDescription>
                Review the proposed {terminology.site.toLowerCase()} assignments below. Click "Apply Changes" to confirm.
              </AlertDescription>
            </Alert>

            {previewResult.assignments.length > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Proposed Changes ({previewResult.assignments.length})</Label>
                  {previewResult.skipped > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {previewResult.skipped} skipped
                    </span>
                  )}
                </div>
                <ScrollArea className="h-[250px] rounded-md border">
                  <div className="p-3 space-y-2">
                    {previewResult.assignments.map((assignment) => (
                      <div
                        key={assignment.reservationId}
                        className="flex items-center justify-between text-sm py-2 px-2 border-b last:border-0 hover:bg-muted/50 rounded"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{assignment.confirmationNumber}
                            </span>
                          </div>
                          <span className="text-sm truncate block">{assignment.guestName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground shrink-0 ml-2">
                          <Badge variant="outline" className="font-mono">
                            {assignment.oldSiteNumber || "—"}
                          </Badge>
                          <ArrowRight className="h-3 w-3" />
                          <Badge variant="secondary" className="font-mono">
                            {assignment.newSiteNumber}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>No changes needed - all reservations are already optimally assigned.</p>
              </div>
            )}

            {previewResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {previewResult.errors.length} issue(s) found during preview
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 3: Final Result */}
        {step === "result" && finalResult && (
          <div className="space-y-4">
            <Alert variant={finalResult.success ? "default" : "destructive"}>
              {finalResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>{finalResult.message}</AlertDescription>
            </Alert>

            {finalResult.assignments.length > 0 && (
              <div className="space-y-2">
                <Label>Completed Changes ({finalResult.assignments.length})</Label>
                <ScrollArea className="h-[200px] rounded-md border">
                  <div className="p-3 space-y-2">
                    {finalResult.assignments.map((assignment) => (
                      <div
                        key={assignment.reservationId}
                        className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
                      >
                        <div>
                          <span className="font-mono text-xs text-muted-foreground">
                            #{assignment.confirmationNumber}
                          </span>
                          <span className="ml-2">{assignment.guestName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Badge variant="outline" className="font-mono">
                            {assignment.oldSiteNumber || "—"}
                          </Badge>
                          <ArrowRight className="h-3 w-3" />
                          <Badge variant="secondary" className="font-mono">
                            {assignment.newSiteNumber}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {finalResult.errors.length > 0 && (
              <div className="space-y-2">
                <Label className="text-destructive">Errors</Label>
                <div className="text-sm text-destructive space-y-1">
                  {finalResult.errors.map((error, i) => (
                    <p key={i}>• {error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "config" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={loading || !isFloating || eligibleCount === 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Preview Changes
                  </>
                )}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={handleBack} disabled={loading}>
                Back
              </Button>
              <Button
                onClick={handleApply}
                disabled={loading || !previewResult?.assignments.length}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Apply Changes
                  </>
                )}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
