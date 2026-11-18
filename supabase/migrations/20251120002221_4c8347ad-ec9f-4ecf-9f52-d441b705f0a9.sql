-- Allow front_desk role to update sites as well, so edits from Map Editor persist

-- Rename existing policy for clarity
ALTER POLICY "Staff can update sites" ON public.sites
RENAME TO "Admins and managers can update sites";

-- New policy: front_desk users can update sites
CREATE POLICY "Front desk can update sites"
ON public.sites
FOR UPDATE
USING (has_role(auth.uid(), 'front_desk'::app_role));