import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Users, ExternalLink, Plus, Loader2 } from 'lucide-react';
import { ShareGroup, ShareReservation, AddSharerParams } from '@/hooks/useSharedReservations';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AddSharerDialog } from './AddSharerDialog';

interface ShareGroupCardProps {
  reservationId: string;
  propertyId: string;
  shareGroup: ShareGroup | null;
  loading: boolean;
  onAddSharer: (params: AddSharerParams) => Promise<{ success: boolean; reservationId?: string; error?: string }>;
  onRemoveSharer: (reservationId: string) => Promise<boolean>;
  onRefresh: () => void;
}

export function ShareGroupCard({ 
  reservationId,
  propertyId,
  shareGroup, 
  loading,
  onAddSharer,
  onRemoveSharer,
  onRefresh
}: ShareGroupCardProps) {
  const navigate = useNavigate();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleNavigateToShare = (resId: string) => {
    if (resId !== reservationId) {
      navigate(`/reservation/edit?id=${resId}`);
    }
  };

  const handleAddSharer = async (params: AddSharerParams) => {
    const result = await onAddSharer(params);
    if (result.success) {
      setShowAddDialog(false);
      onRefresh();
    }
    return result;
  };

  // Get master reservation for the dialog
  const masterReservation = shareGroup?.masterReservation || null;

  const renderShareRow = (res: ShareReservation, isMaster: boolean, isCurrent: boolean) => (
    <div
      key={res.id}
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border transition-colors",
        isCurrent ? "bg-primary/5 border-primary" : "bg-muted/30 border-border hover:bg-muted/50 cursor-pointer"
      )}
      onClick={() => !isCurrent && handleNavigateToShare(res.id)}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {isMaster && (
            <Crown className="h-4 w-4 text-amber-500" aria-label="Master reservation" />
          )}
          <span className="font-medium text-sm">
            {res.confirmation_number}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {res.guest?.first_name} {res.guest?.last_name}
        </span>
        <Badge variant={res.status === 'CHECKED_IN' ? 'default' : 'secondary'} className="text-xs">
          {res.status}
        </Badge>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm">
          {res.check_in_date} - {res.check_out_date}
        </span>
        {res.ledger_account && (
          <span className={cn(
            "text-sm font-medium",
            res.ledger_account.balance > 0 ? "text-destructive" : "text-muted-foreground"
          )}>
            ${res.ledger_account.balance.toFixed(2)}
          </span>
        )}
        {!isCurrent && (
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        )}
        {isCurrent && (
          <Badge variant="outline" className="text-xs">Current</Badge>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No share group - show option to add sharer
  if (!shareGroup) {
    return (
      <>
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Share Room
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Sharer
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4 px-4">
            <p className="text-sm text-muted-foreground">
              Add another guest to share this room. Each sharer gets their own reservation, folio, and confirmation.
            </p>
          </CardContent>
        </Card>

        <AddSharerDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          masterReservationId={reservationId}
          masterCheckInDate={null}
          masterCheckOutDate={null}
          propertyId={propertyId}
          onAddSharer={handleAddSharer}
        />
      </>
    );
  }

  // Has share group - show all shares
  const allReservations = [shareGroup.masterReservation, ...shareGroup.shareReservations];
  const isMasterCurrent = shareGroup.masterReservation.id === reservationId;

  return (
    <>
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Share Group ({allReservations.length} guests)
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Sharer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-4 px-4 space-y-2">
          {allReservations.map(res => 
            renderShareRow(
              res, 
              res.id === shareGroup.masterReservation.id,
              res.id === reservationId
            )
          )}
          {!isMasterCurrent && (
            <p className="text-xs text-muted-foreground mt-2">
              <Crown className="h-3 w-3 inline mr-1 text-amber-500" />
              Room assignment is controlled by the master reservation.
            </p>
          )}
        </CardContent>
      </Card>

      <AddSharerDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        masterReservationId={masterReservation?.id || reservationId}
        masterCheckInDate={masterReservation?.check_in_date || null}
        masterCheckOutDate={masterReservation?.check_out_date || null}
        propertyId={propertyId}
        onAddSharer={handleAddSharer}
      />
    </>
  );
}
