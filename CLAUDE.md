# BSapp - Notatki projektu

## Język komunikacji
**Zawsze pisz po polsku** - uzytkownik preferuje komunikacje w jezyku polskim.

## O projekcie
Aplikacja do zarzadzania firma budowlana. Expo/React Native (iOS, Android, Web) z backendem Supabase.

### Stack technologiczny
- **Frontend**: Expo SDK, React Native, TypeScript (strict), Expo Router (file-based routing)
- **Backend**: Supabase (auth, database PostgreSQL, storage)
- **i18n**: i18next z 3 jezykami: DE (domyslny), PL, EN - pliki w `src/i18n/locales/`
- **State**: Context API (AuthProvider, ThemeProvider, NotificationProvider, CompanyProvider)
- **Styl**: StyleSheet z dynamicznym motywem (dark/light/system)

### Struktura plikow
```
app/
  _layout.tsx          # Root layout - providery, init i18n, auth redirect
  login.tsx            # Ekran logowania
  (app)/
    _layout.tsx        # Tab layout z headerem
    dashboard.tsx      # Dashboard ze statystykami
    projects/          # CRUD projektow (index, new, [id])
    tasks/             # CRUD zadan (index, new, [id])
    users/             # Zarzadzanie uzytkownikami
    settings.tsx       # Ustawienia profilu, jezyka, uprawnien
    plan.tsx           # Planowanie tygodniowe, pojazdy
    absences.tsx       # Nieobecnosci
    magazyn.tsx        # Magazyn materialow
    notifications.tsx  # Powiadomienia
src/
  lib/supabase/
    client.ts          # Klient Supabase (normalny)
    adminClient.ts     # Klient admin (service role key) - UWAGA: security issue
    database.types.ts  # Typy TypeScript z bazy danych
  providers/
    AuthProvider.tsx   # Autentykacja, profil, sesja
    ThemeProvider.tsx   # Motyw dark/light
    NotificationProvider.tsx
    CompanyProvider.tsx # Multi-tenancy firm
  hooks/
    usePermissions.ts  # System uprawnien oparty na rolach
    useGPSTracking.ts  # Sledzenie GPS
  i18n/
    index.ts           # Konfiguracja i18n, setLanguage()
    storage.ts         # Persystencja jezyka w AsyncStorage
    locales/           # pl.json, en.json, de.json (~706 linii kazdy)
```

### Kluczowe typy z bazy danych
- **UserRole**: `admin | management | project_manager | bauleiter | worker | subcontractor | office_worker | logistics | purchasing | warehouse_manager`
- **TaskStatus**: `todo | in_progress | completed | blocked`
- **TaskPriority**: `low | medium | high | urgent`
- **ProjectStatus**: `planning | active | on_hold | completed | cancelled`

### System uprawnien
- Hook `usePermissions()` w `src/hooks/usePermissions.ts`
- Kazda rola ma domyslne uprawnienia (`getRoleDefaults`)
- Mozliwosc nadpisania indywidualnych uprawnien przez `custom_permissions` w profilu
- Admin ma wszystkie uprawnienia

## Pliki kopii (NIEUZYWANE)
W katalogu glownym sa pliki z plaskimi nazwami jak `app_(app)_tasks_index.tsx` - to **stare kopie**, NIE sa uzywane przez Expo Router. Rzeczywisty kod jest w `app/(app)/`. Te kopie maja przestarzale wartosci (np. `"zarzad"` zamiast `"management"`, `"pending"` zamiast `"todo"`).

Rowniez istnieje `BSapp/BSapp/` - duplikat katalogu, nieuzywany.

---

## Historia zmian

### Sesja 2026-02-19 - Audyt i naprawy bledow

#### Przeprowadzony audyt
Pelny przeglad wszystkich plikow zrodlowych aplikacji. Zidentyfikowano bledy w kodzie.

#### Naprawione bledy

1. **Persystencja jezyka** (`app/(app)/settings.tsx`)
   - `i18n.changeLanguage()` -> `setLanguage()` z `@/src/i18n`
   - Dodano import `setLanguage, SupportedLanguage`
   - Teraz jezyk zapisuje sie w AsyncStorage i jest pamietany po restarcie

2. **Hardcoded polski tekst** (`src/providers/AuthProvider.tsx`)
   - "Twoj dostep wygasl..." -> `i18n.t("auth.access_expired")`
   - Dodano import `i18n` z `../i18n`
   - Dodano klucze `auth.access_expired` i `auth.access_expired_title` do pl/en/de.json

3. **Bezpieczenstwo logowania** (`app/login.tsx`)
   - Usunieto import `supabaseAdmin` z ekranu logowania
   - `supabaseAdmin.auth.admin.generateLink()` -> `supabase.auth.resetPasswordForEmail()`
   - Service role key nie jest juz potrzebny na ekranie logowania

4. **Walidacja NaN budżetu** (`app/(app)/projects/new.tsx`, `app/(app)/projects/[id].tsx`)
   - Dodano `isNaN()` sprawdzenie po `parseFloat(formData.budget)`
   - NaN nie trafia juz do bazy danych

5. **Null guard profile?.id** (wiele plikow)
   - `settings.tsx`: early return `if (!profile?.id) return;` w `saveProfile`
   - `projects/new.tsx`: `created_by: profile?.id || null`, `company_id: profile?.id || null`
   - `absences.tsx`: `approved_by: profile?.id || null` (approve + reject)
   - `plan.tsx`: `created_by`, `assigned_by`, `requested_by` -> dodano `|| null` (~6 instancji)

6. **Usunięcie duplikatow plikow**
   - Usunięto katalog `BSapp/BSapp/` (pelna kopia projektu)
   - Usunięto 9 plikow `app_(app)_*.tsx` z katalogu glownego (stare kopie ekranow)
   - Usunięto katalog `tsx_files/` (2 stare kopie)
   - Usunięto katalog `src_i18n_locales/` i 3 pliki `src_i18n_locales_*_updated.json`
   - Usunięto `de.json`, `en.json`, `pl.json` z roota (duplikaty - prawdziwe sa w `src/i18n/locales/`)
   - Usunięto `audit_translations.py`, `verify_translations.py` (jednorazowe skrypty)

#### Znane problemy (nienaprawione)
- **supabaseAdmin na frontendzie**: `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` jest uzywany w ~50 miejscach w kodzie (dashboard, projects, tasks, users, plan, absences, magazyn). To powinno byc przeniesione do Supabase Edge Functions lub innego backendu, ale to duza refaktoryzacja ktora wymaga osobnego planowania.

---

## Wazne uwagi
- Expo Router uzywa katalogow z nawiasami `(app)` - Glob tool moze miec problemy z tymi sciezkami
- Pliki w `app/(app)/` sa duze (500-1000+ linii) - czytaj z parametrem `limit` jesli potrzeba
- Aplikacja jest wielojezyczna - kazda zmiana w UI wymaga aktualizacji 3 plikow lokalizacji
- Supabase RLS (Row Level Security) jest wlaczony - wiele operacji wymaga adminClient bo RLS blokuje zwykly klient
