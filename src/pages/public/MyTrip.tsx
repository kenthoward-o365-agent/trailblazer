import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Loader2, LogOut, ClipboardCheck, AlertCircle } from "lucide-react";
import { bookingApi } from "@/lib/bookingEngineApi";
import { clearGuestSession, getGuestSession } from "@/lib/guestSession";

type Ctx = { slug: string; data: any };

export default function MyTrip() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useOutletContext<Ctx>();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const primary = data.settings?.primary_color ?? "hsl(var(--primary))";

  useEffect(() => {
    const s = getGuestSession(slug!);
    if (!s) {
      navigate(`/b/${slug}/login`, { replace: true });
      return;
    }
    bookingApi
      .myReservations(slug!, s.token)
      .then((r) => setReservations(r.reservations ?? []))
      .catch((e) => {
        if (String(e.message).includes("session_expired") || String(e.message).includes("unauthorized")) {
          clearGuestSession(slug!);
          navigate(`/b/${slug}/login`, { replace: true });
        } else setError(e.message);
      });
  }, [slug, navigate]);

  function signOut() {
    clearGuestSession(slug!);
    navigate(`/b/${slug}/login`, { replace: true });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your trips</h1>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-1" /> Sign out
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!reservations ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your reservations…
        </div>
      ) : reservations.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No upcoming reservations on file.
          </CardContent>
        </Card>
      ) : (
        reservations.map((r) => {
          const isArrivalDay = r.check_in_date <= today && r.status === "CONFIRMED";
          const isHold = r.status === "CHECK_IN_HOLD";
          const isCheckedIn = r.status === "CHECKED_IN";
          return (
            <Card key={r.id}>
              <CardHeader className="flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">
                    #{r.confirmation_number}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.site_types?.name ?? "Site"}{r.sites?.site_number ? ` · Site ${r.sites.site_number}` : ""}
                  </p>
                </div>
                <Badge variant={isCheckedIn ? "default" : isHold ? "secondary" : "outline"}>
                  {r.status.replace(/_/g, " ")}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Arrive
                    </div>
                    <div className="font-semibold">{r.check_in_date}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Depart
                    </div>
                    <div className="font-semibold">{r.check_out_date}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-semibold">${Number(r.total_price).toFixed(2)}</div>
                  </div>
                </div>

                {isHold && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div>
                      <div className="font-medium">You're checked in on hold</div>
                      <div className="text-muted-foreground mt-0.5">
                        Your site isn't ready yet. You can charge to your folio and use park facilities. We'll notify you when your site is ready.
                      </div>
                    </div>
                  </div>
                )}

                {isArrivalDay && (
                  <Link to={`/b/${slug}/checkin/${r.confirmation_number}`}>
                    <Button className="w-full h-11" style={{ background: primary, color: "white" }}>
                      <ClipboardCheck className="h-4 w-4 mr-2" /> Check in online
                    </Button>
                  </Link>
                )}

                {r.check_in_date > today && !isCheckedIn && !isHold && (
                  <p className="text-xs text-muted-foreground text-center">
                    Online check-in opens on {r.check_in_date}.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
