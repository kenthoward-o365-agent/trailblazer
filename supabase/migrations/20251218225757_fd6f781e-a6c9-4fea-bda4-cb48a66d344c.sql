-- Phase 2.6a: Fix group_blocks and related tables RLS

-- Drop existing policies for group_blocks
DROP POLICY IF EXISTS "Staff can view group blocks" ON public.group_blocks;
DROP POLICY IF EXISTS "Staff can create group blocks" ON public.group_blocks;
DROP POLICY IF EXISTS "Staff can update group blocks" ON public.group_blocks;
DROP POLICY IF EXISTS "Staff can delete group blocks" ON public.group_blocks;

-- Create properly scoped policies for group_blocks
CREATE POLICY "Staff can view property group blocks" 
ON public.group_blocks FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Staff can create property group blocks" 
ON public.group_blocks FOR INSERT TO authenticated
WITH CHECK (user_has_property_access(property_id));

CREATE POLICY "Staff can update property group blocks" 
ON public.group_blocks FOR UPDATE TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can delete property group blocks" 
ON public.group_blocks FOR DELETE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

-- Drop existing policies for group_block_room_allocations
DROP POLICY IF EXISTS "Staff can view group block allocations" ON public.group_block_room_allocations;
DROP POLICY IF EXISTS "Staff can manage group block allocations" ON public.group_block_room_allocations;

-- Create properly scoped policies for group_block_room_allocations (via group_blocks)
CREATE POLICY "Staff can view property group block allocations" 
ON public.group_block_room_allocations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_blocks gb
    WHERE gb.id = group_block_room_allocations.group_block_id
    AND user_has_property_access(gb.property_id)
  )
);

CREATE POLICY "Staff can manage property group block allocations" 
ON public.group_block_room_allocations FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_blocks gb
    WHERE gb.id = group_block_room_allocations.group_block_id
    AND user_has_property_access(gb.property_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_blocks gb
    WHERE gb.id = group_block_room_allocations.group_block_id
    AND user_has_property_access(gb.property_id)
  )
);

-- Drop existing policies for group_block_payment_cards
DROP POLICY IF EXISTS "Staff can view group block payment cards" ON public.group_block_payment_cards;
DROP POLICY IF EXISTS "Staff can manage group block payment cards" ON public.group_block_payment_cards;

-- Create properly scoped policies for group_block_payment_cards (via group_blocks)
CREATE POLICY "Staff can view property group block payment cards" 
ON public.group_block_payment_cards FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_blocks gb
    WHERE gb.id = group_block_payment_cards.group_block_id
    AND user_has_property_access(gb.property_id)
  )
);

CREATE POLICY "Staff can manage property group block payment cards" 
ON public.group_block_payment_cards FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_blocks gb
    WHERE gb.id = group_block_payment_cards.group_block_id
    AND user_has_property_access(gb.property_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_blocks gb
    WHERE gb.id = group_block_payment_cards.group_block_id
    AND user_has_property_access(gb.property_id)
  )
);