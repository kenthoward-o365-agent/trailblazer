import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CreditCard, 
  TrendingUp, 
  Check, 
  X,
  AlertTriangle,
  Clock,
  DollarSign
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { PaymentService } from "./PaymentService";
import type { PaymentAuthorization } from "./types";
import { toast } from "sonner";
import { format } from "date-fns";

interface AuthorizationManagerProps {
  propertyId: string;
  ledgerAccountId: string;
  currentBalance?: number;
  onAuthorizationChanged?: () => void;
}

import { MfaGuard } from "@/components/security/MfaGuard";

export function AuthorizationManager(props: AuthorizationManagerProps) {
  return (
    <MfaGuard resourceLabel="payment authorizations">
      <AuthorizationManagerInner {...props} />
    </MfaGuard>
  );
}

function AuthorizationManagerInner({
  propertyId,
  ledgerAccountId,
  currentBalance = 0,
  onAuthorizationChanged,
}: AuthorizationManagerProps) {
  const [authorizations, setAuthorizations] = useState<PaymentAuthorization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showIncrease, setShowIncrease] = useState<PaymentAuthorization | null>(null);
  const [showCapture, setShowCapture] = useState<PaymentAuthorization | null>(null);
  const [showVoid, setShowVoid] = useState<PaymentAuthorization | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [captureAmount, setCaptureAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadAuthorizations();
  }, [ledgerAccountId]);

  const loadAuthorizations = async () => {
    try {
      setIsLoading(true);
      const auths = await PaymentService.getAuthorizations(ledgerAccountId);
      setAuthorizations(auths);
    } catch (err) {
      console.error('Failed to load authorizations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIncrease = async () => {
    if (!showIncrease) return;
    
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= showIncrease.currentAmount) {
      toast.error("New amount must be greater than current amount");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await PaymentService.incrementalAuth({
        propertyId,
        authorizationId: showIncrease.id,
        newAmount: amount,
      });

      if (result.success) {
        toast.success(`Authorization increased to $${amount.toFixed(2)}`);
        setShowIncrease(null);
        setNewAmount("");
        loadAuthorizations();
        onAuthorizationChanged?.();
      } else {
        toast.error(result.error || "Failed to increase authorization");
      }
    } catch (err) {
      toast.error("Failed to increase authorization");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCapture = async () => {
    if (!showCapture) return;
    
    const amount = parseFloat(captureAmount);
    const remainingAuth = showCapture.currentAmount - showCapture.capturedAmount;
    
    if (isNaN(amount) || amount <= 0 || amount > remainingAuth) {
      toast.error(`Amount must be between $0.01 and $${remainingAuth.toFixed(2)}`);
      return;
    }

    setIsProcessing(true);
    try {
      const result = await PaymentService.capture({
        propertyId,
        authorizationId: showCapture.id,
        amount,
        ledgerAccountId,
      });

      if (result.success) {
        toast.success(`Captured $${amount.toFixed(2)}`);
        setShowCapture(null);
        setCaptureAmount("");
        loadAuthorizations();
        onAuthorizationChanged?.();
      } else {
        toast.error(result.error || "Failed to capture payment");
      }
    } catch (err) {
      toast.error("Failed to capture payment");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoid = async () => {
    if (!showVoid) return;

    setIsProcessing(true);
    try {
      const result = await PaymentService.voidAuth({
        propertyId,
        authorizationId: showVoid.id,
      });

      if (result.success) {
        toast.success("Authorization voided");
        setShowVoid(null);
        loadAuthorizations();
        onAuthorizationChanged?.();
      } else {
        toast.error(result.error || "Failed to void authorization");
      }
    } catch (err) {
      toast.error("Failed to void authorization");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (auth: PaymentAuthorization) => {
    const remainingAuth = auth.currentAmount - auth.capturedAmount;
    const usagePercent = currentBalance > 0 ? (currentBalance / remainingAuth) * 100 : 0;
    
    if (auth.status === 'fully_captured') {
      return <Badge variant="secondary">Fully Captured</Badge>;
    }
    if (auth.status === 'cancelled') {
      return <Badge variant="outline">Cancelled</Badge>;
    }
    if (auth.status === 'expired') {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (usagePercent >= 90) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {usagePercent.toFixed(0)}% Used
        </Badge>
      );
    }
    if (usagePercent >= 75) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {usagePercent.toFixed(0)}% Used
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-green-600 border-green-300">
        Active
      </Badge>
    );
  };

  const totalAuthorized = authorizations.reduce((sum, a) => sum + (a.currentAmount - a.capturedAmount), 0);
  const authorizationCoverage = currentBalance > 0 && totalAuthorized > 0 
    ? ((totalAuthorized / currentBalance) * 100).toFixed(0)
    : '100';

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        Loading authorizations...
      </div>
    );
  }

  if (authorizations.length === 0) {
    return null; // Don't show if no authorizations
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Active Authorizations
          </CardTitle>
          {currentBalance > 0 && (
            <div className="text-sm text-muted-foreground">
              Coverage: <span className={`font-medium ${parseInt(authorizationCoverage) < 100 ? 'text-amber-600' : 'text-green-600'}`}>
                {authorizationCoverage}%
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {authorizations.map((auth) => {
          const remainingAuth = auth.currentAmount - auth.capturedAmount;
          const card = auth.paymentCard;
          
          return (
            <div 
              key={auth.id}
              className="p-3 border rounded-lg bg-muted/30 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  {card && (
                    <span className="text-sm">
                      {card.cardBrand?.toUpperCase()} •••• {card.lastFourDigits}
                    </span>
                  )}
                  {auth.isMock && (
                    <Badge variant="outline" className="text-xs text-amber-600">
                      Mock
                    </Badge>
                  )}
                </div>
                {getStatusBadge(auth)}
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Original</div>
                  <div className="font-medium">${auth.originalAmount.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Current</div>
                  <div className="font-medium">${auth.currentAmount.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Remaining</div>
                  <div className="font-medium text-green-600">${remainingAuth.toFixed(2)}</div>
                </div>
              </div>

              {auth.capturedAmount > 0 && (
                <div className="text-xs text-muted-foreground">
                  Captured: ${auth.capturedAmount.toFixed(2)}
                </div>
              )}

              {auth.expiresAt && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Expires: {format(new Date(auth.expiresAt), 'MMM d, yyyy h:mm a')}
                </div>
              )}

              {auth.status === 'active' || auth.status === 'partially_captured' ? (
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowIncrease(auth);
                      setNewAmount((auth.currentAmount + 50).toFixed(2));
                    }}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Increase
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCapture(auth);
                      setCaptureAmount(remainingAuth.toFixed(2));
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Capture
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVoid(auth)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Void
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>

      {/* Increase Authorization Dialog */}
      <Dialog open={!!showIncrease} onOpenChange={() => setShowIncrease(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Increase Authorization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Current authorization: ${showIncrease?.currentAmount.toFixed(2)}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newAmount">New Total Amount</Label>
              <Input
                id="newAmount"
                type="number"
                step="0.01"
                min={(showIncrease?.currentAmount || 0) + 0.01}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIncrease(null)}>
              Cancel
            </Button>
            <Button onClick={handleIncrease} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Increase Authorization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Capture Dialog */}
      <Dialog open={!!showCapture} onOpenChange={() => setShowCapture(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Capture Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Available to capture: ${(showCapture ? showCapture.currentAmount - showCapture.capturedAmount : 0).toFixed(2)}
            </div>
            <div className="space-y-2">
              <Label htmlFor="captureAmount">Capture Amount</Label>
              <Input
                id="captureAmount"
                type="number"
                step="0.01"
                min="0.01"
                max={(showCapture ? showCapture.currentAmount - showCapture.capturedAmount : 0)}
                value={captureAmount}
                onChange={(e) => setCaptureAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCapture(null)}>
              Cancel
            </Button>
            <Button onClick={handleCapture} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Capture Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Confirmation */}
      <AlertDialog open={!!showVoid} onOpenChange={() => setShowVoid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Authorization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the authorization of ${showVoid?.currentAmount.toFixed(2)} 
              and release the hold on the guest's card. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleVoid}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground"
            >
              {isProcessing ? "Processing..." : "Void Authorization"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
