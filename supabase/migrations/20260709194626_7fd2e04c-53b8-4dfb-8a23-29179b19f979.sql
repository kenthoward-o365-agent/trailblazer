
-- Guest Messaging schema
CREATE TABLE public.messaging_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('sms','email','facebook','instagram')),
  provider TEXT NOT NULL CHECK (provider IN ('twilio','resend','meta')),
  identifier TEXT NOT NULL,
  credentials_ref TEXT,
  webhook_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, channel, identifier)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_channels TO authenticated;
GRANT ALL ON public.messaging_channels TO service_role;
ALTER TABLE public.messaging_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channels property access" ON public.messaging_channels
  FOR ALL USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TABLE public.messaging_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.messaging_channels(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  external_participant TEXT NOT NULL,
  display_name TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending_staff','awaiting_guest','resolved','snoozed')),
  category TEXT CHECK (category IN ('service','maintenance','billing','reservations','info','other')),
  assigned_to_user_id UUID,
  assigned_role TEXT,
  ai_mode TEXT NOT NULL DEFAULT 'suggest' CHECK (ai_mode IN ('auto','suggest','off')),
  unread_count INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_threads_prop_last ON public.messaging_threads(property_id, last_message_at DESC);
CREATE INDEX idx_msg_threads_ext ON public.messaging_threads(property_id, channel, external_participant);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_threads TO authenticated;
GRANT ALL ON public.messaging_threads TO service_role;
ALTER TABLE public.messaging_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "threads property access" ON public.messaging_threads
  FOR ALL USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TABLE public.messaging_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.messaging_threads(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('guest','staff','ai','system')),
  sender_user_id UUID,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider_message_id TEXT,
  delivery_status TEXT DEFAULT 'sent',
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  approved_by_user_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_messages_thread ON public.messaging_messages(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_messages TO authenticated;
GRANT ALL ON public.messaging_messages TO service_role;
ALTER TABLE public.messaging_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages property access" ON public.messaging_messages
  FOR ALL USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TABLE public.messaging_ai_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.messaging_threads(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messaging_messages(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_summary TEXT NOT NULL,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  proposed_reply TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','failed')),
  approved_by_user_id UUID,
  executed_at TIMESTAMPTZ,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_actions_thread ON public.messaging_ai_actions(thread_id, created_at);
CREATE INDEX idx_msg_actions_pending ON public.messaging_ai_actions(property_id, status) WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_ai_actions TO authenticated;
GRANT ALL ON public.messaging_ai_actions TO service_role;
ALTER TABLE public.messaging_ai_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai actions property access" ON public.messaging_ai_actions
  FOR ALL USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TABLE public.messaging_ai_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('policy','amenity','faq','rental_catalog','hours','rules','other')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_kb_prop ON public.messaging_ai_knowledge(property_id, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_ai_knowledge TO authenticated;
GRANT ALL ON public.messaging_ai_knowledge TO service_role;
ALTER TABLE public.messaging_ai_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb property access" ON public.messaging_ai_knowledge
  FOR ALL USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE TABLE public.messaging_role_visibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  category TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, role, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_role_visibility TO authenticated;
GRANT ALL ON public.messaging_role_visibility TO service_role;
ALTER TABLE public.messaging_role_visibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role vis property access" ON public.messaging_role_visibility
  FOR ALL USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

-- updated_at triggers
CREATE TRIGGER trg_msg_channels_updated BEFORE UPDATE ON public.messaging_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_msg_threads_updated BEFORE UPDATE ON public.messaging_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_msg_actions_updated BEFORE UPDATE ON public.messaging_ai_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_msg_kb_updated BEFORE UPDATE ON public.messaging_ai_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messaging_ai_actions;
