
ALTER TABLE public.folio_postings      ALTER COLUMN property_id DROP NOT NULL;
ALTER TABLE public.ledger_transactions ALTER COLUMN property_id DROP NOT NULL;
ALTER TABLE public.journal_entry_lines ALTER COLUMN property_id DROP NOT NULL;
