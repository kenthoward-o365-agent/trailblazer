-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  content TEXT,
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'active')),
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'before_arrival', 'after_departure')),
  trigger_days INTEGER,
  segment_filters JSONB DEFAULT '{}',
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign sends tracking table
CREATE TABLE public.campaign_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'opened', 'clicked'))
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;

-- RLS policies for campaigns
CREATE POLICY "Staff can view campaigns" ON public.campaigns
  FOR SELECT USING (true);

CREATE POLICY "Staff can create campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can update campaigns" ON public.campaigns
  FOR UPDATE USING (true);

CREATE POLICY "Staff can delete campaigns" ON public.campaigns
  FOR DELETE USING (true);

-- RLS policies for campaign_sends
CREATE POLICY "Staff can view campaign sends" ON public.campaign_sends
  FOR SELECT USING (true);

CREATE POLICY "Staff can create campaign sends" ON public.campaign_sends
  FOR INSERT WITH CHECK (true);

-- Add indexes
CREATE INDEX idx_campaigns_property_id ON public.campaigns(property_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaign_sends_campaign_id ON public.campaign_sends(campaign_id);
CREATE INDEX idx_campaign_sends_guest_id ON public.campaign_sends(guest_id);

-- Update trigger for campaigns
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();