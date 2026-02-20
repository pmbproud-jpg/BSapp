-- User absences / vacation system

-- 1) Add vacation_days_total to profiles (annual allowance)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vacation_days_total INTEGER DEFAULT 26;

-- 2) Create user_absences table
CREATE TABLE IF NOT EXISTS public.user_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'vacation'
    CHECK (type IN ('vacation', 'sick_leave', 'special_leave', 'training', 'unexcused')),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  days INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  note TEXT,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_absences_user_id ON public.user_absences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_absences_dates ON public.user_absences(date_from, date_to);
CREATE INDEX IF NOT EXISTS idx_user_absences_status ON public.user_absences(status);
CREATE INDEX IF NOT EXISTS idx_user_absences_user_dates ON public.user_absences(user_id, date_from, date_to);

-- RLS
ALTER TABLE public.user_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.user_absences
  FOR ALL USING (true) WITH CHECK (true);
