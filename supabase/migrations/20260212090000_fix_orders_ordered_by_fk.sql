-- Fix: ordered_by should reference profiles(id) not just auth.users(id)
-- This allows Supabase PostgREST joins like profiles!project_material_orders_ordered_by_fkey

-- Drop old FK if exists
ALTER TABLE public.project_material_orders
  DROP CONSTRAINT IF EXISTS project_material_orders_ordered_by_fkey;

-- Add FK to profiles
ALTER TABLE public.project_material_orders
  ADD CONSTRAINT project_material_orders_ordered_by_fkey
  FOREIGN KEY (ordered_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
