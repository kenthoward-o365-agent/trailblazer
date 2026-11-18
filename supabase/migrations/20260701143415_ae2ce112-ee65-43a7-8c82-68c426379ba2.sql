
CREATE POLICY "Payment cards: MFA managers delete"
ON public.payment_cards
FOR DELETE
TO authenticated
USING (
  public.current_user_has_mfa()
  AND (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
    AND (
      ((property_id IS NOT NULL) AND public.user_has_property_access(property_id))
      OR EXISTS (
        SELECT 1 FROM public.ledger_accounts la
        WHERE la.id = payment_cards.ledger_account_id
          AND public.user_has_property_access(la.property_id)
      )
    )
  )
);

GRANT DELETE ON public.payment_cards TO authenticated;
