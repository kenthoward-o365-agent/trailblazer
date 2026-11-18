import { useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { bookingApi } from "@/lib/bookingEngineApi";
import { Loader2, Search, Calendar, Users, DollarSign, AlertTriangle, CheckCircle2 } from "lucide-react";

type Ctx = { slug: string; data: any };

export default function BookingManage() {
  const { slug, data } = useOutletContext<Ctx>();
  const [params] = useSearchParams();
  const [conf, setConf] = useState(params.get("conf") ?? "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const primary = data.settings?.primary_color ?? "hsl(var(--primary))";

  async function lookup() {
    setLoading(true); setError(null); setRes(null); setCancelled(false); setConfirmCancel(false);
    try {
      const r = await bookingApi.lookup(slug, { confirmation_number: conf.trim(), email: email.trim() });
      setRes(r.reservation);
    } catch (e: any) {
      setError(e.message ?? "Booking not found");
    } finally { setLoading(false); }
  }

  async function doCancel() {
    setCancelling(true);
    try {
      await bookingApi.cancel(slug, { confirmation_number: conf.trim(), email: email.trim() });
      setCancelled(true); setConfirmCancel(false);
      setRes({ ...res, status: "cancelled" });
    } catch (e: any) { setError(e.message); }
    finally { setCancelling(false); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Manage your booking</CardTitle>
          <p className="text-sm text-muted-foreground">Enter your confirmation number and the email used at booking.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Confirmation #</Label><Input value={conf} onChange={(e) => setConf(e.target.value)} placeholder="TB-XXXXXX" /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          </div>
          <Button onClick={lookup} disabled={loading || !conf || !email} style={{ background: primary, color: "white" }}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Find booking
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {res && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">#{res.confirmation_number}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{res.first_name} {res.last_name}</p>
            </div>
            <Badge variant={res.status === "cancelled" ? "destructive" : "default"}>{res.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Arrive</div><div className="font-semibold">{res.check_in_date}</div></div>
              <div><div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Depart</div><div className="font-semibold">{res.check_out_date}</div></div>
              <div><div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Guests</div><div className="font-semibold">{res.guests_count}</div></div>
              <div><div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Total</div><div className="font-semibold">${Number(res.total_price).toFixed(2)}</div></div>
            </div>

            {cancelled && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Your booking has been cancelled. Refunds (if applicable) will follow the cancellation policy.
              </div>
            )}

            {res.status !== "cancelled" && !cancelled && (
              <div className="pt-2 border-t">
                {!confirmCancel ? (
                  <Button variant="outline" onClick={() => setConfirmCancel(true)} className="text-destructive">Cancel booking</Button>
                ) : (
                  <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                      <div>
                        <strong>Are you sure?</strong>
                        {data.settings?.cancellation_summary && <p className="text-muted-foreground mt-1">{data.settings.cancellation_summary}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={doCancel} disabled={cancelling}>
                        {cancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Yes, cancel
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Keep booking</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
