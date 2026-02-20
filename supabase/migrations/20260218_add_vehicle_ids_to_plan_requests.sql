-- Add vehicle_ids (JSONB array of UUIDs) to plan_requests for vehicle selection in orders
ALTER TABLE public.plan_requests
  ADD COLUMN IF NOT EXISTS vehicle_ids JSONB DEFAULT '[]'::jsonb;
