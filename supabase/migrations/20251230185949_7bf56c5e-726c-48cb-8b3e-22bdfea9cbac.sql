-- Add share columns to reservations table for Shared Reservations feature
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS share_group_id UUID,
ADD COLUMN IF NOT EXISTS is_share_master BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS master_reservation_id UUID REFERENCES public.reservations(id);

-- Index for efficient share group lookups
CREATE INDEX IF NOT EXISTS idx_reservations_share_group ON public.reservations(share_group_id) WHERE share_group_id IS NOT NULL;

-- Index for finding shares of a master reservation
CREATE INDEX IF NOT EXISTS idx_reservations_master_reservation ON public.reservations(master_reservation_id) WHERE master_reservation_id IS NOT NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN public.reservations.share_group_id IS 'UUID grouping all reservations sharing the same room';
COMMENT ON COLUMN public.reservations.is_share_master IS 'True if this reservation is the master controlling room assignment';
COMMENT ON COLUMN public.reservations.master_reservation_id IS 'Reference to the master reservation in the share group';