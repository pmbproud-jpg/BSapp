# 📅 Date/Time Pickers - Instrukcja

## ✅ Co zostało dodane:

1. **Nowy komponent** `DatePicker.tsx`
   - Ikona kalendarza
   - Na WEB: natywny `<input type="date">` 
   - Na MOBILE: modal z szybkim wyborem (Dziś, Jutro, Za tydzień, Za miesiąc)

2. **Zaktualizowane formularze:**
   - `app/(app)/projects/new.tsx` - pola: Data rozpoczęcia, Data zakończenia
   - `app/(app)/tasks/new.tsx` - pole: Termin wykonania

## 📦 Struktura ZIP:

```
components/
  └── DatePicker.tsx          → NOWY PLIK

app/(app)/
  ├── projects/
  │   └── new.tsx             → NADPISZ
  └── tasks/
      └── new.tsx             → NADPISZ
```

## 🔧 Instalacja:

### Krok 1: Rozpakuj ZIP do folderu projektu BSapp
Wszystkie pliki automatycznie trafią na swoje miejsca.

### Krok 2: Restart aplikacji
```powershell
npx expo start --clear
```

## ✅ Rezultat:

### Przed:
- Ręczne wpisywanie dat w formacie YYYY-MM-DD
- Łatwo o błędy

### Po:
- Kliknij w pole → pojawia się kalendarz
- Wybierz datę kliknięciem
- Data automatycznie formatowana
- Ikona 📅 przy każdym polu daty

## 🎯 Następny krok:

Po wdrożeniu Date Pickers, kolejny punkt to:
**👥 Przypisywanie zespołów do projektów** (multi-select pracowników)

