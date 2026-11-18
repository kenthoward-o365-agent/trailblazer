import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Mail, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  buildFolioHtml,
  type FolioPrintMode,
  type FolioPrintPosting,
  type FolioPrintProperty,
  type FolioPrintGuest,
  type FolioPrintReservation,
} from "@/lib/folioPrint";
import { useProperty } from "@/contexts/PropertyContext";

interface FolioPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  ledgerAccountId?: string;
  postings: FolioPrintPosting[];
  balance: number;
  siteTerminology?: string;
}

export function FolioPrintDialog({
  open,
  onOpenChange,
  reservationId,
  postings,
  balance,
  siteTerminology = "Site",
}: FolioPrintDialogProps) {
  const { selectedProperty } = useProperty();
  const [mode, setMode] = useState<FolioPrintMode>("detail");
  const [guest, setGuest] = useState<FolioPrintGuest | null>(null);
  const [reservation, setReservation] = useState<FolioPrintReservation | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open || !reservationId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("reservations")
        .select(
          "confirmation_number, check_in_date, check_out_date, adults_count, children_count, sites(site_number), guests(first_name, last_name, email, phone, address, city, state, zip)",
        )
        .eq("id", reservationId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const g = (data as any).guests || null;
        setGuest(g);
        setEmailTo(g?.email || "");
        setReservation({
          confirmation_number: (data as any).confirmation_number,
          check_in_date: (data as any).check_in_date,
          check_out_date: (data as any).check_out_date,
          adults_count: (data as any).adults_count,
          children_count: (data as any).children_count,
          site_number: (data as any).sites?.site_number ?? null,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reservationId]);

  const property: FolioPrintProperty | null = useMemo(() => {
    if (!selectedProperty) return null;
    return {
      name: selectedProperty.name,
      address: (selectedProperty as any).address ?? null,
      city: (selectedProperty as any).city ?? null,
      state: (selectedProperty as any).state ?? null,
      zip: (selectedProperty as any).zip ?? null,
      phone1: (selectedProperty as any).phone1 ?? null,
      email: (selectedProperty as any).email ?? null,
    };
  }, [selectedProperty]);

  const html = useMemo(
    () =>
      buildFolioHtml({
        mode,
        property,
        guest,
        reservation,
        postings,
        balance,
        siteTerminology,
        suppressAutoPrint: true,
      }),
    [mode, property, guest, reservation, postings, balance, siteTerminology],
  );

  // Sync preview iframe. Depend on `loading` so we (re)write the document
  // as soon as the iframe mounts (it isn't rendered while loading=true).
  useEffect(() => {
    if (!open || loading) return;
    const write = () => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return false;
      doc.open();
      doc.write(html);
      doc.close();
      return true;
    };
    if (!write()) {
      // Iframe may not have attached its contentDocument yet on first mount
      const id = requestAnimationFrame(() => write());
      return () => cancelAnimationFrame(id);
    }
  }, [html, open, loading]);


  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) {
      toast.error("Preview not ready");
      return;
    }
    try {
      win.focus();
      win.print();
    } catch (err) {
      console.error(err);
      toast.error("Failed to open print dialog");
    }
  };

  const handleOpenInWindow = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Please allow popups to open the preview");
      return;
    }
    w.document.write(
      buildFolioHtml({
        mode,
        property,
        guest,
        reservation,
        postings,
        balance,
        siteTerminology,
        suppressAutoPrint: false,
      }),
    );
    w.document.close();
  };

  const handleEmail = async () => {
    if (!emailTo || !emailTo.includes("@")) {
      toast.error("Enter a valid recipient email");
      return;
    }
    setEmailSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-folio-email", {
        body: {
          recipientEmail: emailTo,
          subject: `${property?.name || "Property"} — Guest Folio${reservation?.confirmation_number ? ` #${reservation.confirmation_number}` : ""} (${mode === "detail" ? "Detail" : "Summary"})`,
          folioHtml: html,
          propertyName: property?.name || "Property",
          guestName: `${guest?.first_name || ""} ${guest?.last_name || ""}`.trim() || "Guest",
        },
      });
      if (error) throw error;
      if ((data as any)?.mockMode) {
        toast.success("Email service not configured — printed preview to logs");
      } else {
        toast.success(`Folio emailed to ${emailTo}`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Folio Preview
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b bg-muted/30">
          <Tabs value={mode} onValueChange={(v) => setMode(v as FolioPrintMode)}>
            <TabsList>
              <TabsTrigger value="detail">Detail</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1 min-w-[220px] flex items-center gap-2">
            <Label htmlFor="folio-email-to" className="text-xs whitespace-nowrap">
              Email to
            </Label>
            <Input
              id="folio-email-to"
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="guest@example.com"
              className="h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleOpenInWindow}>
            Open in new window
          </Button>
          <Button variant="outline" size="sm" onClick={handleEmail} disabled={emailSending}>
            {emailSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Email
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>

        <div className="flex-1 overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          {loading ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading folio…
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              title="Folio preview"
              className="w-full h-full bg-white"
            />
          )}
        </div>

        <DialogFooter className="p-3 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
