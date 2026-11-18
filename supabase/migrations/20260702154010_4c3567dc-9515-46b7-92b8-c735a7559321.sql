
-- ============================================================================
-- Denormalize property_id onto high-volume ledger tables for scale.
-- Eliminates per-row EXISTS subqueries in RLS and enables (property_id, date)
-- range scans instead of joining through ledger_accounts / journal_entries.
-- ============================================================================

-- ---------- 1. Add nullable property_id columns ----------
ALTER TABLE public.folio_postings      ADD COLUMN IF NOT EXISTS property_id uuid;
ALTER TABLE public.ledger_transactions ADD COLUMN IF NOT EXISTS property_id uuid;
ALTER TABLE public.journal_entry_lines ADD COLUMN IF NOT EXISTS property_id uuid;

-- ---------- 2. Backfill from parent tables ----------
UPDATE public.folio_postings fp
   SET property_id = la.property_id
  FROM public.ledger_accounts la
 WHERE la.id = fp.ledger_account_id
   AND fp.property_id IS NULL;

UPDATE public.ledger_transactions lt
   SET property_id = la.property_id
  FROM public.ledger_accounts la
 WHERE la.id = lt.ledger_account_id
   AND lt.property_id IS NULL;

UPDATE public.journal_entry_lines jel
   SET property_id = je.property_id
  FROM public.journal_entries je
 WHERE je.id = jel.journal_entry_id
   AND jel.property_id IS NULL;

-- ---------- 3. Enforce NOT NULL + FK ----------
ALTER TABLE public.folio_postings
  ALTER COLUMN property_id SET NOT NULL,
  ADD CONSTRAINT folio_postings_property_id_fkey
    FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

ALTER TABLE public.ledger_transactions
  ALTER COLUMN property_id SET NOT NULL,
  ADD CONSTRAINT ledger_transactions_property_id_fkey
    FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

ALTER TABLE public.journal_entry_lines
  ALTER COLUMN property_id SET NOT NULL,
  ADD CONSTRAINT journal_entry_lines_property_id_fkey
    FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

-- ---------- 4. Auto-populate on insert (keeps existing app code working) ----------
CREATE OR REPLACE FUNCTION public.set_folio_posting_property_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    SELECT property_id INTO NEW.property_id
      FROM public.ledger_accounts WHERE id = NEW.ledger_account_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_ledger_transaction_property_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    SELECT property_id INTO NEW.property_id
      FROM public.ledger_accounts WHERE id = NEW.ledger_account_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_journal_entry_line_property_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    SELECT property_id INTO NEW.property_id
      FROM public.journal_entries WHERE id = NEW.journal_entry_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_folio_postings_set_property      ON public.folio_postings;
DROP TRIGGER IF EXISTS trg_ledger_tx_set_property           ON public.ledger_transactions;
DROP TRIGGER IF EXISTS trg_journal_entry_lines_set_property ON public.journal_entry_lines;

CREATE TRIGGER trg_folio_postings_set_property
  BEFORE INSERT ON public.folio_postings
  FOR EACH ROW EXECUTE FUNCTION public.set_folio_posting_property_id();

CREATE TRIGGER trg_ledger_tx_set_property
  BEFORE INSERT ON public.ledger_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_ledger_transaction_property_id();

CREATE TRIGGER trg_journal_entry_lines_set_property
  BEFORE INSERT ON public.journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_journal_entry_line_property_id();

-- ---------- 5. Indexes tuned for the new access pattern ----------
CREATE INDEX IF NOT EXISTS idx_folio_postings_property_date
  ON public.folio_postings (property_id, posting_date DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_tx_property_date
  ON public.ledger_transactions (property_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_property
  ON public.journal_entry_lines (property_id);

-- ---------- 6. Rewrite RLS to use property_id directly (no subquery) ----------
-- folio_postings
DROP POLICY IF EXISTS "Staff can view property folio postings"   ON public.folio_postings;
DROP POLICY IF EXISTS "Staff can insert property folio postings" ON public.folio_postings;
DROP POLICY IF EXISTS "Managers can update folio postings"       ON public.folio_postings;

CREATE POLICY "Staff can view property folio postings"
  ON public.folio_postings FOR SELECT TO authenticated
  USING (user_has_property_access(property_id));

CREATE POLICY "Staff can insert property folio postings"
  ON public.folio_postings FOR INSERT TO authenticated
  WITH CHECK (user_has_property_access(property_id));

CREATE POLICY "Managers can update folio postings"
  ON public.folio_postings FOR UPDATE TO authenticated
  USING (user_has_property_access(property_id)
         AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- ledger_transactions
DROP POLICY IF EXISTS "Staff can view property ledger transactions"   ON public.ledger_transactions;
DROP POLICY IF EXISTS "Staff can insert property ledger transactions" ON public.ledger_transactions;
DROP POLICY IF EXISTS "Managers can update ledger transactions"       ON public.ledger_transactions;

CREATE POLICY "Staff can view property ledger transactions"
  ON public.ledger_transactions FOR SELECT TO authenticated
  USING (user_has_property_access(property_id));

CREATE POLICY "Staff can insert property ledger transactions"
  ON public.ledger_transactions FOR INSERT TO authenticated
  WITH CHECK (user_has_property_access(property_id));

CREATE POLICY "Managers can update ledger transactions"
  ON public.ledger_transactions FOR UPDATE TO authenticated
  USING (user_has_property_access(property_id)
         AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

-- journal_entry_lines
DROP POLICY IF EXISTS "Staff can view property journal entry lines"    ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Staff can create property journal entry lines"  ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Managers can manage property journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Managers can delete property journal entry lines" ON public.journal_entry_lines;

CREATE POLICY "Staff can view property journal entry lines"
  ON public.journal_entry_lines FOR SELECT TO authenticated
  USING (user_has_property_access(property_id));

CREATE POLICY "Staff can create property journal entry lines"
  ON public.journal_entry_lines FOR INSERT TO authenticated
  WITH CHECK (user_has_property_access(property_id));

CREATE POLICY "Managers can manage property journal entry lines"
  ON public.journal_entry_lines FOR UPDATE TO authenticated
  USING (user_has_property_access(property_id)
         AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Managers can delete property journal entry lines"
  ON public.journal_entry_lines FOR DELETE TO authenticated
  USING (user_has_property_access(property_id)
         AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));
