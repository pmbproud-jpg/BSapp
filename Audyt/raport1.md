# Raport Audytu — BSapp

**Data:** 2026-04-19
**Projekt:** BSapp (Expo + Supabase, cross-platform)
**Lokalizacja:** `~/Desktop/ORGANIZER/Projekty/Aplikacje/BSapp`
**Autor audytu:** Claude (Opus 4.7, 1M context)

---

## 1. Podsumowanie wykonawcze

BSapp to w pełni funkcjonalna aplikacja do zarządzania firmą budowlaną zbudowana w **Expo SDK 54 + React Native 0.81 + React 19**, z backendem **Supabase** i warstwą serverless **Netlify Functions**. Aplikacja obsługuje iOS, Android oraz web (Expo Router typed routes, nowa architektura RN włączona), posiada rozbudowany system uprawnień (10 ról), pełną triadę i18n (DE/PL/EN, po ~1004 linii kluczy) oraz integrację AI (chat, voice report, smart-plan, predictions, OCR-ready).

Codebase jest **dojrzały architektonicznie** — bardzo sprytnie rozwiązano problem Service Role Key przez własny **proxy Netlify Function (`supabase-admin.js`)**, który weryfikuje JWT, sprawdza role i wykonuje operacje admin server-side. Stworzono nawet reimplementację PostgREST query buildera (`src/lib/supabase/adminApi.ts`) jako drop-in replacement dla `supabaseAdmin`.

Niestety, ten wysiłek obniża **jedna kluczowa wada projektowa**: **RLS w migracjach jest w większości `USING (true) WITH CHECK (true)`**, czyli faktycznie wyłączone. Całe bezpieczeństwo opiera się na proxy i `allowlist` tabel. Każdy kto posiada `ANON_KEY` + dowolny ważny JWT (ma go każdy zalogowany pracownik) może pominąć proxy i zapytać bazę bezpośrednio — dostając dostęp do wszystkich 26+ tabel. Ponadto `.env` zawiera `SUPABASE_SERVICE_ROLE_KEY` i `RESEND_API_KEY` w plaintext w katalogu repo (`.env` jest gitignorowany, ale fizycznie leży obok kodu — wysokie ryzyko przypadkowego wrzucenia lub leaku przez backup).

Pozytywy: solidny ErrorBoundary, zero-outage design update flow (expo-updates), newArchEnabled, reactCompiler w eksperymentach, Husky + lint-staged z `tsc --noEmit`, typy `Database` z Supabase, dobrze wydzielone providery (Auth/Theme/Notification/Company) i 24 hooki domenowe. Problemy: brak testów (Jest/Detox), **558 wystąpień `any`** łącznie w `app/` i `src/`, **zero atrybutów accessibility** (0 wystąpień `accessibilityLabel`/`Role`/`Hint` w całym repo), brak FlatList w większości list (użyto `.map()` + `ScrollView` w długich ekranach po 1000–2000 linii), brak realtime mimo że Supabase to oferuje, brak reactQuery/SWR (wszystko ręczne `useState + useEffect`), brak state-managera (4 providery + prop drilling).

**Ocena ogólna: 6.5/10** — działa, cross-platform, bogata funkcjonalnie, ale dług bezpieczeństwa + dług jakości kodu wymagają planowej spłaty.

---

## 2. Stack i architektura

### Stack

- **Framework:** Expo SDK **54.0.33** (cyfrowo — `~54.0.33`, ostatni release tej linii), React Native **0.81.5**, React **19.1.0**
- **Router:** Expo Router **~6.0.23** z `experiments.typedRoutes: true` i `experiments.reactCompiler: true` ([`app.json:54-56`](../app.json))
- **Backend:** Supabase (`@supabase/supabase-js ^2.94.0`) — Postgres + Auth + Storage
- **i18n:** i18next **25.8.1** + react-i18next **16.5.4** + expo-localization **17.0.8**, 3 locale po 1004 linii
- **State:** Context API (4 providery, zero reactQuery/Zustand/Jotai), bez mutacji optimistic
- **Animacje/gesty:** react-native-reanimated **4.1.1**, react-native-gesture-handler **2.28.0**, react-native-worklets **0.5.1**
- **Serverless:** Netlify Functions (6 funkcji: `supabase-admin`, `ai-chat`, `ai-report`, `ai-smart-plan`, `ai-voice-report`, `send-email`)
- **Build/Update:** EAS Updates (`runtimeVersion.policy: appVersion`), projectId `fa4d1e6d-...`
- **TypeScript:** `5.9.2`, `strict: true`, `paths: { "@/*": "./*" }`
- **Native:** `newArchEnabled: true` (Fabric + TurboModules), `edgeToEdgeEnabled: true` (Android), `predictiveBackGestureEnabled: false`

### Architektura warstw

```
┌──────────────────────────────────────────────────────────────┐
│ app/ (Expo Router — file-based, 40 .tsx, 8323 LOC top-7)     │
│   _layout.tsx → ErrorBoundary → Providers → Stack            │
│   (app)/_layout.tsx → Tabs + GPS tracking hook               │
│   (app)/admin/* (5 ekranów), projects, tasks, users, ai-chat │
└────────────┬─────────────────────────────────────────────────┘
             │
┌────────────┴─────────────────────────────────────────────────┐
│ src/                                                          │
│  providers/ (Auth, Theme, Notification, Company)              │
│  hooks/     (24 hooki domenowe)                               │
│  lib/supabase/ (client.ts, adminApi.ts proxy, types)          │
│  i18n/      (de/pl/en.json + setLanguage → AsyncStorage)      │
│  services/  (profileService, …)                               │
│  utils/     (dateFormatter, exportData, helpers)              │
└────────────┬─────────────────────────────────────────────────┘
             │                                     │
┌────────────▼───────────┐            ┌────────────▼──────────┐
│ Supabase (bezpośrednio)│            │ Netlify Functions     │
│ – anon key             │            │ – service role key    │
│ – auth, RLS*           │            │ – JWT verify          │
└────────────────────────┘            │ – role check          │
                                       │ – ALLOWED_TABLES set  │
                                       └───────────────────────┘
```
\* RLS w 90% tabel to `USING (true)` — czyli de facto wyłączone (szczegóły w 4.🔴).

---

## 3. Mocne strony

1. **Secure admin proxy** — [`netlify/functions/supabase-admin.js`](../netlify/functions/supabase-admin.js) weryfikuje JWT (anon client), pobiera rolę z `profiles`, sprawdza `checkPermission()`, dopuszcza tylko allowlisted tabele/akcje/buckety. Bardzo dobra architektura security boundary.
2. **Drop-in query builder** — [`src/lib/supabase/adminApi.ts`](../src/lib/supabase/adminApi.ts) reimplementuje PostgREST builder (`eq`, `in`, `like`, `or`, `contains`, `match`, `range`, `order`, `limit`, `single`, chained `.insert().select()`) — migracja z `supabaseAdmin` była bezbolesna.
3. **ErrorBoundary w root layout** — [`app/_layout.tsx:13-42`](../app/_layout.tsx) łapie błędy React i pokazuje recoverable UI zamiast białego ekranu. Bardzo rzadko widziane w Expo projektach.
4. **Persystencja języka + fallback** — [`src/i18n/index.ts:23-34`](../src/i18n/index.ts) — device locale → AsyncStorage → fallback `de`. Dobre UX dla niemieckiego rynku B2B.
5. **Typed routes + newArchEnabled + reactCompiler** — projekt gotowy na Fabric i automatyczny memoization z kompilatora React (eksperyment, ale już produktywny).
6. **Bogaty system ról** — 10 ról w `RoleName`, [`src/hooks/usePermissions.ts:31-86`](../src/hooks/usePermissions.ts) — matryca uprawnień + override per-user przez `custom_permissions jsonb`. Bardzo elastyczne.
7. **ErrorBoundary + UpdateChecker + SafeAreaProvider** — pełny boilerplate produkcyjny.
8. **Husky + lint-staged** — pre-commit uruchamia `tsc --noEmit --skipLibCheck` ([`.lintstagedrc.js:1-3`](../.lintstagedrc.js), [`.husky/pre-commit`](../.husky/pre-commit)) — typy są weryfikowane przed każdym commitem.
9. **Migracja od bezpośredniego Service Role Key** — historia CLAUDE.md pokazuje świadomość security i refaktoryzacja z `supabaseAdmin` → `adminApi` proxy została zrobiona dobrze i konsekwentnie (37 plików), pozostał jedynie deprecated re-export w [`adminClient.ts:12-15`](../src/lib/supabase/adminClient.ts) dla backward-compat.
10. **Integracja AI** — 5 ekranów AI-powered (`ai-chat`, `voice-report`, `smart-plan`, `predictions`, `auto-report`) + hooki + Netlify Functions. Stack AI na poważnie, nie zabawka.

---

## 4. Problemy znalezione

### 🔴 Krytyczne

#### K1. RLS otwarte „USING (true)" na wszystkich głównych tabelach
W 14 plikach migracji policy są `FOR ALL USING (true) WITH CHECK (true)` albo `FOR SELECT USING (true)` etc. Dotyczy m.in.:
- [`supabase/migrations/20260218_user_absences.sql:36`](../supabase/migrations/20260218_user_absences.sql) → `FOR ALL USING (true) WITH CHECK (true)`
- [`supabase/migrations/20260218_gps_tracking.sql:31`](../supabase/migrations/20260218_gps_tracking.sql) → to samo
- [`supabase/migrations/20260211090000_warehouse_materials.sql:25-37`](../supabase/migrations/20260211090000_warehouse_materials.sql) → 4× open
- [`supabase/migrations/20260211093000_project_material_orders.sql:24-36`](../supabase/migrations/20260211093000_project_material_orders.sql)
- [`supabase/migrations/20260218_project_plans_and_pins.sql:56-64`](../supabase/migrations/20260218_project_plans_and_pins.sql)
- `create_attachment_folders.sql`, `create_task_assignees.sql`, `project_tool_orders.sql`, `create_company_settings.sql`

**Ryzyko:** każdy zalogowany użytkownik (nawet `worker` lub `subcontractor`) może z poziomu klienta (lub z Postmana używając ANON_KEY + własnego JWT) wykonać `supabase.from("profiles").select("*")` i pobrać hasła, emaile, `custom_permissions` wszystkich użytkowników. Proxy nie jest zabezpieczeniem — jest wygodą. **Prawdziwe security leży wyłącznie po stronie frontu**, co jest antywzorcem Supabase.

**Fix:** dla każdej tabeli dodać policy opartą na `auth.uid()` oraz rolach (`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN (...))`). Dla `user_absences`: `user_id = auth.uid() OR admin/management`. Dla `warehouse_*`: sprawdź rolę. Dla `project_*`: membership.

#### K2. `SUPABASE_SERVICE_ROLE_KEY` i `RESEND_API_KEY` w pliku `.env` w repo
[`.env:7-8`](../.env) zawiera:
```
SUPABASE_SERVICE_ROLE_KEY=sb_secret_<REDACTED — do rotacji>
RESEND_API_KEY=re_<REDACTED — do rotacji>
```
`.env` jest w `.gitignore`, ale plik fizycznie leży obok kodu, jest w kopii zapasowej `BSapp.zip`, jest indeksowany przez IDE/cloud sync (OneDrive — widoczny w `C:/Users/mbak/Desktop/ORGANIZER/...`). **Service Role Key omija RLS w ogóle**, daje pełen dostęp do bazy. **Te klucze muszą zostać zrotowane natychmiast** (Supabase Dashboard → API → Rotate, Resend → API keys → revoke). Po rotacji trzymać wyłącznie w Netlify Env Variables.

#### K3. 314 `any` w katalogu `app/` + 244 w `src/` = 558 łącznie przy `strict: true`
Przykłady: [`tasks/[id].tsx:46`](../app/(app)/tasks/[id].tsx), [`projects/[id].tsx:29`](../app/(app)/projects/[id].tsx), [`plan.tsx:16`](../app/(app)/plan.tsx), [`useUsersManagement.ts:21`](../src/hooks/useUsersManagement.ts), [`usePlanData.ts:38`](../src/hooks/usePlanData.ts). W dashboardzie typy lecą w dziki: `useState<any[]>([])` (np. [`tasks/[id].tsx:58-60`](../app/(app)/tasks/[id].tsx) — `users`, `planUsers`, `projectUsers` jako `any[]`).

**Ryzyko:** runtime crashe po zmianach schematu bazy, brak IntelliSense, brak refaktoryzacji. `strict: true` w `tsconfig.json` niczego nie chroni, bo `any` go wyłącza lokalnie.

**Fix:** docelowo **eslint-plugin-@typescript-eslint** z regułą `no-explicit-any: error` (obecnie ESLint to tylko `expo-config`), typować wszystkie hooki generykami z `Database["public"]["Tables"][T]["Row"]`, dla odpowiedzi z `supabaseAdmin` zastosować `z.infer<typeof schema>` (Zod).

### 🟠 Wysokie

#### W1. Architektura „multi-tenant" tak naprawdę jest single-tenant
[`CompanyProvider.tsx:43-46`](../src/providers/CompanyProvider.tsx) pobiera `.from("company_settings").select("...").limit(1).single()` — istnieje **jeden wpis** w `company_settings`. Kolumna `company_id` jest w `profiles` (`database.types.ts:6`) i w kilku tabelach, ale nie ma ani filtra RLS po `company_id`, ani przekazania `company_id` w większości insertów. Jeśli projekt ma kiedyś zarządzać kilkoma firmami (Swish, PMB Proud, klient N), to trzeba przebudować model.

**Fix:** dodać `company_id UUID NOT NULL REFERENCES companies(id)` do każdej tabeli domenowej, zainicjować policy `USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()))`, dodać `company_id` do każdego INSERT w hookach.

#### W2. Ekrany-monolity: `projects/[id].tsx` **1963 LOC**, `tasks/[id].tsx` **1473**, `magazyn.tsx` **1404**, `users/index.tsx` **1034**, `settings.tsx` **963**, `plan.tsx` **918**
Suma top-7 plików to **8323 linii**. Każdy zawiera: logikę stanu + fetch + mutacje + mapowania + style. Renderowanie jest przez `.map()` + `ScrollView` (nie FlatList) w listach mogących mieć 100+ elementów — brak virtualizacji.

**Fix:** 1) wydzielić sekcje na `components/projects/ProjectHeader`, `ProjectTasksList`, `ProjectAttachments`, `ProjectPins`, 2) listy renderowane `.map()` zamienić na `FlatList` (lub `FlashList` v2 od Shopify w 2026 — 60 FPS nawet z 1000+ items), 3) logikę fetchowania wynieść do hooków (częściowo już jest w `useProjectData`, `useProjectEdit`, `useProjectMembers`, ale sporo nadal w `.tsx`).

#### W3. Brak testów (Jest, Detox, Playwright, Vitest)
`package.json` nie zawiera ani `jest`, ani `@testing-library/react-native`, ani `detox`. Przy 40 ekranach, 24 hookach, systemie uprawnień z 10 rolami i 50+ uprawnieniami — **zero regresji jest nie do wychwycenia automatycznie**. CLAUDE.md odnotowuje historię ręcznego audytu (2026-02-19), co potwierdza brak CI-testów.

**Fix:** minimum `jest` + `@testing-library/react-native` dla hooków (`usePermissions` — test matrycy ról), następnie Detox e2e dla krytycznych flow: login, create project, create task, assign, comment, upload attachment.

#### W4. Listy bez `FlatList` (tylko 8 plików używa FlatList)
[`app/(app)/tasks/index.tsx`](../app/(app)/tasks/index.tsx), [`users/index.tsx`](../app/(app)/users/index.tsx), [`projects/index.tsx`](../app/(app)/projects/index.tsx) — OK. Ale `magazyn.tsx` (1404 LOC), `plan.tsx` (918 LOC), `absences.tsx`, `notifications.tsx` mają listy przez `.map()` w `ScrollView` — **387 occurrences** `FlatList|ScrollView|.map(` sygnalizuje masowy problem na web i na słabszych Androidach (brak virtualizacji = cały layout recompiluje przy każdym state update).

#### W5. Realtime nieużywany mimo że Supabase to zapewnia
Grep `realtime|subscribe|postgres_changes|channel` = **1 match** (AuthProvider, dla `onAuthStateChange`). W firmie budowlanej (wielu użytkowników edytuje zadania, komentarze, statusy, magazyn w tym samym czasie) brak realtime powoduje desynchronizacje — stąd `setInterval(fetchProfile, 60_000)` w [`AuthProvider.tsx:128`](../src/providers/AuthProvider.tsx).

**Fix:** `supabase.channel('tasks').on('postgres_changes', {...}).subscribe()` — oraz invalidate TanStack Query keys (gdy wprowadzisz TQ).

### 🟡 Średnie

#### S1. Brak atrybutów accessibility
Grep `accessibilityLabel|accessibilityRole|accessibilityHint` w całym repo = **0 matches**. Komponenty `TouchableOpacity`, `Pressable`, ikony, inputy bez etykiet dla VoiceOver/TalkBack. Niemiecki rynek ma **BGG / BITV** (ustawa o dostępności cyfrowej od 2025 dla B2B również) — dla PM i zarządu to wymóg prawny.

**Fix:** do każdego interaktywnego elementu dodać `accessibilityLabel={t("...")}` i `accessibilityRole="button"`, ikonom `accessibilityHidden={true}`. Do Inputa powiązać `accessibilityLabelledBy`.

#### S2. Brak bibliotek zarządzania stanem server-side (TanStack Query / SWR)
Każdy hook `useXxxData` trzyma własny `useState` + `useEffect` + ręczne `setLoading`/`setRefreshing` + brak deduplikacji + brak cache per-key + brak invalidation + brak `staleTime`. Zobacz wzorce [`useDashboardData.ts:28-80`](../src/hooks/useDashboardData.ts) — klasyczny ręczny fetch z 2019 roku.

**Fix:** migracja do **TanStack Query v5** (w 2026 de facto standard dla RN) — `useQuery`, `useMutation`, `useInfiniteQuery`, optimistic updates. Zmniejszy kod hooków o ~30%, doda cache, retry, deduplikację, invalidation po mutacjach, devtools.

#### S3. Auto-refresh profilu co 60 s zamiast realtime
[`AuthProvider.tsx:126-132`](../src/providers/AuthProvider.tsx) — `setInterval(fetchProfile, 60_000)`. Drenuje baterię i API quota. Zamiast tego `supabase.channel('profile_changes').on('postgres_changes', { table: 'profiles', filter: ... })`.

#### S4. Brak `returnKeyType`, brak keyboard dismiss, brak autoFocus flow w formularzach
`login.tsx` ma dwa `TextInput` — brak `returnKeyType="next"`, `onSubmitEditing`, `blurOnSubmit`, ani `inputAccessoryView`.

#### S5. Emoji w `login.tsx` zamiast ikon Ionicons
[`login.tsx:137`](../app/login.tsx) — `{showPassword ? "🙈" : "👁"}`. Niespójne z resztą aplikacji (gdzie są Ionicons). Problemy z fontem systemowym, zmianą platformy, accessibility (screen reader czyta „małpa z zakrytymi oczami").

#### S6. `expo-av` w zależnościach — ale w SDK 53+ jest deprecated
[`package.json:25`](../package.json) — `"expo-av": "^16.0.8"`. `expo-av` został podzielony na `expo-video` i `expo-audio`. Przy upgrade do SDK 55+ trzeba zmigrować.

#### S7. `storage` custom dla web zamiast `localStorage: window.localStorage`
[`client.ts:11-24`](../src/lib/supabase/client.ts) — ręczny wrapper. Można po prostu nie przekazywać `storage` na webie, `@supabase/supabase-js` domyślnie używa `localStorage`.

#### S8. `initialFetchDone` race condition w AuthProvider
[`AuthProvider.tsx:41-69`](../src/providers/AuthProvider.tsx) — zmienna lokalna `initialFetchDone` jest ustawiana w callbacku `getSession().then()`, ale `onAuthStateChange` odpala się natychmiast z eventem `INITIAL_SESSION` (od Supabase v2.58+), więc warunek `if (initialFetchDone && fetchingRef.current) return` może przeciekać. Uproszczenie: użyć tylko `onAuthStateChange` + `getSession()` tylko jako fallback.

### 🔵 Niskie

#### N1. Niespójna walidacja inputów
`login.tsx:52` — `if (!e || !password)` — tylko truthy check. Brak walidacji długości, formatu emaila (co prawda `keyboardType="email-address"` ale nie validator), brak policy siły hasła (project_manager mógłby ustawić hasło `1`). Projekt nie używa `zod`/`yup`.

#### N2. Hardcoded kolory w `_layout.tsx` (tabBar) vs `ThemeProvider`
Mimo że jest `ThemeProvider`, niektóre kolory w `StyleSheet.create` w [`app/(app)/_layout.tsx:272-359`](../app/(app)/_layout.tsx) są hardcoded (`#e2e8f0`, `#1e293b`, `#64748b`, `#ef4444`). Nie zmienią się w dark mode.

#### N3. `limit: 250` jest default przy grep — zwracam uwagę, że w codebase są pliki > 1000 linii, co zatyka DX
Radzę dzielić pliki > 400 linii.

#### N4. Brak `Sentry`/`LogRocket`/`Bugsnag`
Crashe są łapane ErrorBoundary i `console.error` — nie trafiają nigdzie. Brak monitoringu produkcji. Brak źródeł map.

#### N5. `BSapp.zip` w repo (1.6 MB, luty 2025)
Zip nie powinien być obok kodu — `.gitignore` go ignoruje, ale fizycznie leży.

#### N6. 3 identyczne pliki locale po 1004 linie — brak weryfikacji jakości tłumaczeń
Fakt że pl/en/de mają **dokładnie** tyle samo linii jest podejrzany (ok, może automatyczny sync) — ale brakuje narzędzia typu `i18next-parser` do detekcji missing keys w CI. Skrypty `verify_translations.py` zostały usunięte (CLAUDE.md).

#### N7. Brak `precommit` formattera (Prettier) — tylko `tsc`
Style formatowania zależne od IDE autora commitu. Dodać Prettier → lint-staged.

#### N8. `runtimeVersion.policy: appVersion` vs EAS Updates
Przy każdej zmianie `version` w `app.json` tracisz kompatybilność OTA — bezpiecznie, ale ograniczające. Rozważ `fingerprint` policy (Expo SDK 52+).

#### N9. Brak Edge Functions — wszystkie funkcje AI są na Netlify
Supabase **Edge Functions** (Deno) byłyby bliżej bazy (mniej latency), miały natywny dostęp do `auth.getUser()` przez `SUPABASE_AUTH_SERVICE_ROLE`. Obecna architektura płaci 200–500 ms za każdy round-trip Netlify → Supabase.

---

## 5. Propozycje rozbudowy 2026

### R1. AI Claude Context-Aware Assistant (w oparciu o Claude 4.5/4.7 Opus)
Zastąp `ai-chat.js` integracją z Claude API z **prompt caching** i **extended thinking**. Pipeline:
1. Claude dostaje w kontekście: aktywne projekty (top 5), zadania użytkownika (top 20), ostatnie dokumenty (3).
2. Prompt caching (ephemeral, 1 h) na system prompt + schemat bazy — 90% tokenów to cache hit → ~10× taniej.
3. Tool use: `get_project(id)`, `create_task(...)`, `assign_worker(...)` — asystent może realnie zmieniać bazę przez proxy (audit log!).
4. Streaming odpowiedzi do `ai-chat.tsx`.
5. Model routing: prosta query → Haiku 4.5 (tanio), złożona → Sonnet 4.5, planowanie strategiczne → Opus.

### R2. OCR faktur + WDT + Lieferschein (niemieckie dokumenty dostawy)
Integracja **Claude Vision** lub **Mistral OCR**: pracownik robi zdjęcie faktury/Lieferschein → Netlify Function → ekstrakcja: NIP/USt-IdNr, kwoty netto/VAT/brutto, pozycje materiałów → match do `warehouse_materials` (fuzzy match po nazwie + jednostce) → auto-entry do `project_material_orders`. ROI: 20 minut/dzień na osobę × liczba bauleiter.

### R3. Realtime collab + presence (Supabase Realtime v2)
`channel.presence` dla „kto ogląda ten projekt/zadanie teraz", `channel.broadcast` dla typing indicators w komentarzach, `postgres_changes` dla auto-invalidate TQ cache. Daje realne poczucie teamwork zamiast „F5 co 60 s".

### R4. Voice-to-Task na placu budowy (Whisper + Claude)
Rozszerzenie `voice-report.tsx`: pracownik mówi „Dodaj zadanie: wymienić 5 gniazdek w pokoju 2, priorytet wysoki, przypisz Kowalski, termin piątek", Whisper → transkrypcja → Claude z tool_use `create_task(...)` → bezpośredni insert. Niesłychanie efektywne dla pracowników fizycznych, którzy nie chcą klikać formularzy w rękawicach.

### R5. Push notifications bus + Scheduled Reports (EAS Push + cron)
Obecnie tylko in-app notifications. Dodać:
1. `expo-notifications` + `expo-device` → token w `profiles.expo_push_token`.
2. Netlify Scheduled Function (cron) → codziennie 7:00 wysyła „Twoje zadania na dziś" (push + email via Resend).
3. Realtime trigger w Supabase (database webhook) na INSERT `tasks WHERE assigned_to = user` → natychmiastowy push.
4. Bauleiter dostaje raport dzienny via Claude: „dziś zakończono X zadań, opóźnione Y, rekomendacja Z".

---

## 6. Prompt naprawczy (ready-to-paste)

```text
Jesteś senior engineer pracującym nad BSapp (Expo SDK 54 + React Native 0.81 +
Supabase + Netlify Functions + TypeScript strict). Kontekst w CLAUDE.md projektu.
Napraw w dokładnie tej kolejności, commitując po każdym kroku:

1. [SEC] Zrotuj SUPABASE_SERVICE_ROLE_KEY i RESEND_API_KEY w Supabase/Resend
   dashboard, usuń je z .env (pozostaw tylko EXPO_PUBLIC_*), dodaj .env do
   .gitignore (już jest — sprawdź) oraz utwórz .env.example bez wartości.

2. [SEC] Przepisz RLS w migracjach dla user_absences, warehouse_materials,
   warehouse_items, project_material_orders, project_tool_orders,
   project_plans, plan_pins, attachment_folders, task_assignees,
   gps_tracking, company_settings. Usunąć "USING (true)", zastąpić
   - SELECT: auth.uid() IS NOT NULL AND (user_id = auth.uid() OR
     EXISTS(SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN
     ('admin','management')) OR EXISTS(SELECT 1 FROM project_members pm WHERE
     pm.project_id = projects.id AND pm.user_id = auth.uid()))
   - INSERT/UPDATE/DELETE: analogicznie z przepuszczaniem admin/management
   Nowa migracja: supabase/migrations/20260419_harden_rls.sql. Test: zalogować
   się jako worker, sprawdzić że nie widzi profili innych, NIE może modyfikować
   warehouse bez roli. Commit: "chore(security): harden RLS on 11 tables".

3. [TS] Dodaj eslint-plugin @typescript-eslint + reguła no-explicit-any: "error"
   (tymczasowo warn) do eslint.config.js. Zaczynaj od src/hooks/usePlanData.ts
   (38 any) i src/hooks/useUsersManagement.ts (21 any) — typuj przez
   Database["public"]["Tables"][T]["Row"]. Commit po każdym pliku.

4. [TS] Dodaj zod + schematy dla odpowiedzi adminApi w
   src/lib/supabase/schemas/*.ts. Validate w _execute() w adminApi.ts.

5. [PERF] Zamień .map() w ScrollView na FlatList w plan.tsx (918 LOC),
   magazyn.tsx (1404 LOC), absences.tsx, notifications.tsx. keyExtractor,
   initialNumToRender=10, maxToRenderPerBatch=5, windowSize=10,
   removeClippedSubviews (Android). Rozważ migrację na @shopify/flash-list v2.

6. [PERF] Rozbij projects/[id].tsx (1963 LOC) na: ProjectHeader, ProjectTabs,
   ProjectOverview, ProjectTasks, ProjectAttachments, ProjectPins,
   ProjectMembers. Każdy <300 LOC. Ten sam zabieg na tasks/[id].tsx.

7. [STATE] Dodaj @tanstack/react-query v5. Konfiguracja w app/_layout.tsx:
   QueryClient + QueryClientProvider. Migruj useDashboardData jako pierwszy:
   useQuery(['dashboard-stats', profileId], fetchStats). Invalidate po
   mutacjach. staleTime: 30_000. Commit: "feat: migrate dashboard to TQ v5".

8. [REALTIME] Włącz Supabase realtime dla tasks, task_comments, notifications.
   W useDashboardData subskrybuj channel, invalidateQueries przy postgres_changes.
   Usuń setInterval(fetchProfile, 60_000) z AuthProvider — zastąp realtime.

9. [A11Y] Dodaj accessibilityLabel / accessibilityRole do: wszystkich
   TouchableOpacity, Pressable, TextInput, Image. Dla ikon Ionicons dodać
   importantForAccessibility="no". Lintuj eslint-plugin-react-native-a11y.

10. [TEST] Setup Jest + @testing-library/react-native. Pierwszy test:
    src/hooks/__tests__/usePermissions.test.ts — matryca 10 ról × 50 uprawnień.
    Potem Detox e2e: login, create project, create task, assign, comment.

11. [MONITORING] Sentry React Native SDK z dsn w EAS secrets. Source maps
    upload przez EAS Build hooks. Tag release = appVersion.

Zasady:
- Każda zmiana: nowy commit.
- Każdy commit: passuje tsc --noEmit + eslint.
- Przy zmianie schematu bazy: aktualizuj src/lib/supabase/database.types.ts
  przez `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.
- Testy > 0 (zacznij od usePermissions).
- Commit message w konwencji: feat|fix|chore|refactor(scope): krótki opis.
- Nie dotykaj adminApi.ts query buildera — działa, nie psuj.
```

---

## 7. Roadmapa priorytetów

| Faza | Czas | Zakres |
|------|------|--------|
| **Faza 0 — Security lockdown** | 1–2 dni | Rotacja kluczy, RLS hardening (11 tabel), audyt dostępu, .env.example |
| **Faza 1 — Typy i lint** | 3–4 dni | `no-explicit-any`, zod na adminApi, refactor 5 hooków z największą ilością `any`, eslint-plugin-react-native-a11y |
| **Faza 2 — Performance** | 1 tydzień | Rozbicie 3 ekranów-monolitów (`projects/[id]`, `tasks/[id]`, `magazyn`), FlatList/FlashList, lazy load obrazów (`expo-image` już jest, ale bez `contentFit`, `placeholder`, `transition`) |
| **Faza 3 — Data layer** | 1 tydzień | TanStack Query v5, migracja hooków (`useDashboardData`, `usePlanData`, `useProjectData`, `useWarehouseMaterials`), realtime dla tasks/notifications/comments |
| **Faza 4 — Testy + CI** | 1 tydzień | Jest + RTL, testy `usePermissions`, smoke e2e Detox (login + CRUD), GitHub Actions / Netlify CI: `tsc && eslint && jest` |
| **Faza 5 — A11y + monitoring** | 3–4 dni | accessibility audit, Sentry integration, source maps, crash alerts do Slacka/Discord |
| **Faza 6 — Multi-tenant** | 2 tygodnie | `company_id` wszędzie, migracja danych, RLS per-company, onboarding nowej firmy UI, Owner/Admin/Member model |
| **Faza 7 — AI+OCR+Realtime** | 3–4 tygodnie | Claude API z caching + extended thinking, OCR faktur (Claude Vision), voice-to-task, push notifications bus, scheduled daily reports |
| **Faza 8 — Expo upgrade** | 1 tydzień | SDK 54 → 55 → 56 (migracja `expo-av` → `expo-video`+`expo-audio`, weryfikacja reanimated 4, tests pass, EAS build verify) |

Łącznie ~10 tygodni solo dev przy 6 h/dzień. Z parą: ~6 tygodni.

---

## 8. Źródła (web search)

**Uwaga techniczna audytu:** w środowisku wykonania tego audytu narzędzia `WebSearch` oraz `WebFetch` były zablokowane przez sandbox (Permission denied). Nie udało się przeprowadzić aktualnego w czasie rzeczywistym wyszukiwania internetowego. Poniższe źródła wskazuję z wiedzy zastanej do stycznia 2026 (cutoff modelu) — są to oficjalne, długofalowo stabilne adresy dokumentacji/changelogów. **Przed podjęciem decyzji technicznych na bazie tego raportu zalecam autorowi ręczne potwierdzenie aktualnego stanu tych źródeł.**

- [Expo Changelog — SDK releases](https://expo.dev/changelog) — oficjalny changelog SDK 54/55/56/57 (w cutoff znane: SDK 54 październik 2025, SDK 55 planowane Q1 2026 — zmiany w New Architecture, React 19.2, migracja `expo-av` → `expo-audio`+`expo-video`)
- [React Native Releases](https://github.com/facebook/react-native/releases) — RN 0.81 (październik 2025), 0.82 (roadmapa styczeń 2026 — stabilizacja Bridgeless mode, hardware-accelerated gestures)
- [Supabase Blog](https://supabase.com/blog) — realtime v2 (broadcast + presence scaling), Edge Functions (Deno 2.x), pgvector hybrid search, RLS policies performance guide
- [Expo Router v6 docs](https://docs.expo.dev/router/introduction/) — typedRoutes stable w SDK 54, `expo-router` v6 z layout groups, `Stack.Protected`, server components beta
- [TanStack Query v5 docs](https://tanstack.com/query/v5) — offline-first, suspense query, infinite query improvements
- [React Native Reanimated 4](https://docs.swmansion.com/react-native-reanimated/) — CSS-like animations, nowy `.animate()` API, shared transitions v2
- [Shopify FlashList v2](https://shopify.github.io/flash-list/) — 60 FPS dla >10k items, drop-in replacement FlatList
- [Legend State v3](https://legendapp.com/open-source/state/) — fine-grained reactivity, 4 KB, alternatywa dla Zustand/Jotai w RN 2026
- [React Native Skia](https://shopify.github.io/react-native-skia/) — 2D graphics, Canvas API, GPU accelerated
- [Anthropic Claude API — Prompt Caching & Extended Thinking](https://docs.claude.com/en/api/messages) — ephemeral caching (5 min / 1 h), extended thinking budget tokens, tool_use for agentic flows
- [Supabase RLS Best Practices 2026](https://supabase.com/docs/guides/auth/row-level-security) — pattern `(SELECT auth.uid())` vs `auth.uid()` dla wydajności, security definer functions
- [OWASP Mobile Top 10 2024](https://owasp.org/www-project-mobile-top-10/) — M2 Inadequate Supply Chain Security, M9 Insecure Data Storage

---

**Koniec raportu.**
