import { useEffect, useRef, useState } from "react";
import { AdyenCheckout, Dropin, Card } from "@adyen/adyen-web";
import "@adyen/adyen-web/styles/adyen.css";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert } from "lucide-react";
import { Card as UICard } from "@/components/ui/card";

interface AdyenDropInProps {
  propertyId: string;
  reservationId?: string;
  amount?: number;
  currency?: string;
  mode?: "tokenize" | "authorize" | "sale";
  onComplete: (result: { sessionId: string; resultCode: string; sessionResult?: string }) => void;
  onError?: (err: string) => void;
}

/**
 * PCI SAQ A compliant card capture. Renders Adyen's hosted Drop-in — card
 * fields live in Adyen iframes, so PAN + CVV never enter our DOM, our React
 * state, our network, or our servers.
 */
export function AdyenDropIn({
  propertyId,
  reservationId,
  amount = 0,
  currency = "USD",
  mode = "tokenize",
  onComplete,
  onError,
}: AdyenDropInProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "unconfigured">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let disposed = false;
    let dropin: Dropin | null = null;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("adyen-session", {
          body: { propertyId, reservationId, amount, currency, mode },
        });

        if (disposed) return;

        if (error || !data) {
          setStatus("error");
          setErrorMsg(error?.message ?? "Failed to start payment session");
          onError?.(error?.message ?? "Failed to start payment session");
          return;
        }

        if (data.error === "adyen_not_configured") {
          setStatus("unconfigured");
          return;
        }

        if (!data.id || !data.clientKey) {
          setStatus("error");
          setErrorMsg("Invalid payment session response");
          onError?.("Invalid payment session response");
          return;
        }

        const checkout = await AdyenCheckout({
          environment: data.environment ?? "test",
          clientKey: data.clientKey,
          session: {
            id: data.id,
            sessionData: data.sessionData,
          },
          onPaymentCompleted: (result: any) => {
            onComplete({
              sessionId: data.id,
              resultCode: result.resultCode,
              sessionResult: result.sessionResult,
            });
          },
          onError: (err: any) => {
            const msg = err?.message ?? "Payment error";
            setErrorMsg(msg);
            onError?.(msg);
          },
        });

        if (disposed || !containerRef.current) return;

        dropin = new Dropin(checkout, {
          paymentMethodComponents: [Card],
        }).mount(containerRef.current);

        setStatus("ready");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setStatus("error");
        setErrorMsg(msg);
        onError?.(msg);
      }
    })();

    return () => {
      disposed = true;
      try {
        dropin?.unmount();
      } catch {
        /* no-op */
      }
    };
  }, [propertyId, reservationId, amount, currency, mode]);

  if (status === "unconfigured") {
    return (
      <UICard className="p-4 border-amber-500/40 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Card capture is temporarily unavailable</p>
            <p className="text-muted-foreground mt-1">
              The Adyen payment gateway has not been configured yet. Card entry is
              intentionally disabled until real credentials are provisioned to keep
              the system PCI SAQ A compliant.
            </p>
          </div>
        </div>
      </UICard>
    );
  }

  return (
    <div>
      {status === "loading" && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading secure payment form…
        </div>
      )}
      {status === "error" && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {errorMsg}
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
