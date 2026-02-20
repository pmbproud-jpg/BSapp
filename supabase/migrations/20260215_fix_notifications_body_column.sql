-- Dodaj kolumnę 'body' do tabeli notifications jeśli nie istnieje
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'body'
  ) THEN
    -- Sprawdź czy istnieje kolumna 'message' i zmień jej nazwę na 'body'
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notifications'
        AND column_name = 'message'
    ) THEN
      ALTER TABLE public.notifications RENAME COLUMN message TO body;
    ELSE
      ALTER TABLE public.notifications ADD COLUMN body TEXT NOT NULL DEFAULT '';
    END IF;
  END IF;
END $$;
