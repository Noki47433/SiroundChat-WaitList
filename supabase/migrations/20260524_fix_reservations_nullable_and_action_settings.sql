-- Fix NOT NULL constraints that block non-restaurant action inserts
ALTER TABLE public.reservations ALTER COLUMN party_size DROP NOT NULL;
ALTER TABLE public.reservations ALTER COLUMN restaurant_id DROP NOT NULL;
ALTER TABLE public.reservations ALTER COLUMN start_at DROP NOT NULL;
ALTER TABLE public.reservations ALTER COLUMN end_at DROP NOT NULL;
ALTER TABLE public.reservations ALTER COLUMN datetime DROP NOT NULL;

-- Add lane_index column that some queries expect
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS lane_index int NOT NULL DEFAULT 0;

-- Business action settings: capacity + pricing for non-restaurant action types
CREATE TABLE IF NOT EXISTS public.business_action_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  action_type         text NOT NULL,
  capacity            int  NOT NULL DEFAULT 1,
  slot_duration_min   int  NOT NULL DEFAULT 60,
  slot_interval_min   int  NOT NULL DEFAULT 30,
  avg_price_eur       numeric(10,2) NULL,
  max_days_ahead      int  NOT NULL DEFAULT 30,
  lead_time_min       int  NOT NULL DEFAULT 60,
  notes               text NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, action_type)
);

CREATE INDEX IF NOT EXISTS business_action_settings_business_idx
  ON public.business_action_settings (business_id, action_type);

ALTER TABLE public.business_action_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "action_settings_owner_all" ON public.business_action_settings;
CREATE POLICY "action_settings_owner_all" ON public.business_action_settings
  FOR ALL USING (public.is_business_owner(business_id))
  WITH CHECK (public.is_business_owner(business_id));

-- Add price_estimate column to reservations for revenue tracking
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS price_estimate numeric(10,2) NULL;
