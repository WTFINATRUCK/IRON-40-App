# Setup

## Live projects
- Database: Supabase project `iron-40` (us-east-2). Migrations in `supabase/migrations`, demo catalog in `supabase/seed.sql`.
- Vercel projects (one per app, separate domains):
  - `iron40-customer` → https://wee-d-liver.vercel.app
  - `iron40-driver` → https://wee-d-liver-driver.vercel.app
  - `iron40-ops` → https://wee-d-liver-ops.vercel.app
- Internal names (repo, Vercel project names, `@iron40/*` packages, tenant slug `iron40`) are not shown to customers.

## Environment variables (per Vercel project)
| Variable | customer | driver | ops |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_TENANT_SLUG` | ✓ | | |
| `NEXT_PUBLIC_CUSTOMER_URL` | | | ✓ |
| `NEXT_PUBLIC_SITE_URL` | ✓ | ✓ | ✓ |

No service-role key is used anywhere. Every privileged action is a database function that checks the caller.

## Local development
```bash
npm install
cp .env.example apps/customer/.env.local   # repeat for driver and ops
npm run dev:customer   # :3000
npm run dev:driver     # :3001
npm run dev:ops        # :3002
```

## Onboarding real people
- **First owner:** create the account in the ops app's Join page, then insert a `staff` row with role `owner` once via SQL.
- **Staff and drivers:** invite-only. Ops → Drivers (or Settings) creates a one-time code that expires in 48 hours.
- **Customers:** sign up in the storefront, confirm email, add details + ID, then wait for approval in Ops → ID review.

## Supabase dashboard settings to change before launch
See the "Manual steps" section of `SECURITY_AUDIT.md`.
