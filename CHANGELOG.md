# Changelog

Wszystkie istotne zmiany w BSapp.

Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersjonowanie [SemVer](https://semver.org/lang/pl/).

## [1.3.4] - 2026-05-21

### Naprawione
- **Kontynuacja problemu z nawigacją** — po v1.3.1 (cofnięcie `Sentry.wrap`) i v1.3.3 (chevron klikalny) user zgłosił że NADAL nie da się wejść w użytkownika z listy. Console pokazuje warning `Blocked aria-hidden on an element because its descendant retained focus` co sugeruje że jakiś globalny overlay (Sentry hook?) wpływa na DOM/focus.
- Hipoteza: `tracesSampleRate: 0.2` + `enableAutoSessionTracking: true` w `Sentry.init` próbują podpiąć się do navigation routera Expo (mimo że `Sentry.wrap` cofnięty). Bez właściwego `routingInstrumentation` dla Expo Router te flagi mogą cicho blokować router.push.
- Rozwiązanie: **MINIMALNA konfiguracja Sentry** — tylko `dsn` + `enabled`. Bez tracing i bez session tracking. Co zostaje: `captureException` w `ErrorBoundary` + automatyczne przechwytywanie unhandled errors przez SDK + `setUser` w `AuthProvider`. Co tracimy: performance metrics (transactions, response time), crash-free sessions metric. Można dorzucić później z reactNavigationIntegration.

## [1.3.3] - 2026-05-21

### Naprawione
- **Klik na kartę użytkownika nie otwierał szczegółów** (kontynuacja sesji user, po `1.3.1` hotfix Sentry.wrap nadal nie działało). Diagnoza: outer `TouchableOpacity` zawijający całą kartę miał teoretycznie `onPress={() => router.push(...)}`, ale email + telefon + 3 przyciski akcji wewnątrz karty mają `e.stopPropagation()` (żeby klik na mailto nie otwierał też detail). To zostawiało bardzo mało wolnej przestrzeni do kliknięcia outer.
- Rozwiązanie: **chevron `>` po prawej stronie karty (linia [app/(app)/users/index.tsx:136-144](app/(app)/users/index.tsx#L136-L144)) zamieniony na własne `TouchableOpacity` z `onPress={() => router.push(`/users/${item.id}`)}` + `hitSlop` 10px**. Teraz mamy wyraźny, klikalny przycisk "wejdź w szczegóły".
- Outer `TouchableOpacity` zachowany — klik w avatar (lewa strona) lub w nazwisko (Text, bubble up) nadal działa.

## [1.3.2] - 2026-05-21

### Naprawione
- **EAS Build APK errored z `EAS_BUILD_UNKNOWN_GRADLE_ERROR`** — w v1.3.0 `npx expo install @sentry/react-native` automatycznie dodał plugin `"@sentry/react-native"` do `app.json`. Plugin w fazie `Run gradlew` próbuje uploadować source maps przez `@sentry/cli` i wymaga `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` env vars (osobne od DSN). Bez nich gradle pada.
- Rozwiązanie: **usunięcie plugina** z `app.json`. Sentry init w JS (`app/_layout.tsx`) nadal działa — zbiera crashe i wysyła do dashboardu. **Trade-off:** stacktrace w Sentry pokazuje minified bundle JS zamiast oryginalnych nazw funkcji.
- **Pełne włączenie source maps** (kiedy będziesz chciał czytelne stacktrace'y) wymaga:
  1. Sentry → Settings → Account → Auth Tokens → Create Auth Token (scopy: `project:releases`, `org:read`).
  2. EAS env vars: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG=pmb` (lub Twoje slug), `SENTRY_PROJECT=bsapp`.
  3. Plugin z powrotem w `app.json` z konfiguracją.

## [1.3.1] - 2026-05-21

### Naprawione
- **HOTFIX: Regresja nawigacji** — `Sentry.wrap(RootLayout)` z [1.3.0](#130---2026-05-20) zaburzał Expo Router 6 (`router.push` przestawał działać na `TouchableOpacity` kart w listach userów/projektów — kliknięcie nie otwierało szczegółów). User zgłosił problem w sesji 2026-05-21.
- Rozwiązanie: cofnąć `Sentry.wrap` z [app/_layout.tsx:144](app/_layout.tsx#L144), zostawić `export default RootLayout` (bez wrapa).
- **Sentry nadal w pełni działa** — `Sentry.init`, `ErrorBoundary.captureException`, `Sentry.setUser` w `AuthProvider` zachowane. Co tracimy: auto-tracking nawigacji (transactions per screen) — wymaga dodatkowej konfiguracji `reactNavigationIntegration` zaprojektowanej dla Expo Router. Odłożone do osobnej iteracji.
- Stan testów: 21/21 PASSED, TypeScript: czysty.

## [1.3.0] - 2026-05-20

### Dodane
- **Sentry observability** ([@sentry/react-native ~7.2.0](https://docs.sentry.io/platforms/react-native/)). Region: **EU (Niemcy)** — zgodny z DSGVO.
  - Init w [app/_layout.tsx](app/_layout.tsx) z `tracesSampleRate: 0.2` (20% sample dla performance — oszczędność limitu 5k events/m na planie free) i `enableAutoSessionTracking: true` (crash-free sessions metric).
  - W `__DEV__` Sentry jest **disabled** — eventy z developmentu nie zaśmiecają dashboardu produkcyjnego.
  - `Sentry.wrap(RootLayout)` — root component opakowany dla auto-tracking nawigacji i sesji.
  - `Sentry.captureException` w `ErrorBoundary.componentDidCatch` — każdy React crash idzie do Sentry z `componentStack` jako kontekst.
  - `Sentry.setUser({ id, email, username, segment: role })` w [AuthProvider](src/providers/AuthProvider.tsx) — każdy event ma id usera, email, nazwę i rolę. Po wylogowaniu user jest czyszczony (`setUser(null)`).
  - Plugin `@sentry/react-native` dodany do `app.json` (wymagany dla source maps w buildach EAS).
  - DSN w `EXPO_PUBLIC_SENTRY_DSN` (env var, nie hardcode) — DSN to z designu Sentry public token (idzie do bundla klienta), ale env var pozwala na łatwą rotację i różne projekty dla dev/staging/prod.
  - `.env.example` zaktualizowany z instrukcją zakładania konta i pozyskania DSN.

### Operacyjne
- **Co teraz widzisz w Sentry:**
  - Każdy unhandled JS error → event z stacktrace, breadcrumbs (nawigacja, network requests), urządzeniem (iOS/Android/web), wersją appki, użytkownikiem.
  - Performance: 20% transakcji (nawigacja screen→screen, API calls) — chart latencji.
  - Crash-free sessions / crash-free users — KPI stabilności.
- **Co dodać w Netlify dashboard:** `EXPO_PUBLIC_SENTRY_DSN` env var (Site settings → Environment variables) — web build już dostanie DSN automatycznie.
- **Co dodać w EAS:** `EXPO_PUBLIC_SENTRY_DSN` w EAS environment variables (Expo dashboard → Project → Environments → preview/production) — przyszłe `eas build` dostaną DSN automatycznie.

## [1.2.0] - 2026-05-20

### Dodane
- **GitHub Actions CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)) — uruchamia `tsc --noEmit + eslint + jest` na każdym pushu do `main` i każdym PR. Husky pilnuje lokalnie ale `--no-verify` to obejdzie; CI w GitHubie to ostatnia linia obrony przed merge'em błędnej zmiany. Concurrency anuluje poprzednie runy dla tego samego brancha (oszczędność minut Actions).
- **Test `usePermissions`** ([src/hooks/__tests__/usePermissions.test.ts](src/hooks/__tests__/usePermissions.test.ts)) — 19 testów (11 dla `getRoleDefaults` + 8 dla hooka `usePermissions`). Pokrywa wszystkie 10 ról (admin, management, project_manager, bauleiter, worker, subcontractor, office_worker, logistics, purchasing, warehouse_manager) z charakterystycznymi permissions, override przez `custom_permissions`, fallback na `worker` gdy brak profile, grupowanie `isOfficeStaff`. To core security logic — refactor permissions teraz wybuchnie z testem zamiast cicho w prod.

### Naprawione
- **EAS Build APK preview** (3 attempt) — dodano `.npmrc` z `legacy-peer-deps=true`. Pierwsze 2 buildy padały w fazie "Install dependencies" z "Unknown error". Powód: po fazie 4 setup testów dodano 6 devDependencies (`jest`, `jest-expo`, `@testing-library/*`, `react-test-renderer`) z peer-dep ranges nie pasującymi 1:1 do React 19.1.0 / RN 0.81 / Expo SDK 54. Lokalnie działało (npm config default), na chmurze EAS nie — `.npmrc` wymusza ten sam behavior.
- **Build successful:** `0aa834b5-6da0-4405-8aa9-354ec5759142`, runtime 1.1.0, APK: https://expo.dev/artifacts/eas/2jjXcnCHXwCmN13nATfZCW.apk

### Zmienione
- **Sprzątanie git** — `BSapp.zip` (1.6 MB) i `Dokumentacja i spis tresci.docx` (32 KB) usunięte z indeksu (`git rm --cached`, plik pozostaje lokalnie). Dodano `*.docx` do `.gitignore`. **Historia git nadal zawiera oba pliki** — pełne usunięcie wymaga `git filter-repo` (osobna decyzja, przepisuje historię).
- **Sprzątanie git #2** — `sanity.test.ts` (leftover z fazy 4) usunięty z indeksu.
- **Branch `master` usunięty lokalnie**, zdalnie zablokowany przez GitHub (master to default branch repo — trzeba ręcznie zmienić na main w Settings → Branches lub przez `gh repo edit --default-branch main`).

### Status testów
- **2/2 → 21/21 PASSED** (1.5s)
- TypeScript: czysty
- ESLint: 0 errors, 180 warnings (głównie kosmetyka: no-unused-vars, exhaustive-deps)

## [1.1.0] - 2026-05-19

### Zmienione
- **Upgrade modeli AI** o jedną generację — z `claude-sonnet-4-20250514` (Sonnet 4.0, maj 2025) na `claude-sonnet-4-6` (Sonnet 4.6, najnowszy stabilny w linii Sonnet 4) we wszystkich 4 Netlify Functions:
  - [netlify/functions/ai-chat.js:145](netlify/functions/ai-chat.js#L145) — czat AI z asystentem budowlanym (DE/PL/EN, VOB/B, DIN, HOAI)
  - [netlify/functions/ai-report.js:255](netlify/functions/ai-report.js#L255) — generowanie raportów (daily, weekly, project status)
  - [netlify/functions/ai-smart-plan.js:149](netlify/functions/ai-smart-plan.js#L149) — automatyczne planowanie tygodnia
  - [netlify/functions/ai-voice-report.js:156](netlify/functions/ai-voice-report.js#L156) — transkrypcja głosowa → strukturalny raport budowy (tasks/materials/issues)
- API request shape bez zmian (`max_tokens`, `system`, `messages` identyczne) — drop-in upgrade, łatwy rollback w razie problemów (jedna linia per plik).
- **Nie zmieniono na Haiku 4.5 dla voice-report** mimo sugestii z audytu — voice-report parsuje strukturalny JSON (ekstrakcja tasks/materials/issues z transkrypcji + tłumaczenie DE↔inne języki). Haiku może gorzej trzymać format. Migrację Haiku odłożono do osobnego sprintu po teście jakości na realnych nagraniach.

### Uwaga operacyjna
- Po deployu sprawdzić w prod: (a) czy czat odpowiada normalnie, (b) czy weekly report się generuje, (c) czy voice report nadal wyciąga structured data.
- Koszt: Sonnet 4.6 ma podobną stawkę co Sonnet 4.0 ($3/$15 per 1M tokens input/output) — brak istotnej zmiany budżetu API.

## [1.0.2] - 2026-05-19

### Naprawione
- 8 błędów ESLint `react/no-unescaped-entities` w 5 plikach. Niezamknięte cudzysłowy `"` w JSX zamienione na encje HTML (`&quot;`) lub typograficzne dolne/górne polskie (`„...”`):
  - [app/(app)/absences.tsx:310](app/(app)/absences.tsx#L310) — `„{a.note}"` → `„{a.note}”`
  - [app/(app)/components/ResourceCalendar.tsx:971](app/(app)/components/ResourceCalendar.tsx#L971) — `„{a.note}"` → `„{a.note}”`
  - [app/(app)/admin/updates.tsx:161](app/(app)/admin/updates.tsx#L161) — `"main"` → `&quot;main&quot;`
  - [app/(app)/gps-analytics.tsx:367](app/(app)/gps-analytics.tsx#L367) — `"51.2345, 7.1234"` → `&quot;51.2345, 7.1234&quot;`
  - [app/(app)/voice-report.tsx:322](app/(app)/voice-report.tsx#L322) — `"{result.transcription}"` → `&quot;{result.transcription}&quot;`
- Czysta kosmetyka, brak zmian zachowania. ESLint: **21 errors → 0 errors** (pozostałe 180 warnings: `no-unused-vars`, `exhaustive-deps`, `no-unused-expressions`, `no-explicit-any` — do osobnego sprintu).

## [1.0.1] - 2026-05-19

### Naprawione
- **Krytyczny bug Rules of Hooks** w [app/(app)/tasks/new.tsx](app/(app)/tasks/new.tsx).
  Przed naprawą: `if (!perms.canCreateTask) return null;` stało w linii 43, czyli **po jednym `useState`, ale przed 12 kolejnymi `useState` i 1 `useEffect`**. To naruszało Rules of Hooks Reacta — gdy `perms.canCreateTask` zmieniało wartość, liczba wywołanych hooków różniła się między renderami, co dawało crash z błędem "Rendered fewer/more hooks than expected".
  Naprawa: wszystkie hooki wywołane bezwarunkowo na górze; redirect przeniesiony do osobnego `useEffect`; `return null` na samym końcu, po wszystkich hookach. Drugiemu `useEffect` (fetchProjectName + fetchUsers) dodano guard `if (!perms.canCreateTask) return;`, żeby nie pobierał danych dla użytkownika bez uprawnień.
  ESLint: 13 błędów `react-hooks/rules-of-hooks` w tym pliku → 0.

## [1.0.0] - 2026-05-19

Baseline po audycie #2 ([Audyt/raport2.md](Audyt/raport2.md)).

Stan codebase'u w tym punkcie:
- Expo SDK 54.0.33, React Native 0.81.5, React 19.1.0, TypeScript 5.9.2 strict
- 10 hooków zmigrowanych na TanStack Query v5
- Supabase Realtime aktywny dla 9 tabel
- RLS hardened (migracja `20260419_harden_rls.sql`)
- Service Role Key wycofany z frontu (proxy `adminApi`)
- 15 `any` w kodzie (z 558 sprzed miesiąca)
- 1 test biznesowy (`useProjectMembers`)
- AI: `claude-sonnet-4-20250514` (wszystkie 4 functions)
- ESLint: 21 błędów, 180 ostrzeżeń

Znane bugi (do naprawy w 1.0.1+):
- `app/(app)/tasks/new.tsx` — naruszenie Rules of Hooks (early return przed useState)
