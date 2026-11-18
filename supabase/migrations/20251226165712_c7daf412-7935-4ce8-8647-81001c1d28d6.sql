-- Add void tracking columns to folio_postings
ALTER TABLE public.folio_postings 
  ADD COLUMN IF NOT EXISTS is_voided BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID,
  ADD COLUMN IF NOT EXISTS voided_by_name TEXT,
  ADD COLUMN IF NOT EXISTS voided_posting_id UUID REFERENCES public.folio_postings(id);

-- Create index for void lookups
CREATE INDEX IF NOT EXISTS idx_folio_postings_voided ON public.folio_postings(is_voided) WHERE is_voided = true;
CREATE INDEX IF NOT EXISTS idx_folio_postings_voided_posting ON public.folio_postings(voided_posting_id) WHERE voided_posting_id IS NOT NULL;