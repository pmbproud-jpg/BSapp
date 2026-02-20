-- Widen project_number to allow longer values from Excel imports
ALTER TABLE public.projects
  ALTER COLUMN project_number TYPE varchar(255);
