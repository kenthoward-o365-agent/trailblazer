import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Printer,
  Mail,
  MessageSquare,
  PenLine,
  Loader2,
  Check,
  FileText,
} from "lucide-react";
import DOMPurify from "dompurify";
import { format, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatLocalDate } from "@/lib/dateUtils";
import { SignaturePad, type SignaturePadRef } from "./SignaturePad";

type Channel = "registration_card" | "confirmation_letter" | "email" | "sms";
type Mode = "print" | "sign" | "email" | "sms";

interface Campaign {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  content: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reservationId: string;
  defaultMode?: Mode;
}

const MODE_TO_CHANNELS: Record<Mode, Channel[]> = {
  print: ["registration_card", "confirmation_letter"],
  sign: ["registration_card"],
  email: ["email", "confirmation_letter", "registration_card"],
  sms: ["sms"],
};

export function RegistrationCardDialog({
  open,
  onOpenChange,
  reservationId,
  defaultMode = "print",
}: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [reservation, setReservation] = useState<any>(null);
  const [property, setProperty] = useState<any>(null);
  const [paymentCard, setPaymentCard] = useState<any>(null);
  const [existingSignature, setExistingSignature] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [emailTo, setEmailTo] = useState("");
  const [smsTo, setSmsTo] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [sigEmpty, setSigEmpty] = useState(true);
  const signatureRef = useRef<SignaturePadRef>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => setMode(defaultMode), [defaultMode, open]);

  useEffect(() => {
    if (!open || !reservationId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: r }, { data: c }] = await Promise.all([
        supabase
          .from("reservations")
          .select(
            "id, guest_id, confirmation_number, check_in_date, check_out_date, total_price, adults_count, children_count, special_requests, property_id, registration_signature, registration_signed_at, registration_signed_name, guests(first_name, last_name, email, phone, phone2, street_address, city, state, zipcode), sites(site_number, site_types(name)), rates(rate_code)",
          )
          .eq("id", reservationId)
          .maybeSingle(),
        supabase
          .from("campaigns")
          .select("id, name, channel, subject, content")
          .in("channel", ["registration_card", "confirmation_letter", "email", "sms"])
          .eq("status", "active"),
      ]);
      if (cancelled) return;
      setReservation(r);
      setCampaigns((c as Campaign[]) || []);
      setEmailTo(r?.guests?.email || "");
      setSmsTo(r?.guests?.phone || "");
      setSignedName(
        `${r?.guests?.first_name || ""} ${r?.guests?.last_name || ""}`.trim(),
      );
      setExistingSignature(r?.registration_signature || null);
      setSignedAt(r?.registration_signed_at || null);
      if (r?.property_id) {
        const [{ data: p }, { data: pc }] = await Promise.all([
          supabase
            .from("properties")
            .select("name, address, city, state, zip, phone1, email")
            .eq("id", r.property_id)
            .maybeSingle(),
          supabase
            .from("payment_cards")
            .select("card_brand, last_four_digits, expiry_month, expiry_year")
            .eq("reservation_id", reservationId)
            .eq("is_primary", true)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        setProperty(p);
        setPaymentCard(pc);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reservationId]);

  // Filter campaigns by current mode
  const eligibleCampaigns = useMemo(
    () => campaigns.filter((c) => MODE_TO_CHANNELS[mode].includes(c.channel as Channel)),
    [campaigns, mode],
  );

  // Auto-select best template when mode/list changes
  useEffect(() => {
    if (eligibleCampaigns.length === 0) {
      setSelectedCampaignId("");
      return;
    }
    // Prefer registration_card for print/sign; email for email
    const preferChannel: Channel =
      mode === "sign" || mode === "print" ? "registration_card" : (mode as Channel);
    const preferred =
      eligibleCampaigns.find((c) => c.channel === preferChannel) || eligibleCampaigns[0];
    setSelectedCampaignId(preferred.id);
  }, [eligibleCampaigns, mode]);

  const selectedCampaign = eligibleCampaigns.find((c) => c.id === selectedCampaignId);

  const renderedContent = useMemo(() => {
    if (!reservation) return "";
    const base = selectedCampaign?.content || defaultRegCardTemplate();
    return applyVariables(base, {
      reservation,
      property,
      paymentCard,
      signature: mode === "sign" ? signatureDataURLPlaceholder : existingSignature,
      signedName,
      signedAt,
    });
  }, [selectedCampaign, reservation, property, paymentCard, existingSignature, signedName, signedAt, mode]);

  useEffect(() => {
    if (subject) return;
    if (selectedCampaign?.subject) setSubject(selectedCampaign.subject);
    else if (reservation)
      setSubject(
        `${property?.name || "Reservation"} — Confirmation #${reservation.confirmation_number}`,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign, reservation, property]);

  // Live preview iframe for print/sign/email
  useEffect(() => {
    if (!open || loading || mode === "sms") return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const withSig = mode === "sign" ? injectLiveSignature(renderedContent) : renderedContent;
    doc.open();
    doc.write(buildPrintableHtml(subject || "Document", withSig));
    doc.close();
  }, [renderedContent, subject, open, loading, mode]);

  const buildFinalHtml = (signatureDataUrl?: string | null) => {
    const content = signatureDataUrl
      ? renderedContent.replace(
          signatureDataURLPlaceholder,
          `<img src="${signatureDataUrl}" alt="Signature" style="max-height:80px;display:block;" />`,
        )
      : renderedContent.replace(signatureDataURLPlaceholder, existingSignature
          ? `<img src="${existingSignature}" alt="Signature" style="max-height:80px;display:block;" />`
          : `<div style="height:80px;border-bottom:1px solid #000;width:280px;"></div><div style="font-size:11px;margin-top:4px;">Guest Signature</div>`);
    return buildPrintableHtml(subject || "Document", content);
  };

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return toast.error("Preview not ready");
    // Rebuild with live signature for printing if signed
    const sigUrl = signatureRef.current?.toDataURL() || null;
    const doc = iframeRef.current!.contentDocument!;
    doc.open();
    doc.write(buildFinalHtml(sigUrl));
    doc.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 150);
  };

  const handleSaveSignature = async () => {
    const sigUrl = signatureRef.current?.toDataURL();
    if (!sigUrl) return toast.error("Please capture a signature first");
    if (!signedName.trim()) return toast.error("Enter the guest's printed name");
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("reservations")
        .update({
          registration_signature: sigUrl,
          registration_signed_at: now,
          registration_signed_name: signedName.trim(),
        })
        .eq("id", reservationId);
      if (error) throw error;
      setExistingSignature(sigUrl);
      setSignedAt(now);
      toast.success("Signature captured and saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save signature");
    } finally {
      setSaving(false);
    }
  };

  const recordCampaignSend = async (status: "sent" | "failed") => {
    if (!selectedCampaign || !reservation) return;
    try {
      await supabase.from("campaign_sends").insert({
        campaign_id: selectedCampaign.id,
        reservation_id: reservation.id,
        guest_id: reservation.guest_id || null,
        status,
      });
    } catch {
      /* non-fatal */
    }
  };

  const handleEmail = async () => {
    if (!emailTo.includes("@")) return toast.error("Enter a valid email address");
    setSending(true);
    try {
      const html = buildFinalHtml(signatureRef.current?.toDataURL() || null);
      const { data, error } = await supabase.functions.invoke("send-communication", {
        body: {
          channel: "email",
          recipientEmail: emailTo,
          subject: subject || "Message",
          html,
          propertyName: property?.name,
          guestName: signedName,
        },
      });
      if (error) throw error;
      await recordCampaignSend("sent");
      if ((data as any)?.mockMode) toast.success("Email logged (Resend not configured)");
      else toast.success(`Email sent to ${emailTo}`);
    } catch (e: any) {
      await recordCampaignSend("failed");
      toast.error(e.message || "Email failed");
    } finally {
      setSending(false);
    }
  };

  const handleSms = async () => {
    if (!smsTo || smsTo.length < 7) return toast.error("Enter a valid phone number");
    setSending(true);
    try {
      // Strip HTML for SMS body
      const text = (selectedCampaign?.content || "")
        ? applyVariables(selectedCampaign!.content!, { reservation, property, paymentCard })
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim()
        : `${property?.name || ""}: Confirmation #${reservation?.confirmation_number}. Check-in ${formatLocalDate(reservation?.check_in_date, "MMM d, yyyy")}.`;
      const { data, error } = await supabase.functions.invoke("send-communication", {
        body: {
          channel: "sms",
          recipientPhone: smsTo,
          text: text.slice(0, 1600),
          propertyName: property?.name,
        },
      });
      if (error) throw error;
      await recordCampaignSend("sent");
      if ((data as any)?.mockMode)
        toast.success("SMS logged (Twilio not configured). Connect Twilio to send live SMS.");
      else toast.success(`SMS sent to ${smsTo}`);
    } catch (e: any) {
      await recordCampaignSend("failed");
      toast.error(e.message || "SMS failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Guest Communication
            {existingSignature && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-emerald-600">
                <Check className="h-3 w-3" /> Signed
                {signedAt ? ` ${format(new Date(signedAt), "MMM d, h:mm a")}` : ""}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b bg-muted/30">
            <TabsList>
              <TabsTrigger value="print">
                <Printer className="h-3.5 w-3.5 mr-1" /> Print
              </TabsTrigger>
              <TabsTrigger value="sign">
                <PenLine className="h-3.5 w-3.5 mr-1" /> Sign on Screen
              </TabsTrigger>
              <TabsTrigger value="email">
                <Mail className="h-3.5 w-3.5 mr-1" /> Email
              </TabsTrigger>
              <TabsTrigger value="sms">
                <MessageSquare className="h-3.5 w-3.5 mr-1" /> SMS
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 min-w-[240px]">
              <Label className="text-xs whitespace-nowrap">Template</Label>
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={eligibleCampaigns.length ? "Select template" : "No templates"} />
                </SelectTrigger>
                <SelectContent>
                  {eligibleCampaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} <span className="text-muted-foreground">({c.channel})</span>
                    </SelectItem>
                  ))}
                  {mode !== "sms" && (
                    <SelectItem value="__default__">Default registration card</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-0">
            {/* Preview / Content */}
            <div className="min-h-0 bg-neutral-100 dark:bg-neutral-900 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
                </div>
              ) : mode === "sms" ? (
                <div className="p-6 h-full overflow-auto">
                  <div className="max-w-sm mx-auto">
                    <div className="bg-muted rounded-2xl p-4">
                      <div className="bg-primary text-primary-foreground rounded-xl p-3">
                        <p className="text-sm whitespace-pre-wrap">
                          {selectedCampaign?.content
                            ? applyVariables(selectedCampaign.content, {
                                reservation,
                                property,
                                paymentCard,
                              })
                                .replace(/<[^>]+>/g, "")
                                .replace(/\s+/g, " ")
                                .trim()
                            : `${property?.name || ""}: Confirmation #${reservation?.confirmation_number}. Check-in ${reservation ? formatLocalDate(reservation.check_in_date, "MMM d, yyyy") : ""}.`}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 text-right">SMS Preview</p>
                    </div>
                  </div>
                </div>
              ) : (
                <iframe ref={iframeRef} title="Preview" className="w-full h-full bg-white" />
              )}
            </div>

            {/* Action panel */}
            <div className="border-l p-4 space-y-3 overflow-auto">
              <TabsContent value="print" className="m-0 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Print the registration card for the guest to sign physically.
                </p>
                <Button className="w-full" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
              </TabsContent>

              <TabsContent value="sign" className="m-0 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Hand the device to the guest. They can sign with finger, stylus, or mouse.
                </p>
                <div>
                  <Label className="text-xs">Printed Name</Label>
                  <Input
                    value={signedName}
                    onChange={(e) => setSignedName(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Signature</Label>
                  <SignaturePad ref={signatureRef} onChange={setSigEmpty} />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSaveSignature}
                  disabled={saving || sigEmpty}
                >
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Save Signature
                </Button>
                <Button variant="outline" className="w-full" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" /> Print Signed Copy
                </Button>
                {existingSignature && (
                  <p className="text-xs text-muted-foreground">
                    A signature is already on file{signedAt ? ` from ${format(new Date(signedAt), "PPp")}` : ""}. Capturing a new one will replace it.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="email" className="m-0 space-y-3">
                <div>
                  <Label className="text-xs">To</Label>
                  <Input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-9"
                  />
                </div>
                <Button className="w-full" onClick={handleEmail} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                  Send Email
                </Button>
              </TabsContent>

              <TabsContent value="sms" className="m-0 space-y-3">
                <div>
                  <Label className="text-xs">To (phone)</Label>
                  <Input
                    type="tel"
                    value={smsTo}
                    onChange={(e) => setSmsTo(e.target.value)}
                    placeholder="+15555551234"
                    className="h-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Uses the selected SMS campaign template. HTML is stripped automatically.
                </p>
                <Button className="w-full" onClick={handleSms} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                  Send SMS
                </Button>
              </TabsContent>
            </div>
          </div>
        </Tabs>

        <DialogFooter className="p-3 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- helpers ----------

const signatureDataURLPlaceholder = "__SIGNATURE_PLACEHOLDER__";

function injectLiveSignature(html: string) {
  // In the live preview, replace placeholder with a visible signature line
  return html.replace(
    signatureDataURLPlaceholder,
    `<div style="height:80px;border-bottom:1px solid #000;width:320px;"></div><div style="font-size:11px;margin-top:4px;color:#555;">Guest signs on device — click "Save Signature" to lock in.</div>`,
  );
}

function applyVariables(content: string, ctx: any): string {
  const r = ctx.reservation || {};
  const g = r.guests || {};
  const s = r.sites || {};
  const st = s.site_types || {};
  const p = ctx.property || {};
  const card = ctx.paymentCard || {};
  const nights = r.check_in_date && r.check_out_date
    ? differenceInDays(new Date(r.check_out_date), new Date(r.check_in_date))
    : 0;
  const cardExp = card?.expiry_month
    ? `${String(card.expiry_month).padStart(2, "0")}/${card.expiry_year}`
    : "";
  const sigHtml = ctx.signature
    ? (ctx.signature === signatureDataURLPlaceholder
        ? signatureDataURLPlaceholder
        : `<img src="${ctx.signature}" alt="Signature" style="max-height:80px;display:block;" />`)
    : `<div style="height:80px;border-bottom:1px solid #000;width:280px;"></div><div style="font-size:11px;margin-top:4px;">Guest Signature</div>`;

  const map: Record<string, string> = {
    first_name: g.first_name || "",
    last_name: g.last_name || "",
    email: g.email || "",
    phone: g.phone || "",
    phone2: g.phone2 || "",
    address: g.street_address || "",
    city: g.city || "",
    state: g.state || "",
    zipcode: g.zipcode || "",
    check_in_date: r.check_in_date ? formatLocalDate(r.check_in_date, "MMMM d, yyyy") : "",
    check_out_date: r.check_out_date ? formatLocalDate(r.check_out_date, "MMMM d, yyyy") : "",
    site_number: s.site_number || "",
    site_type: st.name || "",
    rate_code: r.rates?.rate_code || "Standard",
    total_price: r.total_price != null ? `$${Number(r.total_price).toFixed(2)}` : "",
    nights: String(nights),
    adults: String(r.adults_count ?? 1),
    children: String(r.children_count ?? 0),
    special_requests: r.special_requests || "",
    property_name: p.name || "",
    property_address: [p.address, p.city, p.state, p.zip].filter(Boolean).join(", "),
    today_date: format(new Date(), "MMMM d, yyyy"),
    card_type: card.card_brand || "",
    card_last_four: card.last_four_digits || "",
    card_expiration: cardExp,
    confirmation_number: r.confirmation_number || "",
    signed_name: ctx.signedName || "",
    signed_at: ctx.signedAt ? format(new Date(ctx.signedAt), "PPp") : "",
    signature_line: sigHtml,
  };

  let out = content;
  for (const [k, v] of Object.entries(map)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), v);
  }
  return DOMPurify.sanitize(out, {
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  });
}

function buildPrintableHtml(title: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;padding:32px;max-width:800px;margin:0 auto;line-height:1.55;color:#111;}
  h1,h2,h3{margin:0 0 8px}
  table{border-collapse:collapse;width:100%}
  td,th{padding:4px 6px}
  @media print { body{padding:16px} .no-print{display:none !important} }
</style></head><body>${body}</body></html>`;
}

function defaultRegCardTemplate(): string {
  return `
    <h2>{{property_name}}</h2>
    <div style="font-size:12px;color:#555;margin-bottom:16px;">{{property_address}}</div>
    <h3>Registration Card</h3>
    <table style="margin:8px 0 16px 0;font-size:13px">
      <tr><td><strong>Confirmation #</strong></td><td>{{confirmation_number}}</td>
          <td><strong>Date</strong></td><td>{{today_date}}</td></tr>
      <tr><td><strong>Guest</strong></td><td colspan="3">{{first_name}} {{last_name}}</td></tr>
      <tr><td><strong>Address</strong></td><td colspan="3">{{address}}, {{city}}, {{state}} {{zipcode}}</td></tr>
      <tr><td><strong>Phone</strong></td><td>{{phone}}</td><td><strong>Email</strong></td><td>{{email}}</td></tr>
      <tr><td><strong>Check-In</strong></td><td>{{check_in_date}}</td>
          <td><strong>Check-Out</strong></td><td>{{check_out_date}}</td></tr>
      <tr><td><strong>Nights</strong></td><td>{{nights}}</td>
          <td><strong>Guests</strong></td><td>{{adults}} adults, {{children}} children</td></tr>
      <tr><td><strong>Site</strong></td><td>{{site_number}} ({{site_type}})</td>
          <td><strong>Rate</strong></td><td>{{rate_code}}</td></tr>
      <tr><td><strong>Total</strong></td><td colspan="3">{{total_price}}</td></tr>
      <tr><td><strong>Card on File</strong></td><td colspan="3">{{card_type}} •••• {{card_last_four}} exp {{card_expiration}}</td></tr>
    </table>
    <p style="font-size:12px;color:#333">
      By signing below, the guest acknowledges the property's policies including check-out time, cancellation, and damage liability.
    </p>
    <div style="margin-top:32px">
      {{signature_line}}
      <div style="margin-top:8px;font-size:12px;">Printed Name: {{signed_name}}</div>
      <div style="font-size:12px;color:#555">Signed: {{signed_at}}</div>
    </div>
  `;
}
