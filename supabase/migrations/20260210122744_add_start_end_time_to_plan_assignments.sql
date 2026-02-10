-- Add start_time and end_time to plan_assignments for time-based availability validation
ALTER TABLE plan_assignments ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE plan_assignments ADD COLUMN IF NOT EXISTS end_time time;

-- Add hide_phone and hide_email to profiles for contact visibility control
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_phone boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_email boolean DEFAULT false;

-- Add access_expires_at for subcontractor temporary access
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS access_expires_at timestamptz;
