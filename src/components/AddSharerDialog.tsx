import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, Loader2, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { AddSharerParams } from '@/hooks/useSharedReservations';

interface AddSharerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  masterReservationId: string;
  masterCheckInDate: string | null;
  masterCheckOutDate: string | null;
  masterTotalPrice?: number;
  propertyId: string;
  organizationId?: string;
  onAddSharer: (params: AddSharerParams) => Promise<{ success: boolean; reservationId?: string; error?: string }>;
}

interface GuestResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export function AddSharerDialog({
  open,
  onOpenChange,
  masterReservationId,
  masterCheckInDate,
  masterCheckOutDate,
  masterTotalPrice = 0,
  propertyId,
  organizationId,
  onAddSharer
}: AddSharerDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GuestResult[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [masterData, setMasterData] = useState<{
    checkInDate: string;
    checkOutDate: string;
    totalPrice: number;
  } | null>(null);

  const [checkInDate, setCheckInDate] = useState<Date | undefined>(undefined);
  const [checkOutDate, setCheckOutDate] = useState<Date | undefined>(undefined);
  const [rateSplitType, setRateSplitType] = useState<'no_charge' | 'split_equal' | 'custom'>('split_equal');
  const [customAmount, setCustomAmount] = useState('0');

  // Fetch master reservation data when dialog opens
  useEffect(() => {
    const fetchMasterData = async () => {
      if (!open || !masterReservationId) return;
      
      // If we already have the dates passed in, use those
      if (masterCheckInDate && masterCheckOutDate) {
        setMasterData({
          checkInDate: masterCheckInDate,
          checkOutDate: masterCheckOutDate,
          totalPrice: masterTotalPrice
        });
        setCheckInDate(parseISO(masterCheckInDate));
        setCheckOutDate(parseISO(masterCheckOutDate));
        return;
      }

      // Otherwise fetch from DB
      const { data, error } = await supabase
        .from('reservations')
        .select('check_in_date, check_out_date, total_price')
        .eq('id', masterReservationId)
        .single();

      if (!error && data) {
        setMasterData({
          checkInDate: data.check_in_date,
          checkOutDate: data.check_out_date,
          totalPrice: data.total_price
        });
        setCheckInDate(parseISO(data.check_in_date));
        setCheckOutDate(parseISO(data.check_out_date));
      }
    };

    if (open) {
      // Reset state when dialog opens
      setSearchQuery('');
      setSearchResults([]);
      setSelectedGuest(null);
      setRateSplitType('split_equal');
      setCustomAmount('0');
      fetchMasterData();
    }
  }, [open, masterReservationId, masterCheckInDate, masterCheckOutDate, masterTotalPrice]);

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('guests')
        .select('id, first_name, last_name, email')
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching guests:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectGuest = (guest: GuestResult) => {
    setSelectedGuest(guest);
    setSearchResults([]);
    setSearchQuery(`${guest.first_name} ${guest.last_name}`);
  };

  const handleSubmit = async () => {
    if (!selectedGuest || !checkInDate || !checkOutDate) return;

    setSaving(true);
    try {
      const effectiveTotalPrice = masterData?.totalPrice || masterTotalPrice;
      let totalPrice = 0;
      if (rateSplitType === 'custom') {
        totalPrice = parseFloat(customAmount) || 0;
      } else if (rateSplitType === 'split_equal') {
        totalPrice = effectiveTotalPrice / 2; // Will be recalculated in hook
      }

      const result = await onAddSharer({
        masterReservationId,
        guestId: selectedGuest.id,
        checkInDate: format(checkInDate, 'yyyy-MM-dd'),
        checkOutDate: format(checkOutDate, 'yyyy-MM-dd'),
        rateId: null,
        totalPrice,
        rateSplitType,
        propertyId,
        organizationId
      });

      if (result.success) {
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Error adding sharer:', err);
    } finally {
      setSaving(false);
    }
  };

  // Use master data for date constraints
  const masterIn = masterData ? parseISO(masterData.checkInDate) : new Date();
  const masterOut = masterData ? parseISO(masterData.checkOutDate) : new Date();
  const effectiveTotalPrice = masterData?.totalPrice || masterTotalPrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Sharer to Room</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Guest Search */}
          <div className="space-y-2">
            <Label>Guest</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                {selectedGuest && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
              <Button type="button" variant="outline" onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {searchResults.map((guest) => (
                  <div
                    key={guest.id}
                    className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                    onClick={() => handleSelectGuest(guest)}
                  >
                    <span className="font-medium">{guest.first_name} {guest.last_name}</span>
                    <span className="text-muted-foreground ml-2">{guest.email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Check-in</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !checkInDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {checkInDate ? format(checkInDate, 'MMM d, yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkInDate}
                    onSelect={setCheckInDate}
                    disabled={(date) => date < masterIn || date >= masterOut}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Check-out</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !checkOutDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {checkOutDate ? format(checkOutDate, 'MMM d, yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkOutDate}
                    onSelect={setCheckOutDate}
                    disabled={(date) => date <= masterIn || date > masterOut}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Rate Split */}
          <div className="space-y-2">
            <Label>Rate Split</Label>
            <RadioGroup value={rateSplitType} onValueChange={(v) => setRateSplitType(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no_charge" id="no_charge" />
                <Label htmlFor="no_charge" className="font-normal">No charge (rate stays on master)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="split_equal" id="split_equal" />
                <Label htmlFor="split_equal" className="font-normal">Split equally (${(effectiveTotalPrice / 2).toFixed(2)} each)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal">Custom amount</Label>
              </div>
            </RadioGroup>
            {rateSplitType === 'custom' && (
              <div className="pt-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedGuest || !checkInDate || !checkOutDate || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add Sharer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
