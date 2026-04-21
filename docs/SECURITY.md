# Bezpieczeństwo — procedury i polityki

## 1. Model bezpieczeństwa BSapp

Warstwy obrony (od frontu do bazy):

1. **Frontend (Expo bundle)** — używa wyłącznie `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   Klucz ten jest publiczny z założenia; bezpieczeństwo zapewnia RLS + proxy.
2. **Supabase Auth (JWT)** — każdy request z klienta zawiera token użytkownika.
3. **Proxy Netlify Function** — [`netlify/functions/supabase-admin.js`](../netlify/functions/supabase-admin.js)
   weryfikuje JWT, pobiera rolę z `profiles`, sprawdza `checkPermission()`,
   filtruje allowlisty (`ALLOWED_TABLES`, `ALLOWED_DB_ACTIONS`, `ALLOWED_BUCKETS`,
   `ALLOWED_AUTH_ACTIONS`). Dopiero tu używany jest `SUPABASE_SERVICE_ROLE_KEY`.
4. **RLS w Postgres** — **defense in depth**. Jeśli ktoś ominie proxy
   (np. wykona zapytanie bezpośrednio z ANON_KEY + ważny JWT), policy
   na poziomie bazy nadal egzekwują kontekst użytkownika (self / membership /
   rola). Migracja `20260419_harden_rls.sql` domyka RLS na tabelach,
   które wcześniej miały `USING (true)`.

---

## 2. Sekrety i ich zakres

| Zmienna | Prefiks | Gdzie trzymać | Widoczność |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | publiczna | `.env` + Netlify env | jawna w bundlu frontendu |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | publiczna | `.env` + Netlify env | jawna w bundlu frontendu |
| `EXPO_PUBLIC_SITE_URL` | publiczna | `.env` + Netlify env | jawna |
| `SUPABASE_SERVICE_ROLE_KEY` | **tajna** | Netlify env (prod) + `.env` (dev) | **nigdy w bundlu** |
| `GMAIL_USER` | **tajna** | Netlify env | server-side (send-email.js) |
| `GMAIL_APP_PASSWORD` | **tajna** | Netlify env | server-side (send-email.js) |

**Krytyczne:** `SUPABASE_SERVICE_ROLE_KEY` omija RLS. Wyciek = pełny dostęp
do bazy danych (odczyt haseł hashy? nie — Supabase Auth trzyma hasła w
`auth.users` niedostępnym przez PostgREST; ale pełny dostęp do wszystkich
tabel `public.*` oraz Storage).

---

## 3. Procedura rotacji kluczy

Wykonaj w tej kolejności:

### 3.1. `SUPABASE_SERVICE_ROLE_KEY`

1. **Supabase Dashboard** → `Project Settings` → `API` → sekcja
   `service_role secret` → klik `Roll` (lub `Regenerate`).
2. Skopiuj nową wartość.
3. **Netlify Dashboard** → `Site settings` → `Environment variables` →
   zaktualizuj `SUPABASE_SERVICE_ROLE_KEY` na produkcyjną wartość.
4. **Trigger deploy** (Netlify automatycznie, albo `netlify deploy --prod`).
5. Lokalnie: zaktualizuj `.env` (do `netlify dev`). **Nie commituj.**
6. Zweryfikuj, że `/.netlify/functions/supabase-admin` nadal działa
   (zaloguj się w aplikacji i wykonaj dowolną operację admin).

### 3.2. `GMAIL_APP_PASSWORD` (Gmail SMTP dla send-email.js)

1. https://myaccount.google.com/apppasswords — zaloguj się na konto z `GMAIL_USER`.
2. Znajdź istniejące hasło dla BSapp → **Remove**.
3. **Create** nowe → nazwa np. `bsapp-netlify-smtp`.
4. Google pokaże 16-znakowy string w 4 blokach po 4 — skopiuj **bez spacji**.
5. **Netlify Dashboard** → `Environment variables` → zaktualizuj `GMAIL_APP_PASSWORD`.
   Albo CLI: `netlify env:set GMAIL_APP_PASSWORD "xxxxxxxxxxxxxxxx"`.
6. Zweryfikuj wysyłkę emaila przez flow reset hasła / zaproszenia.

### 3.3. Po rotacji — weryfikacja

```bash
# Upewnij się, że .env nie jest w repo
git ls-files --error-unmatch .env && echo "FAIL: .env w repo" || echo "OK: .env nietrackowany"

# Sprawdź, że w historii git nie ma plaintext service_role
git log --all -p -S 'sb_secret_' | head -50
```

Jeśli history git zawiera wyciekłe klucze — rozważ `git filter-repo`
(zmiana historii) + wymuszone push, ale to **destruktywna operacja**
i wymaga koordynacji z zespołem. Alternatywa: rotacja wystarcza, bo stary
klucz staje się nieważny po `Roll` w Supabase.

---

## 4. Co zrobić przy podejrzeniu wycieku

1. **Natychmiast zrotuj wszystkie klucze** (punkt 3).
2. **Supabase Dashboard → Logs → API Logs** — sprawdź nietypowy ruch z
   nieznanych IP.
3. **Supabase Dashboard → Authentication → Users** — sprawdź, czy są
   konta, których nie założyłeś.
4. **Gmail → Recent activity** (https://myaccount.google.com/notifications)
   — sprawdź, czy nie wysłano niczego nieautoryzowanego przez SMTP.
5. Jeśli ktoś mógł pobrać tabelę `profiles` — wymuś reset haseł wszystkim
   użytkownikom przez `auth.admin.generateLink(type: 'recovery')`.

---

## 5. Polityka commitów

- **`.env` ani żaden plik z sekretami nigdy nie trafia do repo.**
  `.gitignore` pokrywa: `.env`, `.env.*.local`, `.netlify/`.
- `.env.example` jest w repo — służy jako szablon (bez wartości).
- `package-lock.json` jest trackowany (reproducible builds).
- Pre-commit hook (`.husky/pre-commit` + `.lintstagedrc.js`) weryfikuje
  `tsc --noEmit --skipLibCheck` przed każdym commitem.

---

## 6. Kontakt przy incydencie

Ten plik jest punktem startowym. W razie poważnego incydentu
zaktualizuj listę kontaktów zespołu odpowiadającego za reakcję.
