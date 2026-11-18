import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Save, CreditCard, AlertCircle } from "lucide-react";

interface PaymentGatewayCardProps {
  paymentGatewayMode: "mock" | "test" | "live";
  setPaymentGatewayMode: (mode: "mock" | "test" | "live") => void;
  adyenClientKey: string;
  setAdyenClientKey: (value: string) => void;
  adyenMerchantAccount: string;
  setAdyenMerchantAccount: (value: string) => void;
  saving: boolean;
  onSave: () => void;
}

export const PaymentGatewayCard = ({
  paymentGatewayMode,
  setPaymentGatewayMode,
  adyenClientKey,
  setAdyenClientKey,
  adyenMerchantAccount,
  setAdyenMerchantAccount,
  saving,
  onSave,
}: PaymentGatewayCardProps) => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Payment Gateway Configuration</h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <Label>Gateway Mode</Label>
          <RadioGroup
            value={paymentGatewayMode}
            onValueChange={(value) => setPaymentGatewayMode(value as "mock" | "test" | "live")}
            className="grid grid-cols-3 gap-4"
          >
            <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted">
              <RadioGroupItem value="mock" id="mode-mock" />
              <Label htmlFor="mode-mock" className="cursor-pointer flex-1">
                <div className="font-medium">Mock</div>
                <div className="text-xs text-muted-foreground">Testing without real payments</div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted">
              <RadioGroupItem value="test" id="mode-test" />
              <Label htmlFor="mode-test" className="cursor-pointer flex-1">
                <div className="font-medium">Test</div>
                <div className="text-xs text-muted-foreground">Adyen test environment</div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted">
              <RadioGroupItem value="live" id="mode-live" />
              <Label htmlFor="mode-live" className="cursor-pointer flex-1">
                <div className="font-medium">Live</div>
                <div className="text-xs text-muted-foreground">Adyen production</div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Adyen Configuration - Only shown for test/live modes */}
        {(paymentGatewayMode === 'test' || paymentGatewayMode === 'live') && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>Configure your Adyen {paymentGatewayMode === 'test' ? 'test' : 'production'} credentials</span>
            </div>

            <div>
              <Label htmlFor="adyenClientKey">Client Key</Label>
              <Input
                id="adyenClientKey"
                type="text"
                value={adyenClientKey}
                onChange={(e) => setAdyenClientKey(e.target.value)}
                placeholder={paymentGatewayMode === 'test' ? 'test_...' : 'live_...'}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Found in Adyen Customer Area → Developers → API credentials
              </p>
            </div>

            <div>
              <Label htmlFor="adyenMerchantAccount">Merchant Account</Label>
              <Input
                id="adyenMerchantAccount"
                type="text"
                value={adyenMerchantAccount}
                onChange={(e) => setAdyenMerchantAccount(e.target.value)}
                placeholder="YourCompanyECOM"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your Adyen merchant account name
              </p>
            </div>

            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
              <strong>Note:</strong> The Adyen API Key is stored securely as a server secret and is not configured here.
              Contact your administrator to configure the API key.
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Payment Settings"}
          </Button>
        </div>
      </div>
    </Card>
  );
};
