import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Link2, RefreshCw, Unlink, AlertCircle, Loader2, ExternalLink } from "lucide-react";

interface Props {
  propertyId: string;
}

interface Integration {
  id: string;
  environment: "sandbox" | "production";
  realm_id: string | null;
  company_name: string | null;
  is_active: boolean;
  connected_at: string | null;
  last_sync_at: string | null;
  token_expires_at: string | null;
  sync_frequency: "manual" | "on_dayend" | "daily" | "weekly";
}

interface SyncLogEntry {
  id: string;
  sync_type: string;
  status: string;
  external_ref: string | null;
  error_message: string | null;
  synced_at: string;
}


interface Account {
  id: string;
  code: string;
  name: string;
  qb_account_id: string | null;
  qb_account_name: string | null;
  account_type: string;
  group_name: string;
}

interface QbAccount {
  id: string;
  name: string;
  type: string;
  sub_type: string;
  classification: string;
}

export function QuickBooksIntegration({ propertyId }: Props) {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [autoPost, setAutoPost] = useState(false);
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [syncFrequency, setSyncFrequency] = useState<"manual" | "on_dayend" | "daily" | "weekly">("manual");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [qbAccounts, setQbAccounts] = useState<QbAccount[]>([]);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);

  useEffect(() => {
    if (propertyId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);


  async function load() {
    setLoading(true);
    try {
      const [{ data: intg }, { data: prop }, { data: accs }, { data: logs }] = await Promise.all([
        supabase
          .from("accounting_integrations")
          .select("id, environment, realm_id, company_name, is_active, connected_at, last_sync_at, token_expires_at, sync_frequency")
          .eq("property_id", propertyId)
          .eq("provider", "quickbooks")
          .maybeSingle(),
        supabase.from("properties").select("auto_post_to_quickbooks").eq("id", propertyId).maybeSingle(),
        supabase
          .from("accounts")
          .select(`
            id, code, name, qb_account_id, qb_account_name,
            account_groups!inner(name, account_type)
          `)
          .eq("property_id", propertyId)
          .eq("is_active", true)
          .order("code"),
        supabase
          .from("accounting_sync_log")
          .select("id, sync_type, status, external_ref, error_message, synced_at")
          .eq("property_id", propertyId)
          .eq("provider", "quickbooks")
          .order("synced_at", { ascending: false })
          .limit(10),
      ]);

      setIntegration((intg as Integration | null) ?? null);
      setEnvironment(((intg?.environment as "sandbox" | "production") ?? "sandbox"));
      setSyncFrequency(((intg as any)?.sync_frequency as any) ?? "manual");
      setAutoPost(!!prop?.auto_post_to_quickbooks);
      setSyncLog((logs as SyncLogEntry[] | null) ?? []);
      // deno-lint-ignore no-explicit-any
      setAccounts(((accs ?? []) as any[]).map((a: any) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        qb_account_id: a.qb_account_id,
        qb_account_name: a.qb_account_name,
        account_type: a.account_groups.account_type,
        group_name: a.account_groups.name,
      })));

      if (intg?.is_active) {
        await fetchQbAccounts(false);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load QuickBooks integration");
    } finally {
      setLoading(false);
    }
  }


  async function fetchQbAccounts(showToast = true) {
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-sync", {
        body: { action: "fetch_accounts", property_id: propertyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setQbAccounts(data.accounts ?? []);
      if (showToast) toast.success(`Loaded ${data.accounts?.length ?? 0} QuickBooks accounts`);
    } catch (e) {
      console.error(e);
      if (showToast) toast.error(`Fetch failed: ${(e as Error).message}`);
    } finally {
      setFetching(false);
    }
  }

  async function connect() {
    setConnecting(true);
    try {
      const returnUrl = window.location.href;
      const { data, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: {},
        method: "POST" as never,
        // Use fetch-style call to hit the ?action=start GET path
      });
      // supabase.functions.invoke doesn't easily support GET+params, call directly
      void data; void error;

      const projectUrl = "https://xavsdfewzwdonndfcehh.supabase.co";
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(
        `${projectUrl}/functions/v1/quickbooks-oauth?action=start&property_id=${propertyId}&environment=${environment}&return_url=${encodeURIComponent(returnUrl)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const payload = await res.json();
      if (!res.ok || payload.error) throw new Error(payload.error ?? "Failed to start OAuth");
      window.open(payload.authorize_url, "quickbooks-oauth", "width=720,height=800");
      toast.info("Complete sign-in in the QuickBooks window, then refresh.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect this property from QuickBooks?")) return;
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-sync", {
        body: { action: "disconnect", property_id: propertyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Disconnected");
      setQbAccounts([]);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleAutoPost(next: boolean) {
    setAutoPost(next);
    const { error } = await supabase
      .from("properties")
      .update({ auto_post_to_quickbooks: next })
      .eq("id", propertyId);
    if (error) {
      toast.error("Failed to save setting");
      setAutoPost(!next);
    } else {
      toast.success(next ? "Auto-post enabled" : "Auto-post disabled");
    }
  }

  async function updateFrequency(next: "manual" | "on_dayend" | "daily" | "weekly") {
    const prev = syncFrequency;
    setSyncFrequency(next);
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-sync", {
        body: { action: "set_frequency", property_id: propertyId, sync_frequency: next },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Sync frequency updated");
    } catch (e) {
      setSyncFrequency(prev);
      toast.error(`Failed to update frequency: ${(e as Error).message}`);
    }
  }

  async function syncNow() {
    setSyncingNow(true);
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-sync", {
        body: { action: "list_pending_closes", property_id: propertyId, lookback_days: 30 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const pending: { id: string; close_date: string }[] = data?.pending ?? [];
      if (!pending.length) {
        toast.info("No pending day-end closes to sync");
        await load();
        return;
      }
      let success = 0;
      let failed = 0;
      for (const c of pending) {
        const { data: res, error: postErr } = await supabase.functions.invoke("quickbooks-sync", {
          body: { action: "post_dayend", property_id: propertyId, dayend_close_id: c.id },
        });
        if (postErr || res?.error) {
          failed++;
        } else {
          success++;
        }
      }
      if (failed === 0) {
        toast.success(`Synced ${success} day-end close(s) to QuickBooks`);
      } else {
        toast.warning(`Synced ${success}, ${failed} failed — see sync log`);
      }
      await load();
    } catch (e) {
      toast.error(`Sync failed: ${(e as Error).message}`);
    } finally {
      setSyncingNow(false);
    }
  }


  async function saveMapping(accountId: string, qbId: string) {
    setSavingId(accountId);
    try {
      const qb = qbAccounts.find((q) => q.id === qbId);
      const { error } = await supabase
        .from("accounts")
        .update({
          qb_account_id: qbId || null,
          qb_account_name: qb?.name ?? null,
        })
        .eq("id", accountId);
      if (error) throw error;
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, qb_account_id: qbId || null, qb_account_name: qb?.name ?? null } : a)),
      );
    } catch (e) {
      toast.error("Failed to save mapping");
    } finally {
      setSavingId(null);
    }
  }

  async function autoMap() {
    if (!qbAccounts.length) {
      toast.error("Fetch QuickBooks accounts first");
      return;
    }
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    let matched = 0;
    for (const acc of accounts) {
      if (acc.qb_account_id) continue;
      const target = norm(acc.name);
      const hit = qbAccounts.find((q) => norm(q.name) === target)
        ?? qbAccounts.find((q) => norm(q.name).includes(target) || target.includes(norm(q.name)));
      if (hit) {
        await saveMapping(acc.id, hit.id);
        matched++;
      }
    }
    toast.success(`Auto-mapped ${matched} account(s)`);
  }

  const filtered = useMemo(
    () => (showUnmappedOnly ? accounts.filter((a) => !a.qb_account_id) : accounts),
    [accounts, showUnmappedOnly],
  );
  const mappedCount = accounts.filter((a) => a.qb_account_id).length;

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading QuickBooks integration...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Connection status */}
      <div className="p-4 rounded-lg border bg-muted/30">
        {integration?.is_active ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="font-semibold flex items-center gap-2">
                  Connected to {integration.company_name ?? "QuickBooks"}
                  <Badge variant={integration.environment === "production" ? "default" : "secondary"}>
                    {integration.environment}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Realm {integration.realm_id}
                  {integration.last_sync_at && ` · Last sync ${new Date(integration.last_sync_at).toLocaleString()}`}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchQbAccounts()} disabled={fetching}>
                {fetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Refresh QB Accounts
              </Button>
              <Button variant="outline" size="sm" onClick={disconnect}>
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="font-semibold">Not connected to QuickBooks Online</div>
                <div className="text-xs text-muted-foreground">
                  Connect to sync Day-End Close journal entries into your GL.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={environment} onValueChange={(v) => setEnvironment(v as "sandbox" | "production")}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={connect} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                Connect QuickBooks
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Auto-post toggle */}
      {integration?.is_active && (
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div>
            <Label htmlFor="auto-post" className="text-sm font-medium">
              Automatically post Day-End Close to QuickBooks
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              When enabled, a summary journal entry is pushed each time a Day-End Close completes.
              Manual "Post" is always available from the Day-End Close page.
            </p>
          </div>
          <Switch id="auto-post" checked={autoPost} onCheckedChange={toggleAutoPost} />
        </div>
      )}

      {/* Sync frequency + manual sync */}
      {integration?.is_active && (
        <div className="p-4 rounded-lg border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Sync frequency</div>
              <p className="text-xs text-muted-foreground mt-1">
                How often financial data is pushed to QuickBooks Online.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={syncFrequency} onValueChange={(v) => updateFrequency(v as any)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual only</SelectItem>
                  <SelectItem value="on_dayend">On each Day-End Close</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={syncNow} disabled={syncingNow}>
                {syncingNow ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
            </div>
          </div>

          {syncLog.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Recent sync activity</div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference / Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLog.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(l.synced_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs capitalize">{l.sync_type.replace(/_/g, " ")}</TableCell>
                        <TableCell>
                          {l.status === "success" ? (
                            <Badge className="bg-emerald-600">Success</Badge>
                          ) : l.status === "failed" ? (
                            <Badge variant="destructive">Failed</Badge>
                          ) : (
                            <Badge variant="outline">{l.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                          {l.error_message || (l.external_ref ? `JE #${l.external_ref}` : "—")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}



      {/* Account mapping */}
      {integration?.is_active && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">Chart of Accounts Mapping</h3>
              <Badge variant={mappedCount === accounts.length ? "default" : "outline"}>
                {mappedCount}/{accounts.length} mapped
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-2">
                <Switch id="unmapped-qb" checked={showUnmappedOnly} onCheckedChange={setShowUnmappedOnly} />
                <Label htmlFor="unmapped-qb" className="text-sm">Unmapped only</Label>
              </div>
              <Button variant="outline" size="sm" onClick={autoMap} disabled={!qbAccounts.length}>
                Auto-map by name
              </Button>
            </div>
          </div>

          {qbAccounts.length === 0 ? (
            <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950/20 text-sm">
              No QuickBooks accounts loaded. Click <strong>Refresh QB Accounts</strong> above.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Code</TableHead>
                    <TableHead>Internal Account</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead>QuickBooks Account</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-mono text-xs">{acc.code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{acc.name}</div>
                        <div className="text-xs text-muted-foreground">{acc.group_name}</div>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{acc.account_type}</TableCell>
                      <TableCell>
                        <Select
                          value={acc.qb_account_id ?? "__none__"}
                          onValueChange={(v) => saveMapping(acc.id, v === "__none__" ? "" : v)}
                          disabled={savingId === acc.id}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Not mapped" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="__none__">— Not mapped —</SelectItem>
                            {qbAccounts.map((q) => (
                              <SelectItem key={q.id} value={q.id}>
                                {q.name}
                                <span className="text-muted-foreground text-xs ml-2">({q.type})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {acc.qb_account_id ? (
                          <Badge variant="default" className="bg-emerald-600">
                            <Check className="h-3 w-3 mr-1" /> Mapped
                          </Badge>
                        ) : (
                          <Badge variant="outline">Unmapped</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {!integration?.is_active && (
        <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20 text-sm space-y-1">
          <p className="font-medium text-blue-900 dark:text-blue-100">Setup checklist</p>
          <ol className="list-decimal ml-5 text-blue-800 dark:text-blue-200 space-y-1">
            <li>Create an app at <a className="underline" href="https://developer.intuit.com/app/developer/dashboard" target="_blank" rel="noreferrer">developer.intuit.com <ExternalLink className="inline h-3 w-3" /></a>.</li>
            <li>Add this redirect URI to your app: <code className="bg-background px-1 rounded text-xs">https://xavsdfewzwdonndfcehh.supabase.co/functions/v1/quickbooks-oauth</code></li>
            <li>Copy the Client ID and Client Secret into project secrets (<code>QUICKBOOKS_CLIENT_ID</code>, <code>QUICKBOOKS_CLIENT_SECRET</code>).</li>
            <li>Click <strong>Connect QuickBooks</strong> and authorize.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
