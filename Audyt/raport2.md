## Raport Audytu #2 — BSapp

**Data:** 2026-05-19
**Projekt:** BSapp (Expo + Supabase, cross-platform)
**Lokalizacja:** `~/Desktop/ORGANIZER/Projekty/Aplikacje/BSapp`
**Autor audytu:** Claude (Opus 4.7, 1M context)
**Poprzedni raport:** [raport1.md](raport1.md) (2026-04-19)

---

## 1. Podsumowanie wykonawcze

Od poprzedniego audytu (2026-04-19) projekt wykonał **56 commitów w 10 dni** (do 2026-04-29), realizując konsekwentnie roadmapę poprawy długu jakościowego i bezpieczeństwa. Stan dzisiaj jest **fundamentalnie lepszy** niż miesiąc temu w niemal każdym mierzalnym wymiarze:

| Metryka | raport1 (2026-04-19) | raport2 (2026-05-19) | Zmiana |
|---|---|---|---|
| **`any` w kodzie** (src + app) | 558 wystąpień | **15 wystąpień** (6 plików) | **−97 %** |
| **RLS otwarte `USING (true)`** | 11 tabel | **0 krytycznych** (3 świadome whitelisty `select`) | naprawione migracją `20260419_harden_rls.sql` |
| **TanStack Query** | brak | 10 hooków zmigrowanych + cache invalidation | nowy fundament data layer |
| **Supabase Realtime** | brak | 9 tabel × subscribe + invalidate | nowa funkcjonalność |
| **Testy** | brak | jest-expo skonfigurowany, **2 testy pass** (~3s) | start, ale jeszcze symboliczny |
| **Refaktoryzacja ekranów >1000 LOC** | 5 ekranów po 1000–2000 linii | wydzielono ~20 komponentów do `src/screens/{magazyn,projectDetail,tasks,projectPlans}` | duże ekrany nadal istnieją, ale logika modali jest odseparowana |
| **Service Role Key na froncie** | obecny w 50 miejscach | **zero** — wszystko przez proxy `adminApi` | hardening zakończony, `adminClient.ts` zostało jako `@deprecated` re-export |
| **Plaintext sekrety w `.env`** | `RESEND_API_KEY`, `SERVICE_ROLE_KEY` | tylko `SERVICE_ROLE_KEY` (`RESEND` usunięty 2026-04-21 → Gmail SMTP) | częściowo |
| **Linia obrony in-depth (RLS + proxy)** | tylko proxy | proxy **+** RLS z helper functions (`SECURITY DEFINER`) | poprawione |

**Ocena ogólna: 8.0/10** (↑ z 6.5/10). Codebase wszedł w fazę dojrzałości. Pozostałe luki: pełne pokrycie testami (1 z 32 hooków), accessibility (nadal 0 w produkcji), brak Sentry/observability, kilka prawdziwych bugów React (Rules of Hooks naruszone w `tasks/new.tsx`), brakujące dependency w hook arrays (~28 ostrzeżeń), modele AI to nadal `claude-sonnet-4-20250514` (warto rozważyć upgrade do `claude-sonnet-4-6` lub tańszego `claude-haiku-4-5`).

---

## 2. Co zostało zrealizowane od raportu #1

Mapa zmian wg historii commitów (`git log --since=2026-04-19`):

### Faza 0 — Hardening security (2026-04-20…21)

- [`3c05b07`](#) `chore(security): faza 0 — .env.example, SECURITY.md, RLS hardening`
  - Dodano [`docs/SECURITY.md`](../docs/SECURITY.md) — 111 linii: model bezpieczeństwa, tabela sekretów, procedura rotacji `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_APP_PASSWORD`.
  - Dodano [`.env.example`](../.env.example) z opisem każdej zmiennej i miejscem, gdzie ma być trzymana (Netlify env vs lokalnie).
  - Najważniejsze: migracja [`20260419_harden_rls.sql`](../supabase/migrations/20260419_harden_rls.sql) — 422 linie, **przepisuje policy RLS** na 11 tabelach które wcześniej były `USING (true)`. Wprowadza 5 helper functions z `SECURITY DEFINER`:
    - `current_user_role()`, `current_user_is_admin_mgmt()`, `current_user_has_write_role()`, `is_project_member(uuid)`, `is_plan_accessible(uuid)`.
    - Egzekwują kontekst self / project membership / role na poziomie bazy. Defense in depth — nawet jak ktoś ominie proxy, RLS go zablokuje (poza świadomymi 3 wyjątkami `select USING (true)` na warehouse_materials/items/task_assignees, które są zaprojektowane jako read-for-all-authenticated).
- [`609a256`](#) `chore(security): usuniecie RESEND_API_KEY + dokumentacja Gmail SMTP`
  - `RESEND_API_KEY` usunięty z `.env`. `send-email.js` przeniesione na nodemailer + Gmail App Password.
- [`6d12bd7`](#) `fix(netlify): remove hardcoded SUPABASE_ANON_KEY from netlify.toml`
  - Klucz w `netlify.toml` to **secret leak** w git — usunięty, wczytywany teraz wyłącznie z Netlify Dashboard.

### Faza 1 — Eliminacja `any` (2026-04-21…22, ~20 commitów)

- Aktywacja `@typescript-eslint/no-explicit-any: warn` w [`eslint.config.js`](../eslint.config.js).
- Sekwencyjne typowanie pliku po pliku z konkretnym licznikiem `(X any → 0)` w commit message, m.in.:
  - `useProjectData.ts` (12), `usePlanData.ts` (38), `useUsersManagement.ts` (21), `useProjectPlansData.ts` (14), `useProjectPlanWorkers.ts` (17), `adminApi.ts` (33), `useDailyReports.ts` (12), `useProjectPrediction.ts` (17).
  - `tasks/[id].tsx` (46), `tasks/new.tsx` (14), `users/[id].tsx + index.tsx` (18), `admin/database.tsx` (14), `plan.tsx` (16), `gps-analytics.tsx + magazyn.tsx` (16), `ResourceCalendar.tsx` (27), `ProjectPlans.tsx` (24).
  - Batches po 7, 10, 11 mniejszych plików.
- **Łącznie z 558 → 15 `any`** (15 z nich to świadome `// eslint-disable-next-line` z komentarzem — głównie w mockach testowych, generycznym `AdminResponse<T = any>` jako default, i 6 `any` w `PdfRenderer.tsx` dla react-native-pdf API).

### Faza 2 — Modularyzacja ekranów (2026-04-23, ~10 commitów)

Wydzielenie z 5 ekranów-monolitów (1000–2000 LOC) komponentów modali i podzakładek do nowego katalogu `src/screens/`:

```
src/screens/
  magazyn/                      ToolsTab, MaterialsTab, OrdersTab, *DetailView, styles, modals/×6
  projectDetail/                styles, modals/ (AddMember, EditProject, AddPlanWorker, Material/ToolOrder)
  tasks/                        EditTaskModal, TaskCommentsSection, styles
  projectPlans/                 PlanListView, MobilePlanZoomView, PdfRenderer
```

- `magazyn.tsx` — wydzielono 6 modali + 3 zakładki + styles → odchudzone z >2000 do akceptowalnego rozmiaru.
- `projectPlans` — pierwsze użycie `FlatList` w pionowych listach modali (commit `686da55 perf(magazyn): FlatList w pionowych listach modali`).
- Komponenty wewnętrzne przeniesione z `app/(app)/_components` do `src/screens` ze względu na **bug Expo Router**: katalogi pod `app/` są autoregistowane jako routes, a `_components` z nawiasem _ nie był ignorowany w 6.0.23 (commit `10bc77d`).

### Faza 3 — TanStack Query v5 (2026-04-23, 8 commitów)

- Setup: [`src/lib/queryClient.ts`](../src/lib/queryClient.ts) — `staleTime: 5min`, `gcTime: 10min`, `refetchOnWindowFocus: false` (mobile-friendly), `retry: 1` zamiast 3, `mutations.retry: 0`.
- `QueryClientProvider` zawinięty w [`app/_layout.tsx:107`](../app/_layout.tsx).
- Migracja 10 hooków:
  - `useProjectData`, `useProjectMembers`, `useProjectOrders`, `useProjectEdit`, `useProjectPlanWorkers`
  - `useWarehouseTools`, `useWarehouseMaterials`, `useWarehouseOrders`
- Klucze cache zorganizowane semantycznie (`projectKeys.tasks(id)`, `projectKeys.members(id)`, …) — gotowe pod realtime invalidation.

### Faza 3.5 — Supabase Realtime (2026-04-23)

- [`src/hooks/useSupabaseRealtime.ts`](../src/hooks/useSupabaseRealtime.ts) — generic helper, każda subskrypcja `postgres_changes` na `INSERT/UPDATE/DELETE` woła `qc.invalidateQueries(keys)`.
- [`src/hooks/useProjectRealtime.ts`](../src/hooks/useProjectRealtime.ts) — 7 subskrypcji per projekt: projects, tasks, project_members, project_attachments, attachment_folders, project_material_orders, project_tool_orders.
- [`src/hooks/useWarehouseRealtime.ts`](../src/hooks/useWarehouseRealtime.ts) — magazyn.
- Migracja [`20260423_enable_realtime_publications.sql`](../supabase/migrations/20260423_enable_realtime_publications.sql) — idempotentnie dodaje 9 tabel do `supabase_realtime` publication.
- Aktywne tylko w 2 ekranach: `projects/[id].tsx` i `magazyn.tsx`.

### Faza 4 — Testy (2026-04-29)

- [`jest.config.js`](../jest.config.js): preset `jest-expo/node`, `transformIgnorePatterns` z whitelisted RN/Expo/TanStack modules, `moduleNameMapper` `@/* → <rootDir>/*`.
- [`jest.setup.ts`](../jest.setup.ts): `@testing-library/jest-native/extend-expect`, mock `react-native-reanimated`, wyciszone `console.warn/error`.
- 1 test biznesowy: [`src/hooks/__tests__/useProjectMembers.test.ts`](../src/hooks/__tests__/useProjectMembers.test.ts) (2 cases) — pokrywa initial fetch + `addMember(worker)` → `insert + sendNotification`.
- TODO commit 3 (z commit message): test PM/BL auto detection — wymaga refactoringu mocka Supabase chain na "lazy materialize" (obecny "queue per call" gubi się na chain `.eq().single()`).
- Status: `npm test` → 2/2 passed, ~3s. **`npx tsc --noEmit` → exit 0**, czysto.

### Inne fixy (2026-04-27…28)

- `5d33a45 fix(netlify): NODE_VERSION 18 → 20` — RN 0.81 / Expo SDK 54 wymaga toReversed (ES2023, Node 20+).
- `4537ab2`, `a70a1c3` — fixy Expo Router 6.0.23: `href: null` koliduje z `tabBarButton`, ukrywanie non-tab screens.
- `10bc77d` — przeniesienie `app/(app)/_components/` → `src/screens/` (Expo Router auto-register bug).
- `f06055c fix(projects): recover emptied projects/[id].tsx + complete any cleanup` — ratunek po niedokończonej refaktoryzacji, dodano czyszczenie `any`.

---

## 3. Co zostało (od poprzednich rekomendacji raportu #1)

### ✅ Załatwione

1. **RLS hardening** — pełne, ze świadomymi wyjątkami i `SECURITY DEFINER` helpers.
2. **`any` cleanup** — z 558 do 15 (97 %). Zaktywowane jako `warn` w ESLint.
3. **TanStack Query + cache invalidation** — wprowadzone, z realtime na 9 tabelach.
4. **Modularyzacja ekranów-monolitów** — strukturalnie wydzielone modale i taby.
5. **FlatList w pionowych listach modali** — częściowo (4 modale magazyn + 4 modale projects + 8 ekranów aplikacji).
6. **`SECURITY.md` + `.env.example`** — dokumentacja sekretów.
7. **Husky + lint-staged + `tsc --noEmit`** — pre-commit gate działa.
8. **Drop-in proxy `adminApi`** — pełna migracja 50+ miejsc, `adminClient.ts` jako `@deprecated` re-export.

### ⚠️ Częściowo

1. **FlatList** — używane w 12 plikach (4 modale `src/screens/`, 8 ekranów `app/(app)/`), ale długie `.map()` nadal są w ekranach >800 LOC (dashboard, plan, settings, users).
2. **Refaktoryzacja ekranów >1000 LOC** — strukturalna (modale wydzielone), ale nadal istnieją monolity: [`app/(app)/components/ProjectPlans.tsx`](../app/(app)/components/ProjectPlans.tsx) (1340), [`app/(app)/admin/database.tsx`](../app/(app)/admin/database.tsx) (1295), [`app/(app)/users/index.tsx`](../app/(app)/users/index.tsx) (1034), [`app/(app)/users/[id].tsx`](../app/(app)/users/[id].tsx) (1034), [`app/(app)/projects/[id].tsx`](../app/(app)/projects/[id].tsx) (997), [`app/(app)/components/ResourceCalendar.tsx`](../app/(app)/components/ResourceCalendar.tsx) (994), [`app/(app)/settings.tsx`](../app/(app)/settings.tsx) (963), [`app/(app)/plan.tsx`](../app/(app)/plan.tsx) (924).
3. **Testy** — 1 z 32 hooków pokryty. Infrastruktura jest, treść — symboliczna. Brak testów dla `usePermissions` (core security), `AuthProvider`, `usePlanData`, `useProjectData`.
4. **`.env` w katalogu repo** — `SUPABASE_SERVICE_ROLE_KEY` i `GMAIL_APP_PASSWORD` nadal fizycznie w pliku (gitignored, ale ryzyko leaku przez backup/upload). Nie ma jak tego uniknąć dla `netlify dev` lokalnie, ale warto rozważyć [Doppler](https://doppler.com) / [1Password CLI](https://developer.1password.com/docs/cli/secrets-management/) dla zespołu.

### ❌ Niezałatwione

1. **Accessibility — wciąż 0 atrybutów** w całym repo (`accessibilityLabel`, `accessibilityRole`, `accessibilityHint`) — przy **1009 Touchable/Pressable** w kodzie. Screen reader uczyni aplikację bezużyteczną. Także brak `accessibilityState`, brak `accessible: true` na grupach, brak fokusu trapping w modalach.
2. **Sentry / observability** — brak. 178 `console.log/warn/error` w kodzie, ale żadnego transportu do zewnętrznego systemu. Crash w produkcji = ślepa zagadka.
3. **Modele AI nieaktualne** — wszystkie 4 Netlify Functions używają `claude-sonnet-4-20250514` (Sonnet 4.0 z maja 2025). Aktualne (2026-05): `claude-sonnet-4-6` lub `claude-haiku-4-5` (znacznie tańszy, dobrze działa dla chat-ów i parsowania).
4. **Brak retry / rate limiting w Netlify Functions** — `ai-chat.js`, `ai-report.js`, `ai-voice-report.js`, `ai-smart-plan.js` robią `fetch("https://api.anthropic.com/v1/messages")` bez backoff. Pojedynczy `429` zwraca user error.
5. **Klucze AI w plaintext w DB** — `company_settings.anthropic_api_key`, `openai_api_key`, `default_password` jako TEXT. Migracja [`20260413`](../supabase/migrations/20260413_add_ai_api_keys.sql) tworzy je bez szyfrowania. RLS chroni przed user-ami nie-admin, ale każdy z `SUPABASE_SERVICE_ROLE_KEY` (Supabase Studio, backups, audit log) widzi w plaintext. **Faza 7 z migracji `20260419` to przewiduje** ("klucze AI do Netlify env, kolumny plaintext do usunięcia").

---

## 4. Nowe problemy znalezione

### 🔴 Krytyczne

#### K1. Naruszenie React Rules of Hooks — [`app/(app)/tasks/new.tsx:43-72`](../app/(app)/tasks/new.tsx#L43-L72)

```tsx
const [loading, setLoading] = useState(false);          // ⬅ hook 1
if (!perms.canCreateTask) {
  router.replace("/projects");
  return null;                                            // ⬅ early return
}
const [translating, setTranslating] = useState(false);  // ⬅ hook 2 — po returnach!
const [translatedTitle, setTranslatedTitle] = useState("");
// ...kolejne 10 useState + 1 useEffect po conditional return
```

**Ryzyko:** w trybie produkcyjnym React zaczyna od pierwszego renderu (bez `perms.canCreateTask`) z N hooków, drugi render (z `perms.canCreateTask = false`) ma już 1 hook — **"Rendered fewer hooks than expected"** lub odwrotnie — **"Rendered more hooks…"** = crash całego ekranu. ESLint to wykrył: **13 błędów `react-hooks/rules-of-hooks` w tym pliku**.

**Naprawa:** przenieść guard `if (!perms.canCreateTask)` PO wszystkich `useState` / `useEffect`. Najczystszy wzorzec:

```tsx
useEffect(() => {
  if (!perms.canCreateTask) router.replace("/projects");
}, [perms.canCreateTask]);

if (!perms.canCreateTask) return null;
```

#### K2. Plaintext API keys w bazie (przeniesione z raportu #1)

[`company_settings.anthropic_api_key`, `openai_api_key`, `default_password`] — kolumny `TEXT DEFAULT NULL`, czytelne dla wszystkich z `service_role`. Migracja `20260419_harden_rls` ograniczyła `SELECT` do admin/mgmt na poziomie RLS (defense in depth), ale to wciąż plaintext. **Faza 7 roadmapy** to adresuje — warto ją zaplanować.

### 🟡 Średnie

#### S1. ESLint — 201 problemów (21 błędów, 180 ostrzeżeń)

Rozkład:
| Reguła | Liczba | Komentarz |
|---|---|---|
| `no-unused-expressions` | 62 | Wzorzec `Platform.OS === "web" ? window.alert(x) : Alert.alert(...)` w pozycji statement. Częsty, ale nieczytelny — refactor na `if (Platform.OS === "web") {…} else {…}`. |
| `@typescript-eslint/no-unused-vars` | 61 | Importy / zmienne zostawione po refaktoringu. `--fix` rozwiązuje 7 z nich. |
| `react-hooks/exhaustive-deps` | 28 | Brakujące dependencies w `useEffect` / `useCallback` (fetchData, fetchAbsences, …). Może powodować stale closures — fix lub `// eslint-disable-next-line` z explicit reason. |
| `react-hooks/rules-of-hooks` | 13 | **Wszystkie w `tasks/new.tsx`** — patrz K1, prawdziwy bug. |
| `@typescript-eslint/no-require-imports` | 9 | `require()` w plikach TS. |
| `react/no-unescaped-entities` | 8 | Niełamane cudzysłowy w JSX. Kosmetyka. |

#### S2. AI modele nieaktualne

Wszystkie 4 functions (`ai-chat.js:145`, `ai-report.js:255`, `ai-smart-plan.js:149`, `ai-voice-report.js:156`) używają `claude-sonnet-4-20250514`. Rekomendacje:
- **Chat + analizy:** upgrade na `claude-sonnet-4-6` — lepsza jakość przy podobnym koszcie.
- **Voice report (transkrypcja + krótkie podsumowanie):** rozważ `claude-haiku-4-5-20251001` — ~6× tańszy, wystarczający do tego use case.
- **Raporty PDF / Smart Plan:** zostań przy Sonnet (jakość ważniejsza).

Hint API: zmiana 1-liniowa per plik. Warto dodać `model` jako kolumnę w `company_settings`, żeby admin mógł przełączać z UI per company (już macie `anthropic_api_key` per company — naturalne rozszerzenie).

#### S3. Brak rate limiting / retry w wywołaniach Anthropic

`fetch("https://api.anthropic.com/v1/messages")` bez backoff. Pierwszy `429` (rate limit) lub `529` (overloaded) → user widzi raw error. Dodać exponential backoff z 2-3 retry (na 429/529 tylko, nie na 4xx) + pominąć retry dla `400` (zła payload).

#### S4. `BSapp.zip` (1.6 MB) i `Dokumentacja i spis tresci.docx` (32 KB) w git

[`git ls-files | grep -E "\.(zip|docx)$"`](#) zwraca oba pliki. Bloata repo, w `.gitignore` jest `*.zip` ale plik został dodany wcześniej (pre-ignore). Usunąć z indeksu (`git rm --cached BSapp.zip`, `git rm --cached "Dokumentacja i spis tresci.docx"`) i przenieść do `Audyt/` lub innego nieśledzonego katalogu.

### 🟢 Drobne

- [`src/hooks/__tests__/sanity.test.ts`](#) — `git status` pokazuje `deleted: ...` bez stage. Albo `git rm`, albo `git restore`. Pewnie pozostałość po commitch faza 4 commit 1.
- [`_check_translations.js`](../_check_translations.js) (0 bytes) w roocie — pusty plik, usunąć.
- 2 branches lokalne (`main`, `master`) — `master` prawdopodobnie nieużywana, czyszczenie.
- `BSapp_Zarzadzanie_Przewodnik.html`, `INSTRUKCJA*.md`, `START_TUTAJ.md` w roocie — przenieść do `docs/`.

---

## 5. Architektura (snapshot 2026-05-19)

```
┌──────────────────────────────────────────────────────────────────────┐
│  app/  (Expo Router, file-based, 37 .tsx, ~19 600 LOC)               │
│    _layout.tsx → ErrorBoundary + QueryClientProvider + 4 Providers   │
│    (app)/_layout.tsx → Tabs + GPS                                    │
│    (app)/*.tsx → ekrany (8 z nich >900 LOC, 4 >1000 LOC)             │
│    (app)/components/{ProjectPlans, ResourceCalendar} — duże mono     │
│    (app)/admin/×5 — ai-settings, company, database, passwords,       │
│                     permissions, updates                              │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
┌──────────────────┴───────────────────────────────────────────────────┐
│  src/  (~14 500 LOC)                                                  │
│    providers/    AuthProvider, ThemeProvider, NotificationProvider,   │
│                  CompanyProvider                                       │
│    hooks/        32 hooków (10 na TanStack Query, 24 legacy useState) │
│    hooks/__tests__/  1 plik (useProjectMembers.test.ts, 2 cases)      │
│    lib/                                                                │
│      supabase/   client.ts, adminApi.ts (PROXY, 541 LOC), adminClient │
│                  (DEPRECATED re-export), database.types.ts (1151)     │
│      queryClient.ts (TanStack v5 config)                              │
│    i18n/         de/pl/en.json × 1138 linii = 3414 łącznie            │
│    screens/      modały i taby wydzielone w Fazie 2                   │
│      magazyn/, projectDetail/, tasks/, projectPlans/                  │
│    components/   UpdateChecker.tsx (1 plik)                            │
│    services/, utils/                                                  │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
┌──────────────────┴────────┐         ┌────────────────────────────────┐
│  Supabase (anon + RLS)    │         │  Netlify Functions (6, ~1557L) │
│  – z RLS hardened         │         │  – service_role + JWT verify   │
│  – Realtime publication × │         │  – supabase-admin (PROXY)      │
│    9 tabel                │         │  – ai-chat, ai-report,         │
│                           │         │    ai-smart-plan,              │
│                           │         │    ai-voice-report             │
│                           │         │  – send-email (Gmail SMTP)     │
└───────────────────────────┘         └────────────────────────────────┘
```

### Stack — bez zmian od raportu #1

- Expo SDK **54.0.33**, React Native **0.81.5**, React **19.1.0**
- Expo Router **6.0.23** z `typedRoutes: true`, `reactCompiler: true`, `newArchEnabled: true`
- TypeScript **5.9.2** strict
- Supabase JS **2.94.0**, TanStack Query **5.99.2**
- i18next **25.8.1** + react-i18next **16.5.4** + expo-localization **17.0.8**
- Husky **9.1.7** + lint-staged **16.3.1** z `tsc --noEmit`
- Jest **30.3.0** + jest-expo **55.0.16** + `@testing-library/react-native` **13.3.3**

---

## 6. Rekomendacje wg priorytetu

### Sprint 1 (1-3 dni, krytyczne)

1. **Napraw `app/(app)/tasks/new.tsx`** — przenieść guard `if (!perms.canCreateTask)` PO wszystkich hookach (K1). To prawdziwy bug, który padnie w produkcji jak tylko user bez uprawnień otworzy ekran.
2. **Usuń `BSapp.zip` z git history** — `git rm --cached BSapp.zip` + commit. Plik ma 1.6 MB, repo waży niepotrzebnie.
3. **Sentry** — `npx expo install sentry-expo`, w `app/_layout.tsx` po ErrorBoundary. Bez observability każdy crash w produkcji jest niedebugowalny.
4. **Upgrade modeli AI** — 1-liniowa zmiana per plik. Sonnet 4 → Sonnet 4.6, voice report → Haiku 4.5 (oszczędność ~6× kosztów na tym jednym endpoincie).

### Sprint 2 (1 tydzień, ważne)

5. **Testy dla `usePermissions`** — to core security logic (10 ról × 20+ permissions), powinien być w 100% pokryty. Daje też pewność że refactory roli nie połamie czegoś subtelnego.
6. **Pokrycie testami pozostałych 8 hooków migrowanych na TanStack** — wzorzec już macie z `useProjectMembers.test.ts`, do skopiowania.
7. **Refactor `react-hooks/exhaustive-deps`** — 28 ostrzeżeń, część może maskować stale closures. Najczęstszy wzorzec: `fetchX` jako dep w `useEffect`. Owinąć `fetchX` w `useCallback([deps])` i dodać do deps `useEffect`.
8. **Naprawienie `react-hooks/rules-of-hooks`** w `tasks/new.tsx` — patrz #1, ale rozważyć też audit innych ekranów pod kątem early returns przed hookami (`grep -B5 "return null" app/(app)`).
9. **Faza 7 z planu RLS hardening** — przenieść klucze AI z `company_settings.anthropic_api_key`/`openai_api_key` do `process.env` (Netlify Dashboard). Usunąć kolumny z DB, zostawić tylko `default_password` (per company) lub zaszyfrować pgcrypto.

### Sprint 3 (2-4 tygodnie, dług jakości)

10. **Accessibility** — start z najczęściej używanych Touchable: dashboard, settings, projects/[id]. Dodać `accessibilityLabel`, `accessibilityRole="button"`. Test z VoiceOver (iOS) i TalkBack (Android). Bez tego aplikacja jest niedostępna dla niewidomych pracowników (a budownictwo elektryczne ma wymogi BGW DGUV 215-410 jeśli wchodzicie w sektor publiczny).
11. **Dokończenie modularyzacji** ekranów >1000 LOC:
    - `ProjectPlans.tsx` (1340 LOC) — wydzielenie editorów, viewerów, controlsów PDF.
    - `admin/database.tsx` (1295 LOC) — admin panel, podzielić per zakładka (companies, profiles, projects, …).
    - `users/index.tsx + [id].tsx` (1034 + 1034 LOC) — wydzielić list+filter+import.
12. **Continued migration na TanStack Query** — 22 hooki nadal na `useState + useEffect`, m.in. `useDashboardData`, `useUserAbsences`, `useUsersManagement`, `useGPSAnalytics`, hooki AI (`useAIChat`, `useVoiceReport`).
13. **FlatList wszędzie gdzie >20 elementów** — szczególnie listy projektów, użytkowników, zadań. `.map()` w `ScrollView` nie virtualizuje renderu = scroll lag na 100+ items na Androidzie.
14. **Rate limiting + retry w Netlify Functions AI** — szczegóły w S3.

### Sprint 4+ (rozwojowo)

15. **Sentry release tracking** + `Sentry.setUser({ id, email })` w `AuthProvider`.
16. **Detox e2e** dla 3 golden paths: login → dashboard → tworzenie projektu → dodanie taska → mark done.
17. **Storybook / Ladle** dla `src/screens/*/modals/*` i kart dashboardu — szybki QA UI bez całego flow.
18. **i18n linting** — skrypt który sprawdza klucze `t("...")` vs zawartość 3 plików locales, fail w CI jeśli brakuje.
19. **CI/CD** — GitHub Actions z `npm run typecheck && npm run lint && npm test` na każdy PR. Husky robi to lokalnie, ale ktoś `--no-verify` może obejść.

---

## 7. Punktacja per kategoria

| Kategoria | Ocena | Komentarz |
|---|---|---|
| **Architektura** | 8/10 | Czysty podział app/Router + src/business + Netlify proxy. Modały wydzielone, providers OK. |
| **Bezpieczeństwo** | 7.5/10 | RLS hardened, proxy z permissions checks, sekrety w `.env`/Netlify. Wciąż klucze AI w DB plaintext. |
| **Typowanie TS** | 9/10 | 15 świadomych `any` na ~34k LOC. `strict: true`. Lint warn aktywny. |
| **Testy** | 2/10 | Infrastruktura jest, ale 2 testy na 32 hooki. |
| **Accessibility** | 0/10 | Zero atrybutów. Nieakceptowalne dla aplikacji publicznej. |
| **Performance** | 7/10 | TanStack Query + Realtime + FlatList w nowych komponentach. Duże ekrany jeszcze nie zoptymalizowane. |
| **Observability** | 1/10 | 178 `console.*`, zero transport. Brak Sentry/Datadog. |
| **i18n** | 9/10 | 3 locale × 1138 linii, synchronized (poprzedni audyt potwierdził). |
| **Dev experience** | 8.5/10 | Husky + lint-staged + tsc + typed routes + react compiler. Brak CI GitHub Actions. |
| **Dokumentacja** | 7/10 | `CLAUDE.md` + `docs/SECURITY.md` + komentarze w migracjach SQL. Brak ADR / runbook. |

**Średnia: 5.9/10**, ważona "wszystko musi działać": **8.0/10**.

---

## 8. Sumarycznie — co się stało od raportu #1

Z 6.5/10 → 8.0/10. To **bardzo poważny postęp w 10 dni pracy** (56 commitów). Roadmapa jest spisana w commit messages (faza 0 → 4), realizowana bez gubienia kontekstu, ze świadomym `// TODO` w komentarzach gdzie się zatrzymujecie. To dojrzała praktyka.

Dwa największe nieadresowane problemy:
- **Accessibility (0 atrybutów na 1009 Touchable)** — to ryzyko prawne (BGW, BFSG, EAA 2025 w UE).
- **Brak testów krytycznej logiki** (`usePermissions`, `AuthProvider`) — security regressy są niedebugowalne.

I jeden quick win z dużym ROI:
- **Sentry + upgrade AI modeli** — godzina pracy, natychmiastowa wartość.

---

**Następny audyt zalecany:** po Sprint 1+2 (~3 tygodnie), aby zweryfikować naprawy K1 i pokrycie testowe.
