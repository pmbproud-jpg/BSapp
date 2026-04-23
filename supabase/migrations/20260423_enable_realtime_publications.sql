-- Faza 3.5: wlacz Supabase Realtime dla tabel uzywanych przez useProjectRealtime
-- i useWarehouseRealtime. Bez tego subscribe na kanale nie zwraca zdarzen.
--
-- Idempotentnie -- ALTER PUBLICATION ... ADD TABLE rzuca blad gdy tabela juz
-- jest w publication, wiec sprawdzamy przez pg_publication_tables.
--
-- Aplikacja:
--   npx supabase db query --linked --file supabase/migrations/20260423_enable_realtime_publications.sql

DO $$
DECLARE
  t TEXT;
  tables_to_enable TEXT[] := ARRAY[
    'projects',
    'tasks',
    'project_members',
    'project_attachments',
    'attachment_folders',
    'project_material_orders',
    'project_tool_orders',
    'warehouse_items',
    'warehouse_materials'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_enable
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Added % to supabase_realtime publication', t;
    ELSE
      RAISE NOTICE 'Table % already in supabase_realtime publication', t;
    END IF;
  END LOOP;
END $$;

-- Weryfikacja: zobacz aktualne tabele w publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;
