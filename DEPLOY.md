# Deploying ShareWallet

Next.js on **Vercel**, data on **Supabase**.

## 1. The Supabase project

All four apps share **one** Supabase project (`sharewallet-portfolio`), which
keeps them inside the free plan's project limit. Their table names don't clash.
CodeSim's profile table is called `codesim_profiles` so it can sit next to
ShareWallet's `profiles`.

In the Supabase SQL Editor, run the setup once, in this order:
`sharewallet-portfolio.sql` (ShareWallet + Portfolio), then
`add-codesim-marketiq.sql` (CodeSim + MarketIQ). Both are built from the
migration files listed below.

## 2. Apply the database schema

In the Supabase dashboard open **SQL Editor → New query**, paste each file in
order and click **Run**:

   1. `supabase/migrations/20260924000000_init.sql`

Or, with the Supabase CLI: `npx supabase link --project-ref <ref>` then
`npx supabase db push`.

## 3. Configure Supabase Auth

In **Authentication → URL Configuration** of the Supabase project:

- **Redirect URLs:** add `https://<your-vercel-domain>/auth/callback` (and
  `http://localhost:3000/auth/callback` for local dev). Both apps sharing the
  project need their own entry. The app passes its own callback URL, so the
  Site URL can point at either one.
- **Authentication → Providers → Email:** leave enabled (magic links).

## 4. Deploy on Vercel

1. <https://vercel.com/new> → **Import** `EmmanuelAzu/share-wallet`. Framework
   preset: Next.js (auto-detected), default build settings.
2. Add these **Environment Variables** before the first deploy:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public key |

3. Click **Deploy**. Every push to `main` redeploys automatically.

Realtime is enabled by the migration (`approval_requests`, `transactions`, `wallets`).
