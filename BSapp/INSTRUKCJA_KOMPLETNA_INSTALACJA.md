# 🚀 BSapp - KOMPLETNA INSTALACJA - WSZYSTKIE EKRANY

## 📋 LISTA WSZYSTKICH PLIKÓW DO SKOPIOWANIA

### 1️⃣ TABS NAVIGATION (app/(app)/_layout.tsx)
**Ścieżka:** `BSapp/app/(app)/_layout.tsx`
**Źródło:** `app_(app)_layout_tabs.tsx`

Ten plik zastępuje istniejący `_layout.tsx` w folderze `(app)`.

**Co robi:**
- Pokazuje header z nazwą firmy "Building Solutions GmbH"
- Wyświetla imię i nazwisko użytkownika + rolę
- Tworzy bottom tabs (Dashboard, Projekty, Zadania, Użytkownicy*, Ustawienia)
- * Tab "Użytkownicy" widoczny tylko dla admin

---

### 2️⃣ PROJEKTY - 3 pliki

#### 2.1 Lista projektów
**Ścieżka:** `BSapp/app/(app)/projects/index.tsx`
**Źródło:** `app_(app)_projects_index.tsx`

**Funkcje:**
- Wyświetla wszystkie projekty jako karty
- Status projektu (planning, active, on_hold, completed, cancelled)
- Filtrowanie i odświeżanie
- FAB (+ button) - tylko dla admin/zarząd/PM
- Kliknięcie → szczegóły projektu

#### 2.2 Szczegóły projektu
**Ścieżka:** `BSapp/app/(app)/projects/[id].tsx`
**Źródło:** `app_(app)_projects_[id].tsx`

**Funkcje:**
- Wyświetla wszystkie dane projektu
- Lista zadań w projekcie
- Przyciski: Edytuj, Usuń (tylko admin/zarząd/PM)
- Nawigacja do zadań

#### 2.3 Nowy projekt
**Ścieżka:** `BSapp/app/(app)/projects/new.tsx`
**Źródło:** `app_(app)_projects_new.tsx`

**Funkcje:**
- Formularz tworzenia projektu
- Pola: nazwa*, opis, lokalizacja, status, start_date, end_date, budget
- Walidacja i zapisywanie do Supabase

---

### 3️⃣ ZADANIA - 3 pliki

#### 3.1 Lista zadań
**Ścieżka:** `BSapp/app/(app)/tasks/index.tsx`
**Źródło:** `app_(app)_tasks_index.tsx`

**Funkcje:**
- Wyświetla wszystkie zadania
- Filtry: Wszystkie / Moje / Oczekujące
- Status (pending, in_progress, completed, cancelled)
- Priorytet (low, medium, high) - kolorowe ikony
- FAB (+ button) - dla admin/zarząd/PM/bauleiter
- Kliknięcie → szczegóły zadania

#### 3.2 Szczegóły zadania
**Ścieżka:** `BSapp/app/(app)/tasks/[id].tsx`
**Źródło:** `app_(app)_tasks_[id].tsx`

**Funkcje:**
- Wyświetla wszystkie dane zadania
- System komentarzy (live chat)
- Przypisanie do użytkownika
- Przyciski: Edytuj, Usuń (dla uprawnionych)

#### 3.3 Nowe zadanie
**Ścieżka:** `BSapp/app/(app)/tasks/new.tsx`
**Źródło:** `app_(app)_tasks_new.tsx`

**Funkcje:**
- Formularz tworzenia zadania
- Wybór projektu z listy
- Przypisanie użytkownika
- Ustawienie priorytetu i statusu
- Termin wykonania

---

### 4️⃣ UŻYTKOWNICY (tylko dla Admin)

#### 4.1 Lista użytkowników
**Ścieżka:** `BSapp/app/(app)/users/index.tsx`
**Źródło:** `app_(app)_users_index.tsx`

**Funkcje:**
- Lista wszystkich użytkowników z rolami
- Kolorowe ikony dla każdej roli
- Edycja i usuwanie użytkowników
- FAB (+ button) do dodawania nowych

---

### 5️⃣ USTAWIENIA

#### 5.1 Ekran ustawień
**Ścieżka:** `BSapp/app/(app)/settings.tsx`
**Źródło:** `app_(app)_settings.tsx`

**Funkcje:**
- Profil użytkownika (zmiana imienia i nazwiska)
- Wybór języka (DE/PL/EN) z flagami
- Informacje o firmie: Building Solutions GmbH
- Przycisk wylogowania
- Footer z wersją aplikacji

---

### 6️⃣ TŁUMACZENIA - 3 pliki

#### 6.1 Polski (pl.json)
**Ścieżka:** `BSapp/src/i18n/locales/pl.json`
**Źródło:** `src_i18n_locales_pl_updated.json`

#### 6.2 Niemiecki (de.json)
**Ścieżka:** `BSapp/src/i18n/locales/de.json`
**Źródło:** `src_i18n_locales_de_updated.json`

#### 6.3 Angielski (en.json)
**Ścieżka:** `BSapp/src/i18n/locales/en.json`
**Źródło:** `src_i18n_locales_en_updated.json`

**Zawartość:**
- Wszystkie klucze dla nawigacji
- Projekty (status, komunikaty)
- Zadania (status, priorytety, filtry)
- Użytkownicy
- Ustawienia
- Role użytkowników

---

## 📂 STRUKTURA FOLDERÓW - KOMPLETNA

```
BSapp/
├── app/
│   ├── (app)/
│   │   ├── _layout.tsx          ← TABS + HEADER (NOWY)
│   │   ├── dashboard.tsx        ← istniejący
│   │   ├── projects/
│   │   │   ├── index.tsx        ← NOWY
│   │   │   ├── [id].tsx         ← NOWY
│   │   │   └── new.tsx          ← NOWY
│   │   ├── tasks/
│   │   │   ├── index.tsx        ← NOWY
│   │   │   ├── [id].tsx         ← NOWY
│   │   │   └── new.tsx          ← NOWY
│   │   ├── users/
│   │   │   └── index.tsx        ← NOWY (admin only)
│   │   └── settings.tsx         ← NOWY
│   ├── _layout.tsx              ← istniejący (AuthProvider)
│   ├── index.tsx                ← istniejący (redirect)
│   ├── login.tsx                ← istniejący
│   └── reset-password.tsx       ← istniejący
└── src/
    └── i18n/
        └── locales/
            ├── pl.json          ← ZAKTUALIZOWANY
            ├── de.json          ← ZAKTUALIZOWANY
            └── en.json          ← ZAKTUALIZOWANY
```

---

## ⚙️ INSTRUKCJE KOPIOWANIA

### Krok 1: Backup
```powershell
# Zrób backup obecnego _layout.tsx
cd C:\Users\PMBPR\Documents\BSapp
Copy-Item "app\(app)\_layout.tsx" "app\(app)\_layout.tsx.backup"
```

### Krok 2: Utwórz foldery
```powershell
# Utwórz foldery projects/
New-Item -ItemType Directory -Force -Path "app\(app)\projects"

# Utwórz foldery tasks/
New-Item -ItemType Directory -Force -Path "app\(app)\tasks"

# Utwórz foldery users/
New-Item -ItemType Directory -Force -Path "app\(app)\users"
```

### Krok 3: Skopiuj pliki

**TABS + HEADER:**
```powershell
# Zastąp istniejący _layout.tsx
Copy-Item "ścieżka\app_(app)_layout_tabs.tsx" "app\(app)\_layout.tsx"
```

**PROJEKTY:**
```powershell
Copy-Item "ścieżka\app_(app)_projects_index.tsx" "app\(app)\projects\index.tsx"
Copy-Item "ścieżka\app_(app)_projects_[id].tsx" "app\(app)\projects\[id].tsx"
Copy-Item "ścieżka\app_(app)_projects_new.tsx" "app\(app)\projects\new.tsx"
```

**ZADANIA:**
```powershell
Copy-Item "ścieżka\app_(app)_tasks_index.tsx" "app\(app)\tasks\index.tsx"
Copy-Item "ścieżka\app_(app)_tasks_[id].tsx" "app\(app)\tasks\[id].tsx"
Copy-Item "ścieżka\app_(app)_tasks_new.tsx" "app\(app)\tasks\new.tsx"
```

**UŻYTKOWNICY:**
```powershell
Copy-Item "ścieżka\app_(app)_users_index.tsx" "app\(app)\users\index.tsx"
```

**USTAWIENIA:**
```powershell
Copy-Item "ścieżka\app_(app)_settings.tsx" "app\(app)\settings.tsx"
```

**TŁUMACZENIA:**
```powershell
Copy-Item "ścieżka\src_i18n_locales_pl_updated.json" "src\i18n\locales\pl.json"
Copy-Item "ścieżka\src_i18n_locales_de_updated.json" "src\i18n\locales\de.json"
Copy-Item "ścieżka\src_i18n_locales_en_updated.json" "src\i18n\locales\en.json"
```

### Krok 4: Restart aplikacji
```powershell
npx expo start --clear
```

---

## 🎯 CO ZOBACZYSZ PO INSTALACJI

### 1. HEADER (na każdym ekranie)
```
┌─────────────────────────────────────┐
│ 🏢 Building Solutions GmbH          │
│ 👤 Administrator                    │
│    Administrator                    │  [Logout]
└─────────────────────────────────────┘
```

### 2. BOTTOM TABS
```
[🏠 Dashboard] [💼 Projekty] [✓ Zadania] [👥 Użytkownicy*] [⚙️ Ustawienia]
```
*Użytkownicy = tylko admin

### 3. FUNKCJONALNOŚĆ

**Dashboard:**
- Statystyki (aktywne projekty, oczekujące zadania, ukończone zadania)
- Szybkie akcje (dodaj projekt, dodaj zadanie)

**Projekty:**
- Lista wszystkich projektów
- Szczegóły projektu z listą zadań
- Tworzenie nowego projektu
- Edycja i usuwanie (admin/zarząd/PM)

**Zadania:**
- Lista wszystkich zadań z filtrami
- Szczegóły zadania z komentarzami
- Tworzenie nowego zadania z przypisaniem
- Edycja i usuwanie (admin/zarząd/PM/bauleiter)

**Użytkownicy (tylko admin):**
- Lista wszystkich użytkowników z rolami
- Edycja i usuwanie użytkowników

**Ustawienia:**
- Zmiana imienia i nazwiska
- Wybór języka (DE/PL/EN)
- Informacje o firmie
- Wylogowanie

---

## 🛠️ TESTOWANIE

### Test 1: Nawigacja
1. Zaloguj się jako admin (pmb.proud@gmail.com / Admin123!)
2. Sprawdź czy header pokazuje "Building Solutions GmbH" i "Administrator"
3. Kliknij każdy tab i sprawdź czy działa

### Test 2: Projekty
1. Kliknij tab "Projekty"
2. Kliknij przycisk "+" (FAB)
3. Wypełnij formularz i utwórz projekt
4. Kliknij na projekt aby zobaczyć szczegóły

### Test 3: Zadania
1. Kliknij tab "Zadania"
2. Kliknij przycisk "+" (FAB)
3. Wypełnij formularz (wybierz projekt, przypisz użytkownika)
4. Kliknij na zadanie aby zobaczyć szczegóły
5. Dodaj komentarz

### Test 4: Ustawienia
1. Kliknij tab "Ustawienia"
2. Zmień imię i nazwisko → Zapisz
3. Zmień język (DE/PL/EN)
4. Sprawdź czy wszystko przetłumaczyło się

---

## ⚠️ WAŻNE UWAGI

### 1. Uprawnienia
- **Admin:** Wszystko
- **Zarząd:** Projekty, Zadania (nie może zarządzać użytkownikami)
- **Project Manager:** Projekty, Zadania
- **Bauleiter:** Zadania
- **Worker:** Tylko odczyt

### 2. Baza danych
Wszystkie tabele już istnieją (profiles, projects, tasks, task_comments).
RLS policies są skonfigurowane.

### 3. Nazwa firmy
Nazwa "Building Solutions GmbH" jest hardcoded w:
- `app/(app)/_layout.tsx` (header)
- `app/(app)/settings.tsx` (sekcja firma)

Jeśli chcesz zmienić nazwę firmy, musisz edytować te 2 pliki.

---

## 🎉 GOTOWE!

Masz teraz **pełną aplikację** z:
- ✅ Headerem z nazwą firmy i użytkownikiem
- ✅ Bottom tabs navigation
- ✅ Projekty (CRUD)
- ✅ Zadania (CRUD + komentarze)
- ✅ Użytkownicy (zarządzanie dla admin)
- ✅ Ustawienia (profil + język)
- ✅ 3 języki (DE/PL/EN)
- ✅ Role-based access control

**POWODZENIA! 🚀**
