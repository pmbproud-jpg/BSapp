-- Fix: Drop existing policies before recreating them
-- Run this if you get "policy already exists" errors

-- Vehicles policies
DROP POLICY IF EXISTS "Authenticated users can read vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Management+ can manage vehicles" ON public.vehicles;

-- Plan requests policies
DROP POLICY IF EXISTS "Users can read plan requests" ON public.plan_requests;
DROP POLICY IF EXISTS "Bauleiter+ can create plan requests" ON public.plan_requests;
DROP POLICY IF EXISTS "Bauleiter+ can update own plan requests" ON public.plan_requests;

-- Plan request workers policies
DROP POLICY IF EXISTS "Users can read plan request workers" ON public.plan_request_workers;
DROP POLICY IF EXISTS "Bauleiter+ can manage plan request workers" ON public.plan_request_workers;

-- Plan assignments policies
DROP POLICY IF EXISTS "Users can read own assignments" ON public.plan_assignments;
DROP POLICY IF EXISTS "Management can manage assignments" ON public.plan_assignments;

-- Now recreate all policies

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
