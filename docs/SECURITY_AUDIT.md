# IRON 40 — Security audit

Date: 2026-11-17 · Scope: database (schema, RLS, functions, storage), the three Next.js apps, hosting config, dependencies, repo.

**Result:** no critical issues open in the code. Five fixes were made during the audit. Four platform settings
need the owner to change them in dashboards before real customers are onboarded (marked **Owner action**).

## How it was tested
- **42 adversarial probes** run against the live database as each role (anonymous visitor, customer, driver,
  dispatcher, and an owner of a *different* operator), inside a rolled-back transaction. All 42 were blocked or
  returned only the caller's own rows. Highlights:
  - Anonymous: can't read customers, orders, hubs, rate limits; can't call checkout or `whoami`.
  - Customer: can't insert orders directly, self-approve their ID, read other customers or addresses, read
    hubs/driver stock/drivers, read invite hashes, call any `ops_*` function, order to someone else's address,
    send negative quantities, buy another operator's product, exceed the flower limit, redeem a driver invite,
    upload into another customer's ID folder, or read any ID image.
  - Driver: can't read customers or the audit log, dispatch, load their own vehicle, or become a customer.
  - Dispatcher: can't create invites or change settings.
  - Other operator's owner: sees 0 of this operator's customers, orders and drivers; can't review its IDs or
    load its drivers.
- **End-to-end order test** (rolled back): driver online → customer order auto-assigned to the nearest driver
  with stock → en route → arrived → wrong birth year rejected → correct year delivered. Taxes and totals were
  computed server-side; vehicle stock was decremented.
- **Supabase security advisor** run (results below).
- **Live headers** checked on the deployed storefront and ops app.
- **`npm audit`**: 0 vulnerabilities. **Secret scan** of the repo and git history: no keys or passwords.

## Architecture controls (what holds the line)
| Control | Where |
| --- | --- |
| Tables are read-only to the API; every write is a `SECURITY DEFINER` function that checks the caller's role and operator | `supabase/migrations/*_rpc.sql` |
| Row-level security on every table; customers see only their rows, drivers only orders assigned to them, staff only their operator | `*_schema.sql` |
| Prices, taxes, limits, store hours, delivery zone and driver choice are computed in the database; the browser sends only product ids and quantities | `place_order` |
| No service-role key anywhere in the apps or env vars | repo-wide |
| Staff and drivers are invite-only (one-time 12-character codes, SHA-256 hashed, 48-hour expiry, 5 tries/hour) | `ops_create_invite`, `redeem_*_invite` |
| One account = one role; a customer login is refused by the driver and ops apps, and vice versa | `passwordSignIn`, `account_kind` |
| Three apps on three domains with separately named, HttpOnly, Secure, SameSite=Lax session cookies; no browser-side Supabase client | `packages/core/src/supabase/*` |
| Strict CSP with a per-request nonce (`strict-dynamic`), HSTS preload, `X-Frame-Options: DENY`, COOP/CORP, tight Permissions-Policy | `proxy.ts`, `next.config.ts` |
| ID photos: private bucket, path-locked to the uploader, magic-byte check, re-encoded server-side (strips EXIF/GPS, blocks image bombs), 2-minute signed URLs for reviewers only | `account/actions.ts`, `*_storage.sql` |
| Rate limits in the database on checkout, profile, ID submit, addresses, invites, pings | `private.rate_limit` |
| Append-only audit log of stock, price, ID, driver and settings changes | `audit_log` |
| Open-redirect-safe `next` parameter; generic login/sign-up errors (no account enumeration) | `safeNext`, `passwordSignIn` |
| Service worker never caches pages or API data | `public/sw.js` |

## Findings
| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| F-01 | High | ID photo uploads would exceed Vercel's 4.5 MB request limit with normal phone photos, so verification would fail in production | **Fixed**: photos are shrunk to ≤1600 px in the browser before upload; server limit 4 MB and still re-encodes |
| F-02 | High | GitHub repo `IRON-40-App` is public. No secrets are in it, but the full schema and business logic are readable | **Owner action**: GitHub → Settings → Danger zone → Change visibility → Private (this session's GitHub access can't change settings) |
| F-03 | High | Staff accounts (which can view ID photos) use password-only login | **Owner action / next build**: enable TOTP MFA in Supabase Auth, then require `aal2` in `private.require_staff` and add an MFA step to the ops login |
| F-04 | Medium | Drivers kept read access to name, phone and address of every past order indefinitely | **Fixed in migration 004**: only active orders plus 12 hours after close |
| F-05 | Medium | Leaked-password protection is off (Supabase advisor) | **Owner action**: Supabase → Auth → Providers → Email → enable leaked password protection; set minimum length 10 |
| F-06 | Medium | Three demo accounts exist with passwords shared in chat (owner, driver, customer @example.com) | **Owner action before launch**: delete them in Supabase → Auth → Users |
| F-07 | Medium | Email confirmation uses Supabase's default sender, which only delivers to your Supabase team members, and redirect URLs aren't allow-listed yet | **Owner action**: Auth → SMTP (custom sender, e.g. Resend/Postmark) and Auth → URL configuration: add the three app URLs + `/auth/confirm` |
| F-08 | Low | Two simultaneous checkouts by the same customer could both pass the "one active order" check | **Fixed in migration 004**: per-customer row lock trigger |
| F-09 | Low | Anonymous direct reads of `products` errored (policy called a staff-only helper). App unaffected (menu uses `get_menu`) | **Fixed in migration 004**: split policy per role |
| F-10 | Low | Drivers could toggle online/offline without limit (each toggle runs a dispatch sweep) | **Fixed in migration 004**: 60 per hour |
| F-11 | Low | Sign-up has no CAPTCHA, so bots can create empty accounts (they can't do anything without ID approval) | Recommended: enable Turnstile or hCaptcha in Supabase Auth |
| F-12 | Low | Anyone can inflate a QR campaign's scan count by hitting `/q/<code>` | Accepted (analytics only); add a Vercel Firewall rate-limit rule on `/q/*` if it matters |
| F-13 | Low | Repeated address saves could map the delivery-area edge | Accepted: capped at 10 saves/day per account; hub coordinates are never returned |
| F-14 | Info | Advisor lists 29 `SECURITY DEFINER` functions callable by signed-in users and 2 by anonymous visitors | By design: they are the API. Each checks the caller and runs with `search_path = ''` |
| F-15 | Info | ID photos are kept indefinitely | Set a retention period that matches your state's record-keeping rule; staff deletion is already permitted by policy |
| F-16 | Info | The door check matches the birth year typed by the driver: a compliance aid, not a strong control | Upgrade path: scan the ID's PDF417 barcode in the driver app |

**Migration 004 (`supabase/migrations/20261117000004_hardening.sql`) is written and committed. Supabase asked for
approval to apply it and the prompt timed out; it is applied once you approve it.**

## Before taking real orders
1. Approve migration 004 (F-04, F-08, F-09, F-10).
2. Make the repo private (F-02).
3. Supabase Auth: custom SMTP, redirect URLs, leaked-password protection, CAPTCHA, MFA (F-03, F-05, F-07, F-11).
4. Delete demo accounts; create the real owner (see `SETUP.md`).
5. Enter the real license number, state, tax rates, hours and limits in Ops → Settings, and the real hub in Ops → Hubs.
6. Have a cannabis attorney confirm state rules on delivery hours, per-order limits, track-and-trace reporting
   (e.g. Metrc), and record retention. Track-and-trace integration is not built yet.
