-- Dodaj kolumny GPS do profilu użytkownika
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_latitude double precision,
  ADD COLUMN IF NOT EXISTS last_longitude double precision,
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz;
