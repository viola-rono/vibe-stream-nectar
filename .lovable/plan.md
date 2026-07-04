# Phase 4 — Find Your Account & Device-Approval Login

## 1. Find Your Account (login flow)

Rework `/auth` sign-in into a 3-step flow:

1. **Search step** — user types a username or name. Debounced query hits `profiles` (public safe columns: `username`, `full_name`, `avatar_url`). Show matching cards.
2. **Pick account** — clicking a result opens a modal showing that profile (avatar, name, @handle). Two buttons: **"This is me, continue"** and **"Not my account"**.
3. **Password step** — enter password for the selected account's email. Email is not shown (privacy); we resolve it server-side via a `createServerFn` that looks up the email from `user_id` using `supabaseAdmin`.

Sign-up flow stays as-is on a separate tab.

## 2. Device-Approval Login (Facebook-style)

When someone submits the password step from an unrecognized device:

- **New device (Device B)** — after correct password, we do NOT complete sign-in. Instead we create a `login_approval_requests` row (status `pending`, 5-min expiry, IP, user-agent, city best-effort). A full-screen modal shows: "Waiting for approval from your other device…" with a live spinner and a 6-digit code. Realtime subscription listens for status changes.
- **Existing device (Device A)** — a realtime subscription on the signed-in session listens for new pending requests for that user. When one arrives, a full-screen `<Dialog>` takes over showing device info + code and three buttons:
  - **"Yes, it's me"** → sets status `approved`
  - **"Not me, block it"** → sets status `blocked`, revokes all sessions server-side, triggers a security-alert email
  - **Ignore** → auto-expires after 5 min
- When Device B sees `approved`, it calls a server fn that mints a short-lived one-time token; Device B exchanges it for a real session via `signInWithPassword` (the password was already validated) and navigates to `/home`.

### Not-me action
- Server fn (admin) calls `auth.admin.signOut(user_id, 'global')`, marks request `blocked`, and sends a security email via **Lovable Emails** (auth email infra) with IP, UA, timestamp, and a "Reset password" link.

## 3. Database (migration)

```sql
create table public.login_approval_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code text not null,
  status text not null default 'pending', -- pending|approved|blocked|expired
  ip text, user_agent text, location text,
  approval_token text unique,             -- one-time, set on approve
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes',
  resolved_at timestamptz
);
-- grants, RLS: user can SELECT their own rows; all writes via server fns (service role).
-- Add table to supabase_realtime publication.
```

## 4. Server functions (`src/lib/auth-approval.functions.ts`)

- `searchAccounts({ q })` — public, returns up to 5 profiles (`username`, `full_name`, `avatar_url`, `id`). No email.
- `startLoginApproval({ userId, password })` — verifies password by attempting sign-in with a scratch client, immediately signs that scratch client out, then creates a pending request; returns `{ requestId, code }`.
- `resolveApproval({ requestId, action })` — requires auth as the target user (via `requireSupabaseAuth`); sets status and, on block, revokes sessions + sends alert email.
- `exchangeApproval({ requestId, approvalToken })` — returns a magic-link/OTP the client uses to complete sign-in, OR simply returns `{ ok: true }` after which the client re-runs `signInWithPassword` (simpler; password is held only in memory on Device B).

## 5. Frontend

- `src/routes/auth.tsx` — rewrite sign-in into stepped UI.
- `src/components/DeviceApprovalWatcher.tsx` — mounted in `_authenticated/route.tsx`; subscribes to `login_approval_requests` for the current user; renders full-screen approval `<Dialog>`.
- `src/components/AwaitingApprovalScreen.tsx` — full-screen "waiting" UI on Device B with realtime status.

## 6. Security alert email

Uses the existing Lovable Emails auth infra (`email_domain--scaffold_auth_email_templates` if not scaffolded). Called from `resolveApproval` on `blocked`.

## Notes

- Password is never stored server-side beyond the sign-in verification attempt.
- Codes are 6 digits, shown on both devices for visual match (defense against phishing).
- Requests auto-expire; a Postgres check + `expires_at` filter makes stale requests inert without a cron.
- If a user has no other signed-in device, the waiting screen offers a fallback: "No other device? Use email code" (email OTP via `supabase.auth.signInWithOtp`).
