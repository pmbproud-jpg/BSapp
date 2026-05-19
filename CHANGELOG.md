# Changelog

Wszystkie istotne zmiany w BSapp.

Format: [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/), wersjonowanie [SemVer](https://semver.org/lang/pl/).

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
