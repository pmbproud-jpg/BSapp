-- ============================================
-- Weekly Plan System: Vehicles, Requests, Assignments
-- ============================================

-- 1. Vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  license_plate TEXT NOT NULL UNIQUE,
  seats INTEGER NOT NULL DEFAULT 5,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vehicles"
  ON public.vehicles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Management+ can manage vehicles"
  ON public.vehicles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'management')
    )
  );

-- 2. Plan requests (Bauleiter sends demand for workers per project per week)
CREATE TABLE IF NOT EXISTS public.plan_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'published')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_requests_week ON public.plan_requests(week_start);
CREATE INDEX IF NOT EXISTS idx_plan_requests_project ON public.plan_requests(project_id);

ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read plan requests"
  ON public.plan_requests FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Bauleiter+ can create plan requests"
  ON public.plan_requests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'management', 'project_manager', 'bauleiter')
    )
  );

CREATE POLICY "Bauleiter+ can update own plan requests"
  ON public.plan_requests FOR UPDATE
  USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'management')
    )
  );

-- 3. Plan request workers (which workers are needed per request)
CREATE TABLE IF NOT EXISTS public.plan_request_workers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.plan_requests(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(request_id, worker_id)
);

ALTER TABLE public.plan_request_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read plan request workers"
  ON public.plan_request_workers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Bauleiter+ can manage plan request workers"
  ON public.plan_request_workers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'management', 'project_manager', 'bauleiter')
    )
  );

-- 4. Plan assignments (Logistics assigns vehicle + departure per day)
CREATE TABLE IF NOT EXISTS public.plan_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.plan_requests(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  departure_time TIME,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_id, worker_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_plan_assignments_request ON public.plan_assignments(request_id);
CREATE INDEX IF NOT EXISTS idx_plan_assignments_worker ON public.plan_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_plan_assignments_vehicle ON public.plan_assignments(vehicle_id);

ALTER TABLE public.plan_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own assignments"
  ON public.plan_assignments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Management can manage assignments"
  ON public.plan_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'management')
    )
  );
