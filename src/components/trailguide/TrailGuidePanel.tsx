import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { Compass, Send, Mic, Square, X, Loader2, ShieldCheck, XCircle, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { useAuditDate } from "@/contexts/AuditDateContext";
import { knowledgeBaseData } from "@/data/knowledgeBase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mode = "operate" | "setup";
type ChatMsg = { role: "user" | "assistant"; content: string };
type ProposedAction = { id: string; tool: string; args: Record<string, any> };

const KB_FLAT = knowledgeBaseData.flatMap((c) =>
  c.articles.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    content: a.content,
    category: c.name,
  }))
);

const ACTION_LABELS: Record<string, (a: any) => string> = {
  // Operate
  check_in_reservation: (a) => `Check in ${a.guest_name ?? "reservation"} ${a.confirmation ? `(${a.confirmation})` : ""}`,
  check_out_reservation: (a) => `Check out ${a.guest_name ?? "reservation"} ${a.confirmation ? `(${a.confirmation})` : ""}`,
  update_work_order_status: (a) => `Set work order ${a.wo_number ?? ""} → ${a.status}`,
  update_site_status: (a) => `Mark site ${a.site_number ?? ""} → ${a.status}`,
  create_work_order: (a) => `Create work order: ${a.title} [${a.category}]`,
  send_broadcast: (a) => `Send broadcast "${a.name}" to ${String(a.audience ?? "").replace("_", " ")} via ${(a.channels ?? []).join(" + ")}`,
  create_campaign: (a) => `Create ${a.channel ?? "email"} campaign "${a.name}"${a.trigger_type && a.trigger_type !== "manual" ? ` (${a.trigger_type})` : ""}`,
  modify_reservation_dates: (a) => `Change reservation ${a.confirmation ?? ""} dates → ${a.check_in_date ?? "…"} → ${a.check_out_date ?? "…"}`,
  move_reservation_site: (a) => `Move reservation ${a.confirmation ?? ""} to site ${a.site_number ?? a.site_id}`,
  cancel_reservation: (a) => `Cancel reservation ${a.confirmation ?? ""}${a.guest_name ? ` (${a.guest_name})` : ""}`,
  post_folio_charge: (a) => `Post charge $${Number(a.amount ?? 0).toFixed(2)} — ${a.description ?? ""}`,
  post_folio_adjustment: (a) => `Post adjustment $${Number(a.amount ?? 0).toFixed(2)} — ${a.description ?? ""}`,
  apply_payment_manual: (a) => `Record payment $${Number(a.amount ?? 0).toFixed(2)} — ${a.description ?? ""}`,
  set_rate_price: (a) => `Set ${a.rate_code ?? "rate"} × ${a.site_type_name ?? "site type"} = $${Number(a.price ?? 0).toFixed(2)}/night`,
  // Setup
  create_accounts: (a) => `Create ${a.accounts?.length ?? 0} GL accounts`,
  create_taxes: (a) => `Create ${a.taxes?.length ?? 0} tax records`,
  create_site_types: (a) => `Create ${a.site_types?.length ?? 0} site types`,
  bulk_create_sites: (a) => `Create sites ${a.prefix ?? ""}${a.from}–${a.prefix ?? ""}${a.to}`,
  create_rate: (a) => `Create rate ${a.rate_code}`,
  create_guarantee_options: (a) => `Create ${a.options?.length ?? 0} guarantee options`,
  create_source_of_business: (a) => `Create ${a.sources?.length ?? 0} sources of business`,
  enable_booking_engine: (a) => `Enable booking engine${a.slug ? ` at /b/${a.slug}` : ""}`,
  
  create_pos_outlet: (a) => `Create POS outlet "${a.name}"`,
  create_custom_role: (a) => `Create ${a.roles?.length ?? 0} custom role(s)`,
  mark_step_done: (a) => `Mark step "${a.step}" complete`,
};

const MODE_THEME = {
  operate: {
    label: "TrailGuide",
    tagline: "Ask, report, act.",
    Icon: Compass,
    accent: "text-primary",
    accentBg: "bg-primary/10",
    ring: "border-primary/40 bg-primary/5",
    placeholder: "Ask about reports, guests, sites…",
  },
  setup: {
    label: "TrailGuide · Setup Guide",
    tagline: "Let's configure your park.",
    Icon: Flag,
    accent: "text-amber-600 dark:text-amber-400",
    accentBg: "bg-amber-500/10",
    ring: "border-amber-500/40 bg-amber-500/5",
    placeholder: "Tell me about your campground…",
  },
} satisfies Record<Mode, any>;

const OPERATE_SUGGESTIONS = [
  "What's today's occupancy and arrivals?",
  "Show open work orders in plumbing",
  "Find reservations for Smith",
  "How do I post a manual charge?",
  "Revenue last 7 days",
];

const SETUP_SUGGESTIONS = [
  "Propose a standard Chart of Accounts",
  "Set up sales tax at 7.5% and 3% lodging tax",
  "Create site types: Back-in 30A, Pull-thru 50A, Tent",
  "Bulk create sites A001–A020 as Back-in 30A",
  "Turn on the booking engine with slug 'trailblazer-rv'",
];

interface ConversationProps {
  mode: Mode;
  onModeChange?: (m: Mode) => void;
  hideModeToggle?: boolean;
  setupStep?: string;
  onSetupStepComplete?: (step: string) => void;
  onClose?: () => void;
  className?: string;
}

export function TrailGuideConversation({
  mode,
  onModeChange,
  hideModeToggle,
  setupStep,
  onSetupStepComplete,
  onClose,
  className,
}: ConversationProps) {
  const { selectedProperty } = useProperty();
  const { auditDate } = useAuditDate();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<ProposedAction[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const theme = MODE_THEME[mode];
  const suggestions = mode === "setup" ? SETUP_SUGGESTIONS : OPERATE_SUGGESTIONS;

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [mode]);

  // Reset conversation when mode or setup step changes
  useEffect(() => {
    setMessages([]);
    setPending([]);
  }, [mode, setupStep]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, isThinking]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || !selectedProperty) return;
    const nextMessages: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setPending([]);
    setIsThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke("trailguide-chat", {
        body: {
          messages: nextMessages,
          propertyId: selectedProperty.id,
          auditDate: auditDate || undefined,
          kb: KB_FLAT,
          mode,
          setupStep,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setMessages([...nextMessages, { role: "assistant", content: (data as any).reply || "" }]);
      setPending(((data as any).proposed_actions ?? []) as ProposedAction[]);
    } catch (e: any) {
      toast.error(e?.message || "TrailGuide error");
      setMessages([...nextMessages, { role: "assistant", content: "_Sorry — I hit an error handling that._" }]);
    } finally {
      setIsThinking(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [messages, selectedProperty, auditDate, mode, setupStep]);

  const confirmAction = useCallback(async (action: ProposedAction) => {
    if (!selectedProperty) return;
    setPending((p) => p.filter((x) => x.id !== action.id));
    try {
      const { data, error } = await supabase.functions.invoke("trailguide-action", {
        body: { propertyId: selectedProperty.id, tool: action.tool, args: action.args },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const msg = (data as any)?.message || "Done.";
      toast.success(msg);
      setMessages((m) => [...m, { role: "assistant", content: `✅ ${msg}` }]);
      if (action.tool === "mark_step_done" && action.args?.step && onSetupStepComplete) {
        onSetupStepComplete(action.args.step);
      }
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
      setMessages((m) => [...m, { role: "assistant", content: `❌ Action failed: ${e?.message || "unknown error"}` }]);
    }
  }, [selectedProperty, onSetupStepComplete]);

  const cancelAction = (id: string) => setPending((p) => p.filter((x) => x.id !== id));

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1500) {
          toast.error("Recording too short");
          setIsTranscribing(false);
          return;
        }
        setIsTranscribing(true);
        try {
          const ext = mime.includes("mp4") ? "mp4" : "webm";
          const form = new FormData();
          form.append("file", blob, `recording.${ext}`);
          const { data, error } = await supabase.functions.invoke("trailguide-transcribe", { body: form });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);
          const text = ((data as any).text || "").trim();
          if (text) {
            setInput((prev) => (prev ? `${prev} ${text}` : text));
            setTimeout(() => textareaRef.current?.focus(), 50);
          } else {
            toast.error("Didn't catch that");
          }
        } catch (e: any) {
          toast.error(e?.message || "Transcription failed");
        } finally {
          setIsTranscribing(false);
        }
      };
      rec.start();
      mediaRef.current = rec;
      setIsRecording(true);
    } catch {
      toast.error("Microphone access needed");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setIsRecording(false);
  };

  const Icon = theme.Icon;

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      <div className="p-4 border-b flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", theme.accentBg)}>
            <Icon className={cn("h-4 w-4", theme.accent)} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">{theme.label}</div>
            <p className="text-xs text-muted-foreground truncate">{theme.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!hideModeToggle && onModeChange && (
            <div className="flex rounded-md border p-0.5 text-xs">
              <button
                onClick={() => onModeChange("operate")}
                className={cn("px-2 py-1 rounded", mode === "operate" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Operate
              </button>
              <button
                onClick={() => onModeChange("setup")}
                className={cn("px-2 py-1 rounded", mode === "setup" ? "bg-amber-500 text-white" : "text-muted-foreground hover:text-foreground")}
              >
                Set up
              </button>
            </div>
          )}
          {onClose && (
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef as any}>
        <div className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground space-y-3">
              <p>
                {mode === "setup"
                  ? "I'll help you configure your park step by step. Approve each proposal before it writes anything."
                  : "Hi — I'm TrailGuide. Ask me anything about the park:"}
              </p>
              <div className="grid gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-sm px-3 py-2 rounded-md border hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:mt-2 prose-headings:mb-1 prose-ul:my-1">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : m.content}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
            </div>
          )}

          {pending.map((action) => (
            <Card key={action.id} className={cn("p-3", theme.ring)}>
              <div className="flex items-start gap-2 mb-2">
                <ShieldCheck className={cn("h-4 w-4 mt-0.5", theme.accent)} />
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className="text-[10px] mb-1">Confirm to run</Badge>
                  <p className="text-sm font-medium">
                    {ACTION_LABELS[action.tool]?.(action.args) || action.tool}
                  </p>
                  <details className="mt-1">
                    <summary className="text-xs text-muted-foreground cursor-pointer">Details</summary>
                    <pre className="text-xs mt-1 whitespace-pre-wrap break-all">{JSON.stringify(action.args, null, 2)}</pre>
                  </details>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => confirmAction(action)}>Confirm</Button>
                <Button size="sm" variant="ghost" onClick={() => cancelAction(action.id)}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-3 space-y-2">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={isRecording ? "Recording..." : isTranscribing ? "Transcribing..." : theme.placeholder}
            disabled={isThinking || isRecording || isTranscribing}
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
          />
          <Button
            type="button"
            size="icon"
            variant={isRecording ? "destructive" : "outline"}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isThinking || isTranscribing}
            aria-label={isRecording ? "Stop recording" : "Record"}
          >
            {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> :
             isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={() => send(input)}
            disabled={!input.trim() || isThinking || isRecording}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          TrailGuide always asks before changing data.
        </p>
      </div>
    </div>
  );
}

export function TrailGuidePanel({
  open,
  onOpenChange,
  defaultMode = "operate",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  useEffect(() => { if (open) setMode(defaultMode); }, [open, defaultMode]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0 [&>button.absolute]:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>TrailGuide</SheetTitle>
        </SheetHeader>
        <TrailGuideConversation mode={mode} onModeChange={setMode} onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function TrailGuideLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 sm:right-5 z-40 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center group"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        aria-label="Open TrailGuide AI"
      >
        <Compass className="h-5 w-5 sm:h-6 sm:w-6 group-hover:rotate-12 transition-transform" />
        <span className="sr-only">TrailGuide</span>
      </button>
      <TrailGuidePanel open={open} onOpenChange={setOpen} />
    </>
  );
}
