-- =====================================================================
-- Migracja: 20260419_harden_rls
-- Faza 0.2 — bezpieczeństwo: przepisanie policy RLS z "USING (true)"
--            na policy oparte o auth.uid(), rolę użytkownika
--            i membership projektu.
-- =====================================================================
--
-- Kontekst:
--   Przed tą migracją 11 tabel miało RLS z `USING (true)` lub
--   `FOR ALL USING (true)`, co pozwalało dowolnemu zalogowanemu
--   użytkownikowi (także worker / subcontractor) ominąć proxy
--   Netlify Function (`netlify/functions/supabase-admin.js`)
--   i pobrać lub modyfikować dane bezpośrednio przez
--   EXPO_PUBLIC_SUPABASE_ANON_KEY + własny JWT.
--
--   Ta migracja ustanawia defense-in-depth:
--     - proxy nadal jest głównym punktem autoryzacji
--       (service_role bypass RLS),
--     - ale w razie ominięcia proxy policy na poziomie bazy
--       egzekwują kontekst użytkownika (self / project member / role).
--
-- Model ról (z src/lib/supabase/database.types.ts):
--   admin, management                            — pełny dostęp
--   project_manager, bauleiter,
--   logistics, purchasing, warehouse_manager     — "write roles"
--   worker, subcontractor, office_worker         — self-scoped / read-only
--
-- UWAGA wdrożeniowa:
--   Po `supabase db push` przetestuj ręcznie krytyczne flow:
--     1) logowanie jako worker  — widzi własny profil, własne
--        nieobecności, własną lokalizację GPS, NIE widzi cudzych.
--     2) logowanie jako bauleiter — widzi tylko projekty, do
--        których ma membership (project_members), oraz ich plany /
--        załączniki / zamówienia.
--     3) logowanie jako admin — widzi wszystko (przez proxy jak dotąd).
--   Jeśli któryś flow zwróci pustą listę lub 403, sprawdź czy idzie
--   przez proxy (adminApi) czy bezpośrednio przez supabase client.
--   Dla przypadków bezpośredniego klienta — albo rozszerz policy,
--   albo zmigruj call do adminApi.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Helper functions — SECURITY DEFINER, aby uniknąć rekursji RLS
--    (inline EXISTS na `profiles` z policy innej tabeli jest OK dzięki
--     SECURITY DEFINER — funkcja biegnie z uprawnieniami ownera i pomija
--     RLS w swoim ciele).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin_mgmt()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'management')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_write_role()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN (
        'admin', 'management', 'project_manager',
        'bauleiter', 'logistics', 'purchasing', 'warehouse_manager'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(target_project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = target_project_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_plan_accessible(target_plan_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_plans pp
    JOIN public.project_members pm ON pm.project_id = pp.project_id
    WHERE pp.id = target_plan_id
      AND pm.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin_mgmt()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_write_role()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_plan_accessible(UUID)          TO authenticated;

-- ---------------------------------------------------------------------
-- 2) Drop wszystkich istniejących policy na 11 tabelach (idempotentnie)
-- ---------------------------------------------------------------------

DO $$
DECLARE
  pol RECORD;
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'user_absences',
    'user_locations',
    'warehouse_materials',
    'warehouse_items',
    'project_material_orders',
    'project_tool_orders',
    'project_plans',
    'plan_pins',
    'attachment_folders',
    'task_assignees',
    'company_settings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                     pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3) ENABLE RLS (idempotent)
-- ---------------------------------------------------------------------

ALTER TABLE public.user_absences             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_materials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_material_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tool_orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_pins                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment_folders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings          ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 4) user_absences
--    - SELECT: własne wnioski LUB admin/mgmt
--    - INSERT: własne wnioski LUB admin/mgmt
--    - UPDATE: tylko admin/mgmt (zatwierdzanie / edycja statusu)
--    - DELETE: własne pending LUB admin/mgmt
-- ---------------------------------------------------------------------

CREATE POLICY "user_absences_select" ON public.user_absences
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.current_user_is_admin_mgmt()
  );

CREATE POLICY "user_absences_insert" ON public.user_absences
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.current_user_is_admin_mgmt()
  );

CREATE POLICY "user_absences_update" ON public.user_absences
  FOR UPDATE TO authenticated
  USING (public.current_user_is_admin_mgmt())
  WITH CHECK (public.current_user_is_admin_mgmt());

CREATE POLICY "user_absences_delete" ON public.user_absences
  FOR DELETE TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND status = 'pending')
    OR public.current_user_is_admin_mgmt()
  );

-- ---------------------------------------------------------------------
-- 5) user_locations (GPS, append-only)
-- ---------------------------------------------------------------------

CREATE POLICY "user_locations_select" ON public.user_locations
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.current_user_is_admin_mgmt()
  );

CREATE POLICY "user_locations_insert_self" ON public.user_locations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_locations_admin_delete" ON public.user_locations
  FOR DELETE TO authenticated
  USING (public.current_user_is_admin_mgmt());

-- UPDATE na user_locations świadomie nie jest zdefiniowany — GPS ma być
-- append-only, admin kasuje całe historie jeśli trzeba.

-- ---------------------------------------------------------------------
-- 6) warehouse_materials — read dla wszystkich zalogowanych, write role
-- ---------------------------------------------------------------------

CREATE POLICY "warehouse_materials_select" ON public.warehouse_materials
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "warehouse_materials_write" ON public.warehouse_materials
  FOR ALL TO authenticated
  USING (public.current_user_has_write_role())
  WITH CHECK (public.current_user_has_write_role());

-- ---------------------------------------------------------------------
-- 7) warehouse_items — analogicznie
-- ---------------------------------------------------------------------

CREATE POLICY "warehouse_items_select" ON public.warehouse_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "warehouse_items_write" ON public.warehouse_items
  FOR ALL TO authenticated
  USING (public.current_user_has_write_role())
  WITH CHECK (public.current_user_has_write_role());

-- ---------------------------------------------------------------------
-- 8) project_material_orders — membership projektu + admin/mgmt
-- ---------------------------------------------------------------------

CREATE POLICY "project_material_orders_select" ON public.project_material_orders
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(project_id)
    OR public.current_user_is_admin_mgmt()
  );

CREATE POLICY "project_material_orders_write" ON public.project_material_orders
  FOR ALL TO authenticated
  USING (
    (public.is_project_member(project_id) AND public.current_user_has_write_role())
    OR public.current_user_is_admin_mgmt()
  )
  WITH CHECK (
    (public.is_project_member(project_id) AND public.current_user_has_write_role())
    OR public.current_user_is_admin_mgmt()
  );

-- ---------------------------------------------------------------------
-- 9) project_tool_orders — analogicznie
-- ---------------------------------------------------------------------

CREATE POLICY "project_tool_orders_select" ON public.project_tool_orders
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(project_id)
    OR public.current_user_is_admin_mgmt()
  );

CREATE POLICY "project_tool_orders_write" ON public.project_tool_orders
  FOR ALL TO authenticated
  USING (
    (public.is_project_member(project_id) AND public.current_user_has_write_role())
    OR public.current_user_is_admin_mgmt()
  )
  WITH CHECK (
    (public.is_project_member(project_id) AND public.current_user_has_write_role())
    OR public.current_user_is_admin_mgmt()
  );

-- ---------------------------------------------------------------------
-- 10) project_plans — membership projektu
-- ---------------------------------------------------------------------

CREATE POLICY "project_plans_select" ON public.project_plans
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(project_id)
    OR public.current_user_is_admin_mgmt()
  );

CREATE POLICY "project_plans_write" ON public.project_plans
  FOR ALL TO authenticated
  USING (
    (public.is_project_member(project_id) AND public.current_user_has_write_role())
    OR public.current_user_is_admin_mgmt()
  )
  WITH CHECK (
    (public.is_project_member(project_id) AND public.current_user_has_write_role())
    OR public.current_user_is_admin_mgmt()
  );

-- ---------------------------------------------------------------------
-- 11) plan_pins — dziedziczy z project_plans przez plan_id
-- ---------------------------------------------------------------------

CREATE POLICY "plan_pins_select" ON public.plan_pins
  FOR SELECT TO authenticated
  USING (
    public.is_plan_accessible(plan_id)
    OR public.current_user_is_admin_mgmt()
  );

CREATE POLICY "plan_pins_write" ON public.plan_pins
  FOR ALL TO authenticated
  USING (
    public.is_plan_accessible(plan_id)
    OR public.current_user_is_admin_mgmt()
  )
  WITH CHECK (
    public.is_plan_accessible(plan_id)
    OR public.current_user_is_admin_mgmt()
  );

-- ---------------------------------------------------------------------
-- 12) attachment_folders — membership projektu
-- ---------------------------------------------------------------------

CREATE POLICY "attachment_folders_select" ON public.attachment_folders
  FOR SELECT TO authenticated
  USING (
    public.is_project_member(project_id)
    OR public.current_user_is_admin_mgmt()
  );

CREATE POLICY "attachment_folders_write" ON public.attachment_folders
  FOR ALL TO authenticated
  USING (
    (public.is_project_member(project_id) AND public.current_user_has_write_role())
    OR public.current_user_is_admin_mgmt()
  )
  WITH CHECK (
    (public.is_project_member(project_id) AND public.current_user_has_write_role())
    OR public.current_user_is_admin_mgmt()
  );

-- ---------------------------------------------------------------------
-- 13) task_assignees — widoczność zespołu dla wszystkich; zapis tylko
--                      write roles. Per-task kontrola membership-em
--                      robiona przez policy na `tasks` (poza tą migracją).
-- ---------------------------------------------------------------------

CREATE POLICY "task_assignees_select" ON public.task_assignees
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "task_assignees_write" ON public.task_assignees
  FOR ALL TO authenticated
  USING (public.current_user_has_write_role())
  WITH CHECK (public.current_user_has_write_role());

-- ---------------------------------------------------------------------
-- 14) company_settings — zaostrzona widoczność.
--     UWAGA: tabela zawiera kolumny z plaintext API key (anthropic_api_key,
--     openai_api_key, default_password — patrz migracje 20260413 i
--     add_default_password_to_company_settings). Dlatego SELECT
--     ograniczony jest do admin/mgmt.
--
--     CompanyProvider oraz admin/ai-settings.tsx idą przez proxy
--     (supabaseAdmin → adminApi → Netlify Function), które używa
--     service_role i omija RLS, więc nadal działają dla wszystkich
--     ról (z kontrolą w checkPermission proxy).
--
--     Bezpośrednie zapytania klienta direct-client (anon key + JWT)
--     są blokowane dla nie-admin/mgmt — defense in depth.
--
--     TODO (Faza 7): klucze AI do Netlify env, kolumny plaintext do
--     usunięcia z DB, po tym RLS na company_settings można rozluźnić
--     na read-all-authenticated (tylko company_name + logo_url).
-- ---------------------------------------------------------------------

CREATE POLICY "company_settings_select" ON public.company_settings
  FOR SELECT TO authenticated
  USING (public.current_user_is_admin_mgmt());

CREATE POLICY "company_settings_write" ON public.company_settings
  FOR ALL TO authenticated
  USING (public.current_user_is_admin_mgmt())
  WITH CHECK (public.current_user_is_admin_mgmt());

COMMIT;

-- =====================================================================
-- KONIEC MIGRACJI
-- Po wdrożeniu (`npx supabase db push`) zrobić smoke-test w aplikacji:
--   - login jako worker / bauleiter / admin
--   - w konsoli przeglądarki sprawdzić brak 403 w zakładce Network
--   - jeśli pojawią się 403 spoza proxy — rozszerzyć policy lub
--     zmigrować call do adminApi.
-- =====================================================================
