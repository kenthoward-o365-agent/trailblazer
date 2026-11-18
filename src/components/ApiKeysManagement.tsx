import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Key, Plus, Trash2, Copy, Check, Clock, AlertCircle, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

interface ApiKey {
  id: string;
  key_name: string;
  key_prefix: string;
  key_type: "live" | "test";
  scopes: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

interface ApiLog {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  ip_address: string | null;
  error_message: string | null;
  created_at: string;
}

const AVAILABLE_SCOPES = [
  { id: "availability:read", label: "Availability", description: "Read availability data" },
  { id: "rates:read", label: "Rates", description: "Read rates and pricing" },
  { id: "reservations:read", label: "Reservations (Read)", description: "Read reservations" },
  { id: "reservations:write", label: "Reservations (Write)", description: "Create/update/cancel reservations" },
  { id: "pos:read", label: "POS (Read)", description: "Look up rooms and F&B accounts" },
  { id: "pos:write", label: "POS (Write)", description: "Post charges to guest folios" },
  { id: "*", label: "Full Access", description: "All permissions (use with caution)" },
];

interface ApiKeysManagementProps {
  propertyId: string;
}

export function ApiKeysManagement({ propertyId }: ApiKeysManagementProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Create key dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyType, setNewKeyType] = useState<"live" | "test">("test");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(60);
  const [creating, setCreating] = useState(false);
  
  // Show generated key
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Revoke dialog
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, [propertyId]);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApiKeys((data || []) as ApiKey[]);
    } catch (error: any) {
      console.error("Error fetching API keys:", error);
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const fetchApiLogs = async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from("api_logs")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setApiLogs((data || []) as ApiLog[]);
    } catch (error: any) {
      console.error("Error fetching API logs:", error);
      toast.error("Failed to load API logs");
    } finally {
      setLogsLoading(false);
    }
  };

  const generateApiKey = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const prefix = newKeyType === "live" ? "rm_live_" : "rm_test_";
    let key = prefix;
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const hashKey = async (key: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a key name");
      return;
    }
    if (newKeyScopes.length === 0) {
      toast.error("Please select at least one scope");
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const plainKey = generateApiKey();
      const keyHash = await hashKey(plainKey);
      const keyPrefix = plainKey.substring(0, 8);

      const { error } = await supabase.from("api_keys").insert({
        property_id: propertyId,
        key_name: newKeyName.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        key_type: newKeyType,
        scopes: newKeyScopes,
        rate_limit_per_minute: newKeyRateLimit,
        created_by: user.id,
      });

      if (error) throw error;

      setGeneratedKey(plainKey);
      toast.success("API key created successfully");
      fetchApiKeys();
    } catch (error: any) {
      console.error("Error creating API key:", error);
      toast.error(error.message || "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!revokeKeyId) return;

    setRevoking(true);
    try {
      const { error } = await supabase
        .from("api_keys")
        .update({ 
          is_active: false, 
          revoked_at: new Date().toISOString() 
        })
        .eq("id", revokeKeyId);

      if (error) throw error;

      toast.success("API key revoked");
      setRevokeKeyId(null);
      fetchApiKeys();
    } catch (error: any) {
      console.error("Error revoking API key:", error);
      toast.error("Failed to revoke API key");
    } finally {
      setRevoking(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const resetCreateDialog = () => {
    setNewKeyName("");
    setNewKeyType("test");
    setNewKeyScopes([]);
    setNewKeyRateLimit(60);
    setGeneratedKey(null);
    setCopied(false);
  };

  const closeCreateDialog = () => {
    setShowCreateDialog(false);
    resetCreateDialog();
  };

  const toggleScope = (scopeId: string) => {
    if (scopeId === "*") {
      // If selecting wildcard, clear others
      setNewKeyScopes(newKeyScopes.includes("*") ? [] : ["*"]);
    } else {
      // If selecting specific scope, remove wildcard
      const filtered = newKeyScopes.filter(s => s !== "*");
      if (filtered.includes(scopeId)) {
        setNewKeyScopes(filtered.filter(s => s !== scopeId));
      } else {
        setNewKeyScopes([...filtered, scopeId]);
      }
    }
  };

  const getStatusBadge = (key: ApiKey) => {
    if (key.revoked_at) {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return <Badge variant="secondary">Expired</Badge>;
    }
    if (!key.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    return <Badge variant="default" className="bg-green-600">Active</Badge>;
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      POST: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      PATCH: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    };
    return <Badge className={colors[method] || "bg-gray-100 text-gray-800"}>{method}</Badge>;
  };

  const getStatusCodeBadge = (code: number) => {
    if (code >= 200 && code < 300) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">{code}</Badge>;
    }
    if (code >= 400 && code < 500) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">{code}</Badge>;
    }
    if (code >= 500) {
      return <Badge variant="destructive">{code}</Badge>;
    }
    return <Badge variant="secondary">{code}</Badge>;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">API Keys</h2>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      <Tabs defaultValue="keys" onValueChange={(v) => v === "logs" && fetchApiLogs()}>
        <TabsList className="mb-4">
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="logs">Usage Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="keys">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No API keys created yet</p>
              <p className="text-sm">Create an API key to enable third-party integrations</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.key_name}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-0.5 rounded">{key.key_prefix}...</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.key_type === "live" ? "default" : "secondary"}>
                        {key.key_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.includes("*") ? (
                          <Badge variant="outline">Full Access</Badge>
                        ) : (
                          key.scopes.slice(0, 2).map((scope) => (
                            <Badge key={scope} variant="outline" className="text-xs">
                              {scope.split(":")[0]}
                            </Badge>
                          ))
                        )}
                        {key.scopes.length > 2 && !key.scopes.includes("*") && (
                          <Badge variant="outline" className="text-xs">+{key.scopes.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(key)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.last_used_at ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}
                        </span>
                      ) : (
                        "Never"
                      )}
                    </TableCell>
                    <TableCell>
                      {key.is_active && !key.revoked_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevokeKeyId(key.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="logs">
          {logsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
          ) : apiLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No API requests recorded yet</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response Time</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                      </TableCell>
                      <TableCell>{getMethodBadge(log.method)}</TableCell>
                      <TableCell>
                        <code className="text-sm">{log.endpoint || "/"}</code>
                      </TableCell>
                      <TableCell>{getStatusCodeBadge(log.status_code)}</TableCell>
                      <TableCell className="text-sm">{log.response_time_ms}ms</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.ip_address || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && closeCreateDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {generatedKey ? "API Key Created" : "Create API Key"}
            </DialogTitle>
            <DialogDescription>
              {generatedKey 
                ? "Copy this key now. You won't be able to see it again." 
                : "Generate a new API key for third-party integrations"
              }
            </DialogDescription>
          </DialogHeader>

          {generatedKey ? (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm break-all font-mono">{generatedKey}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedKey)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>Store this key securely. For security reasons, we cannot show it again.</p>
              </div>
              <DialogFooter>
                <Button onClick={closeCreateDialog}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="keyName">Key Name</Label>
                <Input
                  id="keyName"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Booking.com Integration"
                />
              </div>

              <div>
                <Label>Key Type</Label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="keyType"
                      checked={newKeyType === "test"}
                      onChange={() => setNewKeyType("test")}
                      className="w-4 h-4"
                    />
                    <span>Test</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="keyType"
                      checked={newKeyType === "live"}
                      onChange={() => setNewKeyType("live")}
                      className="w-4 h-4"
                    />
                    <span>Live</span>
                  </label>
                </div>
              </div>

              <div>
                <Label>Permissions</Label>
                <div className="space-y-2 mt-2">
                  {AVAILABLE_SCOPES.map((scope) => (
                    <label
                      key={scope.id}
                      className="flex items-start gap-3 p-2 rounded border cursor-pointer hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={newKeyScopes.includes(scope.id)}
                        onCheckedChange={() => toggleScope(scope.id)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-medium text-sm">{scope.label}</div>
                        <div className="text-xs text-muted-foreground">{scope.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="rateLimit">Rate Limit (requests/minute)</Label>
                <Input
                  id="rateLimit"
                  type="number"
                  min={1}
                  max={1000}
                  value={newKeyRateLimit}
                  onChange={(e) => setNewKeyRateLimit(parseInt(e.target.value) || 60)}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeCreateDialog}>Cancel</Button>
                <Button onClick={handleCreateKey} disabled={creating}>
                  {creating ? "Creating..." : "Create Key"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!revokeKeyId} onOpenChange={(open) => !open && setRevokeKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Any integrations using this key will immediately stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeKey}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking ? "Revoking..." : "Revoke Key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
