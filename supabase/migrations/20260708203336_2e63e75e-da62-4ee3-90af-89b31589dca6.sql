GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_comments TO authenticated;
GRANT ALL ON public.work_order_comments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_attachments TO authenticated;
GRANT ALL ON public.work_order_attachments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_cost_items TO authenticated;
GRANT ALL ON public.work_order_cost_items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_work_order_sequences TO authenticated;
GRANT ALL ON public.property_work_order_sequences TO service_role;