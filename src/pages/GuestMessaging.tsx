import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Mail,
  Phone,
  Send,
  Sparkles,
  Check,
  X as XIcon,
  User,
  Settings as SettingsIcon,
  Facebook,
  Instagram,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type ThreadRow = {
  id: string;
  property_id: string;
  channel: string;
  guest_id: string | null;
  reservation_id: string | null;
  external_participant: string;
  display_name: string | null;
  subject: string | null;
  status: string;
  category: string | null;
  assigned_to_user_id: string | null;
  assigned_role: string | null;
  ai_mode: string;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  direction: "in" | "out";
  sender_type: "guest" | "staff" | "ai" | "system";
  body: string;
  ai_generated: boolean;
  created_at: string;
};

type ActionRow = {
  id: string;
  thread_id: string;
  message_id: string | null;
  action_type: string;
  action_summary: string;
  action_payload: any;
  proposed_reply: string | null;
  status: string;
  created_at: string;
};

type GuestRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  likes_dislikes: string | null;
};

type ReservationRow = {
  id: string;
  confirmation_number: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  site_id: string | null;
};

const CHANNEL_ICON: Record<string, any> = {
  sms: Phone,
  email: Mail,
  facebook: Facebook,
  instagram: Instagram,
};

const CATEGORY_TONE: Record<string, string> = {
  service: "bg-blue-500/10 text-blue-600",
  maintenance: "bg-orange-500/10 text-orange-600",
  billing: "bg-purple-500/10 text-purple-600",
  reservations: "bg-emerald-500/10 text-emerald-600",
  info: "bg-slate-500/10 text-slate-600",
  other: "bg-slate-500/10 text-slate-600",
};

export default function GuestMessaging() {
  const { selectedProperty } = useProperty();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeThreadId = searchParams.get("thread");

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [guest, setGuest] = useState<GuestRow | null>(null);
  const [reservation, setReservation] = useState<ReservationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"all" | "unassigned" | "awaiting" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [draftingAi, setDraftingAi] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  // Load threads
  useEffect(() => {
    if (!selectedProperty?.id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("messaging_threads")
        .select("*")
        .eq("property_id", selectedProperty.id)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (!mounted) return;
      if (error) {
        console.error(error);
        toast.error("Failed to load conversations");
      } else {
        setThreads((data || []) as ThreadRow[]);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [selectedProperty?.id]);

  // Realtime threads
  useEffect(() => {
    if (!selectedProperty?.id) return;
    const channel = supabase
      .channel(`msg-threads-${selectedProperty.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messaging_threads", filter: `property_id=eq.${selectedProperty.id}` },
        (payload) => {
          setThreads((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as ThreadRow, ...prev.filter((t) => t.id !== (payload.new as any).id)];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((t) => (t.id === (payload.new as any).id ? (payload.new as ThreadRow) : t));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((t) => t.id !== (payload.old as any).id);
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProperty?.id]);

  // Load thread detail
  useEffect(() => {
    if (!activeThreadId || !selectedProperty?.id) {
      setMessages([]);
      setActions([]);
      setGuest(null);
      setReservation(null);
      return;
    }
    let mounted = true;
    (async () => {
      const [msgRes, actRes] = await Promise.all([
        supabase
          .from("messaging_messages")
          .select("*")
          .eq("thread_id", activeThreadId)
          .order("created_at", { ascending: true }),
        supabase
          .from("messaging_ai_actions")
          .select("*")
          .eq("thread_id", activeThreadId)
          .order("created_at", { ascending: true }),
      ]);
      if (!mounted) return;
      setMessages((msgRes.data || []) as MessageRow[]);
      setActions((actRes.data || []) as ActionRow[]);

      const th = threads.find((t) => t.id === activeThreadId);
      if (th?.guest_id) {
        const { data } = await supabase.from("guests").select("*").eq("id", th.guest_id).maybeSingle();
        if (mounted) setGuest((data as GuestRow) || null);
      } else {
        setGuest(null);
      }
      if (th?.reservation_id) {
        const { data } = await supabase
          .from("reservations")
          .select("id, confirmation_number, check_in_date, check_out_date, status, site_id")
          .eq("id", th.reservation_id)
          .maybeSingle();
        if (mounted) setReservation((data as ReservationRow) || null);
      } else {
        setReservation(null);
      }

      // Mark read
      if (th && th.unread_count > 0) {
        await supabase.from("messaging_threads").update({ unread_count: 0 }).eq("id", activeThreadId);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeThreadId, selectedProperty?.id, threads.length]);

  // Realtime messages + actions for active thread
  useEffect(() => {
    if (!activeThreadId) return;
    const channel = supabase
      .channel(`msg-thread-${activeThreadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messaging_messages", filter: `thread_id=eq.${activeThreadId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as MessageRow])
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messaging_ai_actions", filter: `thread_id=eq.${activeThreadId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setActions((prev) => [...prev, payload.new as ActionRow]);
          } else if (payload.eventType === "UPDATE") {
            setActions((prev) => prev.map((a) => (a.id === (payload.new as any).id ? (payload.new as ActionRow) : a)));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, actions.length]);

  const filteredThreads = useMemo(() => {
    let list = threads;
    if (view === "unassigned") list = list.filter((t) => !t.assigned_to_user_id && t.status === "open");
    if (view === "awaiting") list = list.filter((t) => t.status === "pending_staff");
    if (view === "resolved") list = list.filter((t) => t.status === "resolved");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.display_name || "").toLowerCase().includes(q) ||
          (t.external_participant || "").toLowerCase().includes(q) ||
          (t.last_message_preview || "").toLowerCase().includes(q) ||
          (t.subject || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [threads, view, search]);

  const openThread = (id: string) => {
    setSearchParams({ thread: id });
  };

  const send = async () => {
    if (!activeThread || !composer.trim()) return;
    setSending(true);
    const body = composer.trim();
    setComposer("");
    try {
      const { error } = await supabase.functions.invoke("messaging-send", {
        body: { thread_id: activeThread.id, body, sender_type: "staff" },
      });
      if (error) throw error;
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to send message");
      setComposer(body);
    } finally {
      setSending(false);
    }
  };

  const draftWithAi = async () => {
    if (!activeThread) return;
    setDraftingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("messaging-ai-agent", {
        body: { thread_id: activeThread.id, mode: "draft_only" },
      });
      if (error) throw error;
      if (data?.draft) setComposer(data.draft);
      else toast.info("AI did not return a draft");
    } catch (e: any) {
      console.error(e);
      toast.error("AI draft failed");
    } finally {
      setDraftingAi(false);
    }
  };

  const decideAction = async (actionId: string, decision: "approve" | "reject") => {
    try {
      const { error } = await supabase.functions.invoke("messaging-execute-action", {
        body: { action_id: actionId, decision },
      });
      if (error) throw error;
      toast.success(decision === "approve" ? "Action approved" : "Action rejected");
    } catch (e: any) {
      console.error(e);
      toast.error("Action failed");
    }
  };

  const resolveThread = async () => {
    if (!activeThread) return;
    await supabase.from("messaging_threads").update({ status: "resolved" }).eq("id", activeThread.id);
    toast.success("Marked resolved");
  };

  const timeline = useMemo(() => {
    const items: Array<{ kind: "msg"; data: MessageRow } | { kind: "action"; data: ActionRow }> = [];
    for (const m of messages) items.push({ kind: "msg", data: m });
    for (const a of actions) items.push({ kind: "action", data: a });
    items.sort((x, y) => new Date(x.data.created_at).getTime() - new Date(y.data.created_at).getTime());
    return items;
  }, [messages, actions]);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" /> Guest Messaging
            </h1>
            <p className="text-sm text-muted-foreground">
              Unified inbox with an AI concierge that drafts replies and proposes actions for your approval.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings/messaging">
              <SettingsIcon className="h-4 w-4 mr-2" /> Settings
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-3 min-h-0 flex-1">
          {/* THREAD LIST */}
          <Card className="flex flex-col min-h-0">
            <div className="p-3 border-b space-y-2">
              <Input
                placeholder="Search conversations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Tabs value={view} onValueChange={(v) => setView(v as any)}>
                <TabsList className="grid grid-cols-4 w-full h-8">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="unassigned" className="text-xs">New</TabsTrigger>
                  <TabsTrigger value="awaiting" className="text-xs">Staff</TabsTrigger>
                  <TabsTrigger value="resolved" className="text-xs">Done</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading…</div>
              ) : filteredThreads.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No conversations yet. Once channels are configured and guests reach out, threads will appear here.
                </div>
              ) : (
                <div>
                  {filteredThreads.map((t) => {
                    const Icon = CHANNEL_ICON[t.channel] || MessageSquare;
                    const active = t.id === activeThreadId;
                    return (
                      <button
                        key={t.id}
                        onClick={() => openThread(t.id)}
                        className={`w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition-colors ${
                          active ? "bg-muted" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium text-sm truncate flex-1">
                            {t.display_name || t.external_participant}
                          </span>
                          {t.unread_count > 0 && (
                            <Badge variant="default" className="h-5 px-1.5 text-xs">{t.unread_count}</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.last_message_preview || "No messages yet"}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {t.category && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_TONE[t.category] || CATEGORY_TONE.other}`}>
                              {t.category}
                            </span>
                          )}
                          {t.status !== "open" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted-foreground/10 text-muted-foreground">
                              {t.status.replace("_", " ")}
                            </span>
                          )}
                          {t.last_message_at && (
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </Card>

          {/* THREAD DETAIL */}
          <Card className="flex flex-col min-h-0">
            {!activeThread ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
                Select a conversation to view messages.
              </div>
            ) : (
              <>
                <div className="p-3 border-b flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {activeThread.display_name || activeThread.external_participant}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {activeThread.channel.toUpperCase()} · {activeThread.external_participant}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {activeThread.status !== "resolved" && (
                      <Button size="sm" variant="outline" onClick={resolveThread}>
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {timeline.map((item) => {
                      if (item.kind === "msg") {
                        const m = item.data;
                        const isOut = m.direction === "out";
                        return (
                          <div key={m.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                                isOut
                                  ? m.sender_type === "ai"
                                    ? "bg-primary/10 border border-primary/20"
                                    : "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              {m.sender_type === "ai" && (
                                <div className="text-[10px] uppercase font-semibold flex items-center gap-1 mb-0.5 opacity-70">
                                  <Sparkles className="h-3 w-3" /> AI
                                </div>
                              )}
                              <div className="whitespace-pre-wrap">{m.body}</div>
                              <div className="text-[10px] mt-1 opacity-60">
                                {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      const a = item.data;
                      const pending = a.status === "pending";
                      return (
                        <div key={a.id} className="flex justify-center">
                          <div className="w-full max-w-[95%] border rounded-lg p-3 bg-accent/30">
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles className="h-4 w-4 text-primary" />
                              <span className="text-xs font-semibold uppercase tracking-wide">
                                AI proposes: {a.action_type.replace(/_/g, " ")}
                              </span>
                              <Badge variant={pending ? "default" : a.status === "executed" || a.status === "approved" ? "secondary" : "outline"} className="ml-auto text-[10px]">
                                {a.status}
                              </Badge>
                            </div>
                            <div className="text-sm mb-2">{a.action_summary}</div>
                            {a.proposed_reply && (
                              <div className="text-xs bg-background rounded p-2 border mb-2 whitespace-pre-wrap">
                                <span className="font-semibold">Draft reply: </span>
                                {a.proposed_reply}
                              </div>
                            )}
                            {pending && (
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => decideAction(a.id, "approve")}>
                                  <Check className="h-3 w-3 mr-1" /> Approve & Send
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => decideAction(a.id, "reject")}>
                                  <XIcon className="h-3 w-3 mr-1" /> Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="p-3 border-t space-y-2">
                  <Textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder="Type a reply…"
                    className="min-h-[70px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={draftWithAi} disabled={draftingAi}>
                      <Sparkles className="h-4 w-4 mr-1" /> {draftingAi ? "Drafting…" : "Ask AI to draft"}
                    </Button>
                    <div className="ml-auto text-xs text-muted-foreground">⌘/Ctrl+Enter to send</div>
                    <Button onClick={send} disabled={sending || !composer.trim()}>
                      <Send className="h-4 w-4 mr-1" /> Send
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* CONTEXT */}
          <Card className="flex flex-col min-h-0 hidden lg:flex">
            <div className="p-3 border-b font-medium flex items-center gap-2">
              <User className="h-4 w-4" /> Guest Context
            </div>
            <ScrollArea className="flex-1">
              {!activeThread ? (
                <div className="p-4 text-sm text-muted-foreground">Select a conversation.</div>
              ) : (
                <div className="p-4 space-y-4 text-sm">
                  {guest ? (
                    <div>
                      <div className="font-semibold text-base">
                        {guest.first_name} {guest.last_name}
                      </div>
                      <div className="text-muted-foreground space-y-0.5 mt-1">
                        {guest.email && <div className="truncate">{guest.email}</div>}
                        {guest.phone && <div>{guest.phone}</div>}
                      </div>
                      <Button asChild variant="link" size="sm" className="px-0 h-auto mt-1">
                        <Link to={`/guests/${guest.id}`}>View full profile →</Link>
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div className="font-medium">Unknown guest</div>
                      <div className="text-xs text-muted-foreground">
                        Contact not matched to a profile. {activeThread.external_participant}
                      </div>
                    </div>
                  )}
                  <Separator />
                  {reservation ? (
                    <div>
                      <div className="font-semibold">Current Reservation</div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <div>Conf: {reservation.confirmation_number}</div>
                        <div>
                          {reservation.check_in_date} → {reservation.check_out_date}
                        </div>
                        <div>Status: {reservation.status}</div>
                      </div>
                      <Button asChild variant="link" size="sm" className="px-0 h-auto mt-1">
                        <Link to={`/reservation/edit?id=${reservation.id}`}>Open reservation →</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No linked reservation.</div>
                  )}
                  {guest?.likes_dislikes && (
                    <>
                      <Separator />
                      <div>
                        <div className="font-semibold text-xs mb-1">Notes / Likes</div>
                        <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {guest.likes_dislikes}
                        </div>
                      </div>
                    </>
                  )}
                  <Separator />
                  <div>
                    <div className="font-semibold text-xs mb-1">AI Mode</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {activeThread.ai_mode.replace("_", " ")}
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
