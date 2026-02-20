-- Dodaj kolumnę assigned_at do tabeli tasks (data i godzina przypisania zadania)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
