# Changelog

Wszystkie istotne zmiany w BSapp.

Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersjonowanie [SemVer](https://semver.org/lang/pl/).

## [1.4.0] - 2026-05-21

### 🎯 PRAWDZIWA naprawa nawigacji users (po 8 nieudanych prób v1.3.1-1.3.9)

**Root cause:** `app/(app)/users/[id].tsx` był **DUPLIKATEM** `users/index.tsx` (1034 linii kopia listy). Renderował tę samą listę co lista, więc po kliku karty URL zmieniał się na `/users/<id>` ale ekran wyglądał identycznie → user widział że "klik nic nie robi".

Diagnostyka z v1.3.9 (`document.addEventListener('click')` + hook na `pushState`/`replaceState`) pokazała log:
```
[NAV replaceState] /users/5dc734b5-c9cb-4878-80b7-84277271387e
```
Czyli Link/router **działają** — URL się zmienia. Plik destination po prostu renderował tę samą listę. Bug istniał **od commit `9b4d685` z lutego/marca** — wszystkie wcześniejsze "kliki w usera" prowadziły w nigdzie.

### Dodane
- **`app/(app)/users/[id].tsx` — prawdziwy detail view** (250 linii):
  - useLocalSearchParams<{id: string}> → fetchProfile z Supabase
  - Loading state z ActivityIndicator
  - Error state z back button (jeśli profile nie znaleziony)
  - Header card: duża rola avatar + nazwisko + role badge + "To Twój profil" hint
  - Sekcja "Dane kontaktowe": email (klikalny mailto), telefon (klikalny tel) z 🔒 dla hide_*
  - Sekcja "Informacje": rola, access_expires_at (dla subcontractors), ID (selectable monospace)
  - TODO sekcja "Akcje" dla canEdit users (edycja roli/permissions/reset hasła — v1.4.x).

### Naprawione (przy okazji)
- Cofnięte zbędne zmiany diagnostyczne z v1.3.7-1.3.9:
  - global click listener z `app/_layout.tsx` — usunięty (zrobił swoje)
  - `console.log` z `renderUser` — usunięty
  - `React.createElement("a", ...)` test link z `users/index.tsx` — usunięty

### Lekcja
- v1.3.1 (Sentry.wrap), v1.3.2 (Sentry plugin), v1.3.4 (Sentry tracing), v1.3.5 (reactCompiler), v1.3.6 (TouchableOpacity→Pressable), v1.3.8 (Link asChild), v1.3.9 (diagnostyka) — wszystkie naprawiały objawy. **Prawdziwa przyczyna była trywialna:** brak prawdziwego destination route. Diagnostyka DOM-level (v1.3.9) wreszcie pokazała że URL się zmienia → wniosek że problem w destination.
- W przyszłości: gdy nawigacja "nie działa" — **najpierw sprawdzić w devtools czy URL się zmienia** zanim debugować Touchable/Pressable/router.

### TODO osobno
- Sprawdzić czy `app/(app)/projects/[id].tsx` jest prawdziwym detail view czy duplikatem (taki sam wzorzec).

## [1.3.8] - 2026-05-21

### Naprawione — FINALNA naprawa nawigacji users
- **Root cause ZNALEZIONY** dzięki global click listener z v1.3.7. Log z F12 Console:
  ```
  [GLOBAL CLICK] {tag: 'DIV', className: 'css-g5y9jx r-1q9bdsx r-vuvdlw r-3o4zer', ariaHidden: 'no', defaultPrevented: false, eventPhase: 1}
  ```
  Klasy `r-vuvdlw` (`cursor: default`) + `r-3o4zer` (`user-select: text`) → kliknięty element to **React Native Web `<Text>`**. Klik trafia do Text (`defaultPrevented: false`), ale **`<Text>` na react-native-web NIE propaguje click do `Pressable`/`Touchable` parent** w niektórych przypadkach. To długoletni issue platformy.
- **Naprawa:** Zamiast `Pressable onPress={router.push}` użyto **`<Link href asChild>` z expo-router**. Na web Link renderuje natywny `<a href="/users/${id}">` element — kliki we wszystkie children (włącznie z Text) naturalnie bubble up do `<a>`, browser nawiguje. Na mobile Link używa Pressable + router.push pod spodem.
- Zmiana w `renderUser` **i** `renderSubcontractor` (analogiczny problem). Outer `Pressable` i chevron `Pressable` opakowane w `<Link asChild>`.
- **Usunięto diagnostykę:** global click listener z `app/_layout.tsx`, console.log z onPress callbacków.

### Lekcja z 1.3.1-1.3.7
- 5 nietrafionych hipotez: Sentry.wrap, Sentry tracing, reactCompiler, nested Touchable, Pressable. Bez global click listener (v1.3.7) nie znaleźlibyśmy prawdziwej przyczyny. **DOM-level click event capture to nieoceniony debug tool przy RN Web.**

### TODO osobno
- Analogiczny fix w `projects/index.tsx`, `dashboard.tsx`, `tasks/index.tsx`, `notifications.tsx` (też mają outer Touchable wrap kart z Text children).

## [1.3.7] - 2026-05-21

### Dodane — diagnostyka (do usunięcia po naprawie)
- Global click listener `document.addEventListener('click', ..., true)` w [app/_layout.tsx](app/_layout.tsx) — loguje `[GLOBAL CLICK] {tag, className, ariaHidden, defaultPrevented, eventPhase}` dla KAŻDEGO kliknięcia w capture phase. Bez tego nie mielibyśmy odpowiedzi co przejmuje click w karcie users.
- Usunięte w v1.3.8 wraz z console.log w onPress.

## [1.3.6] - 2026-05-21

### Naprawione — PRAWDZIWA przyczyna problemu z nawigacją
- **Root cause:** `react-native-web 0.21.0` ma znany bug z **nested `TouchableOpacity`**. W [users/index.tsx](app/(app)/users/index.tsx) outer `TouchableOpacity` (cała karta z `router.push`) zawiera 4-5 nested `TouchableOpacity` (email mailto, phone tel, chevron, 3 buttony akcji). Wewnętrzne mają `e.stopPropagation()` i przejmują WSZYSTKIE klik events — outer nigdy nie dostaje `onPress`. Tłumaczy też dlaczego `console.log` w v1.3.5 NIE pojawiał się w konsoli.
- **Diagnoza:** v1.3.5 dodało `console.log` do outer i chevron Touchable. User pokazał console — żaden log się nie pojawił, mimo że email/phone Touchable działały (`Launched external handler for mailto:...`). To potwierdziło że outer Touchable jest blokowany przez nested, nie problem `router.push`.
- **Naprawa:** `<TouchableOpacity>` → `<Pressable>` dla outer karty i chevron w `renderUser` i `renderSubcontractor`. **`Pressable` jest nowoczesnym API React Native z lepszą obsługą nested event handling na web.** Email/phone/buttons zostają jako `TouchableOpacity` (działają OK z `stopPropagation`).
- v1.3.4 (minimum Sentry) i v1.3.5 (`reactCompiler: false`) były nietrafione — żaden z tych nie był przyczyną. Zmiany v1.3.4 zostają (Sentry minimum to dobry default). `reactCompiler` w v1.3.5 zostawiamy wyłączony jako defensive default — eksperymentalna funkcja, nieoptymalizowanie ręcznych callbacków daje lepszą przewidywalność.

### TODO — w następnej iteracji
- Usunięcie `console.log` z `users/index.tsx` (zostawione dla finalnej weryfikacji)
- Analogiczna zmiana w `projects/index.tsx` (też ma nested Touchable — może mieć ten sam problem)
- Migracja innych ekranów z nested Touchable na Pressable

## [1.3.5] - 2026-05-21

### Naprawione (próba 3 — diagnoza głęboka)
- v1.3.1, v1.3.3, v1.3.4 nie naprawiły problemu nawigacji w users/index. User zgłosił że klik w kartę (avatar, nazwisko, chevron) nadal nie otwiera szczegółów. Po wykluczeniu modali (brak w pliku) i Sentry tracing (minimum w v1.3.4) → kolejny podejrzany: **`reactCompiler: true`** w `app.json` experiments.
- React Compiler memoizuje agresywnie wszystkie callbacki — `() => router.push(...)` może zostać zoptymalizowany w sposób gubiący referencje do `router`.
- **Wyłączono `reactCompiler: false`** w [app.json:56](app.json#L56). Eksperyment, włączony od audytu fazy 2.
- **Dodano `console.log("[USER CARD] outer/chevron clicked", item.id)`** w obu Touchable kart usera. Diagnoza: po hard refresh i kliku w kartę user zobaczy w F12 Console czy logi się pojawiają. Jeśli **tak** — onPress działa, problem w `router.push`. Jeśli **nie** — Touchable w ogóle nie reaguje.

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
