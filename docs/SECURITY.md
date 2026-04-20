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
| `RESEND_API_KEY` | **tajna** | Netlify env (prod) + `.env` (dev) | **nigdy w bundlu** |

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

### 3.2. `RESEND_API_KEY`

1. **Resend Dashboard** → `API Keys` → revoke stary klucz.
2. Utwórz nowy klucz z uprawnieniami `Sending access` do domeny projektu.
3. **Netlify Dashboard** → `Environment variables` → zaktualizuj.
4. Trigger deploy.
5. Zweryfikuj wysyłkę emaila przez `netlify/functions/send-email.js`.

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
4. **Resend Dashboard → Emails** — sprawdź, czy nie wysłano niczego
   nieautoryzowanego.
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
