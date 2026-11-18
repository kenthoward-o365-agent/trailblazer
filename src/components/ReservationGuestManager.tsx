import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useReservationGuests, ReservationGuest } from "@/hooks/useReservationGuests";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Plus, 
  Trash2, 
  FileText,
  Crown,
  Loader2,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReservationGuestManagerProps {
  reservationId: string;
  propertyId: string;
  onGuestSelect?: (reservationGuest: ReservationGuest) => void;
  selectedReservationGuestId?: string;
  compact?: boolean;
}

export function ReservationGuestManager({
  reservationId,
  propertyId,
  onGuestSelect,
  selectedReservationGuestId,
  compact = false,
}: ReservationGuestManagerProps) {
  const {
    reservationGuests,
    loading,
    addGuest,
    removeGuest,
    canAddMoreGuests,
    maxGuests,
  } = useReservationGuests({ reservationId });

  const [isAddGuestDialogOpen, setIsAddGuestDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [guestToRemove, setGuestToRemove] = useState<ReservationGuest | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [selectedNewGuestId, setSelectedNewGuestId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; first_name: string; last_name: string; email: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const { data } = await supabase
      .from("guests")
      .select("id, first_name, last_name, email")
      .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      .limit(10);
    setSearchResults(data || []);
    setIsSearching(false);
  };

  const handleAddGuest = async () => {
    if (!selectedNewGuestId) return;
    setIsAdding(true);
    const success = await addGuest(selectedNewGuestId, propertyId);
    setIsAdding(false);
    if (success) {
      setIsAddGuestDialogOpen(false);
      setSelectedNewGuestId(null);
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const handleRemoveGuest = async () => {
    if (!guestToRemove) return;
    setIsRemoving(true);
    const success = await removeGuest(guestToRemove.id);
    setIsRemoving(false);
    if (success) {
      setIsRemoveDialogOpen(false);
      setGuestToRemove(null);
    }
  };

  if (loading) {
    return (
      <Card className={compact ? "p-2" : ""}>
        <CardContent className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const compactView = (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          Guests ({reservationGuests.length}/{maxGuests})
        </span>
        {canAddMoreGuests && (
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsAddGuestDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {reservationGuests.map((rg) => (
          <Badge
            key={rg.id}
            variant={selectedReservationGuestId === rg.id ? "default" : "secondary"}
            className={cn("cursor-pointer hover:bg-accent transition-colors py-1 px-2", selectedReservationGuestId === rg.id && "ring-1 ring-primary")}
            onClick={() => onGuestSelect?.(rg)}
          >
            {rg.is_primary && <Crown className="h-3 w-3 mr-1" />}
            <span className="text-xs">Folio {rg.folio_number}: {rg.guest?.first_name} {rg.guest?.last_name}</span>
            {rg.ledger_account && <span className="ml-1.5 text-xs opacity-75">${rg.ledger_account.balance.toFixed(2)}</span>}
          </Badge>
        ))}
      </div>
    </div>
  );

  const fullView = (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Reservation Guests ({reservationGuests.length}/{maxGuests})
          </CardTitle>
          {canAddMoreGuests && (
            <Button variant="outline" size="sm" onClick={() => setIsAddGuestDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Add Guest
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-2">
          {reservationGuests.map((rg) => (
            <div
              key={rg.id}
              className={cn("flex items-center justify-between p-3 rounded-md border bg-card cursor-pointer hover:bg-accent/50 transition-colors", selectedReservationGuestId === rg.id && "ring-2 ring-primary bg-accent/50")}
              onClick={() => onGuestSelect?.(rg)}
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    {rg.is_primary && <Crown className="h-4 w-4 text-amber-500" />}
                    <span className="font-medium text-sm">{rg.guest?.first_name} {rg.guest?.last_name}</span>
                    <Badge variant="outline" className="text-xs">Folio {rg.folio_number}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{rg.guest_confirmation_number}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-sm">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className={cn("font-medium", (rg.ledger_account?.balance || 0) > 0 && "text-destructive", (rg.ledger_account?.balance || 0) < 0 && "text-green-600")}>
                      ${(rg.ledger_account?.balance || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
                {!rg.is_primary && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setGuestToRemove(rg); setIsRemoveDialogOpen(true); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {reservationGuests.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No guests on this reservation</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      {compact ? compactView : fullView}

      {/* Add Guest Dialog */}
      <Dialog open={isAddGuestDialogOpen} onOpenChange={(open) => { if (!open) { setIsAddGuestDialogOpen(false); setSearchQuery(""); setSearchResults([]); setSelectedNewGuestId(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Guest to Reservation</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Search by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
              <Button onClick={handleSearch} disabled={isSearching}>{isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {searchResults.map((guest) => (
                <div key={guest.id} className={cn("p-2 rounded cursor-pointer hover:bg-accent", selectedNewGuestId === guest.id && "bg-accent ring-1 ring-primary")} onClick={() => setSelectedNewGuestId(guest.id)}>
                  <p className="text-sm font-medium">{guest.first_name} {guest.last_name}</p>
                  <p className="text-xs text-muted-foreground">{guest.email}</p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddGuestDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddGuest} disabled={!selectedNewGuestId || isAdding}>{isAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Add Guest</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Guest Dialog */}
      <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove Guest from Reservation</DialogTitle></DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">Are you sure you want to remove <span className="font-medium text-foreground">{guestToRemove?.guest?.first_name} {guestToRemove?.guest?.last_name}</span> from this reservation?</p>
            {guestToRemove?.ledger_account && guestToRemove.ledger_account.balance !== 0 && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">This guest has an outstanding folio balance. Please transfer or settle the balance before removing.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsRemoveDialogOpen(false); setGuestToRemove(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveGuest} disabled={isRemoving || (guestToRemove?.ledger_account?.balance !== 0)}>{isRemoving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}Remove Guest</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
