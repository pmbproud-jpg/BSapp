-- Add vehicle_ids (JSONB array of UUIDs) to plan_assignments for multi-vehicle support
ALTER TABLE public.plan_assignments
  ADD COLUMN IF NOT EXISTS vehicle_ids JSONB DEFAULT '[]'::jsonb;

-- Migrate existing vehicle_id data to vehicle_ids
UPDATE public.plan_assignments
  SET vehicle_ids = jsonb_build_array(vehicle_id)
  WHERE vehicle_id IS NOT NULL AND (vehicle_ids IS NULL OR vehicle_ids = '[]'::jsonb);
