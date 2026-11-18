import { AdyenDropIn } from "./AdyenDropIn";
import type { PaymentSource } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdyenCardCaptureProps {
  propertyId: string;
  reservationId?: string;
  ledgerAccountId?: string;
  guestId?: string;
  cardSequence?: number;
  mode?: "tokenize" | "authorize" | "sale";
  amount?: number;
  source?: PaymentSource;
  onSuccess: (result: { cardId?: string; authorizationId?: string; transactionId?: string }) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

/**
 * SAQ A card capture. Renders Adyen Drop-in (PAN never enters our DOM).
 * On completion, we call `process-payment` with only the opaque Adyen session
 * result — our backend then persists the token, brand, and last4 only.
 */
export function AdyenCardCapture({
  propertyId,
  reservationId,
  ledgerAccountId,
  guestId,
  cardSequence = 1,
  mode = "tokenize",
  amount,
  source = "pms",
  onSuccess,
  onError,
}: AdyenCardCaptureProps) {
  const handleComplete = async (result: { sessionId: string; resultCode: string; sessionResult?: string }) => {
    try {
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          action: mode === "sale" ? "record_sale" : mode === "authorize" ? "record_authorization" : "record_tokenization",
          propertyId,
          reservationId,
          ledgerAccountId,
          guestId,
          cardSequence,
          amount,
          source,
          adyenSessionId: result.sessionId,
          adyenSessionResult: result.sessionResult,
          adyenResultCode: result.resultCode,
        },
      });

      if (error || !data?.success) {
        const msg = data?.error ?? error?.message ?? "Failed to save payment";
        toast.error(msg);
        onError?.(msg);
        return;
      }

      toast.success(
        mode === "tokenize"
          ? "Card saved securely"
          : `Payment ${mode === "sale" ? "of" : "authorization of"} $${amount?.toFixed(2) ?? "0.00"} recorded`,
      );
      onSuccess({
        cardId: data.cardId,
        authorizationId: data.authorizationId,
        transactionId: data.transactionId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to record payment";
      toast.error(msg);
      onError?.(msg);
    }
  };

  return (
    <AdyenDropIn
      propertyId={propertyId}
      reservationId={reservationId}
      amount={amount}
      mode={mode}
      onComplete={handleComplete}
      onError={onError}
    />
  );
}
