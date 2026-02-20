-- GPS tracking: add gps_enabled flag to profiles and create user_locations table

-- 1) Add gps_enabled column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gps_enabled BOOLEAN DEFAULT false;

-- 2) Create user_locations table for storing GPS history
CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON public.user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_recorded_at ON public.user_locations(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_locations_user_recorded ON public.user_locations(user_id, recorded_at DESC);

-- RLS policies
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (via supabaseAdmin)
CREATE POLICY "Service role full access" ON public.user_locations
  FOR ALL USING (true) WITH CHECK (true);
