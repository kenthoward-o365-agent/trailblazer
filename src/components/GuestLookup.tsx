import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { User, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  country: string | null;
  birthday: string | null;
  anniversary: string | null;
  likes_dislikes: string | null;
  origin_property_id: string | null;
  favorite_site_id: string | null;
}

interface PropertyInfo {
  id: string;
  name: string;
}

interface GuestLookupProps {
  firstName: string;
  lastName: string;
  email: string;
  streetAddress: string;
  onGuestSelected: (guest: Guest | null) => void;
  selectedGuestId: string | null;
  organizationId?: string | null;
  propertyId?: string | null;
}

export const GuestLookup = ({
  firstName,
  lastName,
  email,
  streetAddress,
  onGuestSelected,
  selectedGuestId,
  organizationId,
  propertyId,
}: GuestLookupProps) => {
  const [matchingGuests, setMatchingGuests] = useState<Guest[]>([]);
  const [propertyNames, setPropertyNames] = useState<Record<string, string>>({});
  const [showDialog, setShowDialog] = useState(false);
  const [autoMatched, setAutoMatched] = useState(false);

  // Fetch property names for origin properties
  const fetchPropertyNames = useCallback(async (guests: Guest[]) => {
    const originPropertyIds = guests
      .map(g => g.origin_property_id)
      .filter((id): id is string => id !== null);
    
    if (originPropertyIds.length === 0) return;

    const uniqueIds = [...new Set(originPropertyIds)];
    const { data } = await supabase
      .from("properties")
      .select("id, name")
      .in("id", uniqueIds);

    if (data) {
      const namesMap: Record<string, string> = {};
      data.forEach((p: PropertyInfo) => {
        namesMap[p.id] = p.name;
      });
      setPropertyNames(namesMap);
    }
  }, []);

  const searchGuests = useCallback(async () => {
    // Don't search if no meaningful input
    if (!firstName && !lastName && !email) {
      setMatchingGuests([]);
      setAutoMatched(false);
      return;
    }

    // Build search query
    let query = supabase.from("guests").select("*");

    // Filter by organization for multi-tenant isolation
    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    // Search for partial matches
    const conditions: string[] = [];
    
    if (lastName && lastName.length >= 2) {
      conditions.push(`last_name.ilike.%${lastName}%`);
    }
    if (email && email.length >= 3) {
      conditions.push(`email.ilike.%${email}%`);
    }
    if (firstName && firstName.length >= 2) {
      conditions.push(`first_name.ilike.%${firstName}%`);
    }

    if (conditions.length === 0) {
      setMatchingGuests([]);
      return;
    }

    const { data, error } = await query.or(conditions.join(",")).limit(10);

    if (error) {
      console.error("Guest search error:", error);
      return;
    }

    const matches = data || [];
    setMatchingGuests(matches);

    // Fetch property names for display
    if (matches.length > 0) {
      fetchPropertyNames(matches);
    }

    // Check for exact match on all 3 fields
    if (firstName && lastName && email && streetAddress) {
      const exactMatch = matches.find(
        (g) =>
          g.first_name.toLowerCase() === firstName.toLowerCase() &&
          g.last_name.toLowerCase() === lastName.toLowerCase() &&
          g.email.toLowerCase() === email.toLowerCase() &&
          g.street_address?.toLowerCase() === streetAddress.toLowerCase()
      );

      if (exactMatch && !autoMatched) {
        onGuestSelected(exactMatch);
        setAutoMatched(true);
      }
    }

    // Show dialog if we have multiple matches and no exact match
    if (matches.length > 1 && !selectedGuestId && !autoMatched) {
      // Only show dialog if there's meaningful overlap
      const hasGoodMatch = matches.some(
        (g) =>
          (g.last_name.toLowerCase() === lastName?.toLowerCase() &&
            g.first_name.toLowerCase() === firstName?.toLowerCase()) ||
          g.email.toLowerCase() === email?.toLowerCase()
      );
      if (hasGoodMatch) {
        setShowDialog(true);
      }
    } else if (matches.length === 1) {
      // Auto-select if single strong match
      const singleMatch = matches[0];
      if (
        (singleMatch.last_name.toLowerCase() === lastName?.toLowerCase() &&
          singleMatch.email.toLowerCase() === email?.toLowerCase()) ||
        (singleMatch.first_name.toLowerCase() === firstName?.toLowerCase() &&
          singleMatch.last_name.toLowerCase() === lastName?.toLowerCase() &&
          singleMatch.email.toLowerCase() === email?.toLowerCase())
      ) {
        onGuestSelected(singleMatch);
        setAutoMatched(true);
      }
    }
  }, [firstName, lastName, email, streetAddress, selectedGuestId, autoMatched, organizationId, fetchPropertyNames]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(searchGuests, 500);
    return () => clearTimeout(timer);
  }, [searchGuests]);

  // Reset auto-match if fields are cleared
  useEffect(() => {
    if (!firstName && !lastName && !email) {
      setAutoMatched(false);
      onGuestSelected(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, email]);

  const handleSelectGuest = (guest: Guest) => {
    onGuestSelected(guest);
    setAutoMatched(true);
    setShowDialog(false);
  };

  const handleCreateNew = () => {
    onGuestSelected(null);
    setAutoMatched(true);
    setShowDialog(false);
  };

  const selectedGuest = matchingGuests.find((g) => g.id === selectedGuestId);

  return (
    <>
      {selectedGuest && (
        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded border border-primary/20 mb-3">
          <Check className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            Matched to: {selectedGuest.first_name} {selectedGuest.last_name}
          </span>
          {selectedGuest.origin_property_id && propertyNames[selectedGuest.origin_property_id] && (
            <Badge variant="outline" className="text-xs ml-1">
              {propertyNames[selectedGuest.origin_property_id]}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 text-xs"
            onClick={() => {
              onGuestSelected(null);
              setAutoMatched(false);
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {matchingGuests.length > 0 && !selectedGuestId && !autoMatched && (
        <div className="mb-3">
          <Badge
            variant="outline"
            className="cursor-pointer"
            onClick={() => setShowDialog(true)}
          >
            <User className="h-3 w-3 mr-1" />
            {matchingGuests.length} matching guest{matchingGuests.length > 1 ? "s" : ""} found
          </Badge>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Select Existing Guest or Create New</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            We found guests matching your input. Select an existing profile or create a new one.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchingGuests.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell className="font-medium">
                    {guest.first_name} {guest.last_name}
                  </TableCell>
                  <TableCell>{guest.email}</TableCell>
                  <TableCell>
                    {guest.street_address || ""}
                    {guest.city && `, ${guest.city}`}
                    {guest.state && `, ${guest.state}`}
                  </TableCell>
                  <TableCell>
                    {guest.origin_property_id && propertyNames[guest.origin_property_id] ? (
                      <Badge variant="secondary" className="text-xs">
                        {propertyNames[guest.origin_property_id]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => handleSelectGuest(guest)}>
                      Select
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleCreateNew}>
              Create New Guest
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
