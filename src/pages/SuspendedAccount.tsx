import { AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SuspendedAccountProps {
  organizationName?: string;
  billingEmail?: string;
}

export const SuspendedAccount = ({ organizationName, billingEmail }: SuspendedAccountProps) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Account Suspended</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {organizationName ? (
              <>Your organization <strong>{organizationName}</strong> has been suspended due to payment issues.</>
            ) : (
              <>Your account has been suspended due to payment issues.</>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact your account administrator or our sales team to restore access.
          </p>
          {billingEmail && (
            <Button variant="outline" asChild>
              <a href={`mailto:${billingEmail}`}>
                <Mail className="h-4 w-4 mr-2" />
                Contact Billing
              </a>
            </Button>
          )}
          <Button variant="link" asChild>
            <a href="mailto:sales@aspiresoftware.com">Contact Sales</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuspendedAccount;
