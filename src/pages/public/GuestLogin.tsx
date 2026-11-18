import { useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";
import { bookingApi } from "@/lib/bookingEngineApi";
import { saveGuestSession } from "@/lib/guestSession";

type Ctx = { slug: string; data: any };

export default function GuestLogin() {
  const { slug } = useParams<{ slug: string }>();
  const { data } = useOutletContext<Ctx>();
  const navigate = useNavigate();
  const [conf, setConf] = useState("");
  const [lastName, setLastName] = useState("");
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const primary = data.settings?.primary_color ?? "hsl(var(--primary))";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await bookingApi.guestLogin(slug!, {
        confirmation_number: conf.trim(),
        last_name: lastName.trim(),
        zipcode: zip.trim(),
      });
      saveGuestSession(slug!, res);
      navigate(`/b/${slug}/my-trip`);
    } catch (e: any) {
      setError(e.message?.includes("rate_limited")
        ? "Too many attempts. Please wait 15 minutes and try again."
        : "We couldn't find a reservation matching those details. Please double-check your confirmation number, last name, and ZIP/postal code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>Sign in to your trip</CardTitle>
          <p className="text-sm text-muted-foreground">
            View your upcoming reservations and complete online check-in.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="conf">Confirmation number</Label>
              <Input
                id="conf"
                value={conf}
                onChange={(e) => setConf(e.target.value)}
                placeholder="e.g. 0000123"
                autoComplete="off"
                inputMode="text"
                className="h-11 mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="ln">Last name</Label>
              <Input
                id="ln"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                className="h-11 mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="zip">ZIP / Postal code</Label>
              <Input
                id="zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                autoComplete="postal-code"
                className="h-11 mt-1"
                required
              />
            </div>
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={loading || !conf || !lastName || !zip}
              className="w-full h-11"
              style={{ background: primary, color: "white" }}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            These three pieces of information together verify you're the guest on the reservation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
