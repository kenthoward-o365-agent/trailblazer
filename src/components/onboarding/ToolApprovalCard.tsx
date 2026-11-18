import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, X, Zap } from "lucide-react";

interface Props {
  action: any;
  running: boolean;
  onApprove: () => void;
  onReject: () => void;
  result?: { ok: boolean; summary?: string; error?: string } | null;
}

export const ToolApprovalCard = ({ action, running, onApprove, onReject, result }: Props) => {
  if (!action) return null;
  return (
    <Card className="p-3 border-primary/40 bg-primary/5">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold uppercase text-primary tracking-wide">
            Proposed action
          </div>
          <div className="text-sm font-medium">{action.summary ?? action.type}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Type: {action.type}</div>
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              View details
            </summary>
            <pre className="mt-2 text-[11px] bg-background border rounded p-2 overflow-auto max-h-60">
              {JSON.stringify(action.payload ?? {}, null, 2)}
            </pre>
          </details>

          {result && (
            <div
              className={`mt-2 text-xs rounded p-2 ${
                result.ok
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {result.ok ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {result.summary ?? "Done"}
                </span>
              ) : (
                <span>Failed: {result.error}</span>
              )}
            </div>
          )}

          {!result && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={onApprove} disabled={running}>
                {running ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Running…
                  </>
                ) : (
                  "Approve & Run"
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={onReject} disabled={running}>
                <X className="h-3.5 w-3.5 mr-1" /> Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
