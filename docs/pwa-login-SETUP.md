# PWA login — manual setup

The web app (`web/`) reuses the **same Supabase project, `profiles` table, RLS, and
`delete_user` RPC** as the iOS milestone (`feat/social-accounts-login`). The backend is
already live, so there is **almost nothing to do** — the code is complete and builds. The
one thing that can't be scripted is allow-listing the web origin so Google OAuth can
return to the app.

Scope matches iOS: **email 6-digit code + Google sign-in + a `@handle` profile.** Apple
sign-in is deferred; there is no Apple button on web.

---

## 1. Credentials (already provided)

`web/.env` (gitignored) holds the Vite-exposed vars. `web/.env.example` documents them:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<the eyJ… anon key>
```

The anon key is public-safe (RLS-protected) — it is meant to ship to the browser. If
either var is missing the app **still runs**; sign-in simply disables itself with a note
(mirrors iOS's graceful-unconfigured behavior).

## 2. The ONE required backend change: allow-list the web origin

Google OAuth returns to `window.location.origin`, and Supabase only redirects to
allow-listed origins.

**Supabase dashboard → Authentication → URL Configuration → Redirect URLs**, add:

- **Dev:** `http://localhost:5173` (the project's Vite dev port — `npm run dev`)
- **Preview (optional):** `http://localhost:4173` (`npm run preview`)
- **Production:** your deployed origin, e.g. `https://your-app.example.com`

Until an origin is allow-listed, the **email 6-digit code** path still works there, but
**Google sign-in** will fail the redirect back.

## 3. Nothing else to configure

These are already done from the iOS setup and are shared, not duplicated:

- **Email provider** + the Magic Link template carrying `{{ .Token }}` (so the 6-digit
  code appears in the email). The web app calls `signInWithOtp` → `verifyOtp`.
- **Google provider** (OAuth client id + secret).
- **Account linking ON** (Google + email at the same address resolve to one user/profile).
- The **`profiles`** table, its RLS policies, the handle format/uniqueness constraint, and
  the **`delete_user()`** RPC used by account deletion.

Do **not** re-run the migration — the iOS setup already applied it.

---

## 4. Run & verify

```
cd web
npm install
npm run dev     # http://localhost:5173
```

- **Signed-out:** the whole app (BLE connect, board grid, light up) works with no account.
- **Email code:** header → "Sign in" → enter email → "Email me a code" → type the 6-digit
  code → signed in. A first-time account is then prompted to pick a `@handle`.
- **Handle:** live-validated (3–20 chars, `[a-z0-9_]`, case-insensitive unique). Saving
  creates the `profiles` row (verify in Supabase → Table editor → `profiles`).
- **Google:** requires the origin allow-listed (step 2). The browser navigates to Google
  and returns; supabase-js auto-completes the session.
- **Persistence:** reload the page → session restores without re-auth. The header shows
  `@handle` with a menu for **Sign out** / **Delete account**.

## Parity notes (web vs iOS)

- **No Apple button** on web (deferred on both; iOS keeps a stubbed method, web omits it
  entirely).
- **Session restore** uses `onAuthStateChange`'s `INITIAL_SESSION` event, the direct
  analogue of iOS's `.initialSession`. An `isRestoring` flag prevents a "Sign in" flash.
- **Bundle cost:** `@supabase/supabase-js` adds ~290 KB raw (~90 KB gzipped) to the JS
  bundle. Acceptable for the feature; if it ever matters, the client import can be code-
  split behind the first sign-in interaction.
