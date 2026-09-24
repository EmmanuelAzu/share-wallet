<p align="center"><img src="public/logo.svg" width="72" alt="ShareWallet logo"></p>

# ShareWallet

Collaborative expense & shared-account platform. A wallet has one admin who can
spend directly and members whose purchases execute only after the group approves.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui ·
Supabase (Postgres, Auth, Realtime) · Recharts · Vercel

## Getting started

```bash
cp .env.example .env.local     # fill in your Supabase URL + anon key
npm install
npx supabase db push           # or run supabase/migrations/*.sql in the SQL editor
npm run dev
```

See [docs/supabase-rls.md](docs/supabase-rls.md) for auth, realtime and the security model.

## System design

```mermaid
flowchart LR
  subgraph Client [Next.js client]
    UI[Wallet page] -- fetch --> API
    UI <-- postgres_changes --> RT[(Supabase Realtime)]
  end
  subgraph Server [Next.js route handlers]
    API["/api/v1/payments/*<br/>/api/v1/wallets/*"]
  end
  API -- "supabase.rpc() as the signed-in user" --> DB
  subgraph Supabase
    DB[(Postgres + RLS)]
    DB -- WAL --> RT
  end
```

### Purchase flow

```mermaid
sequenceDiagram
  actor M as Member
  participant API as /payments/transact
  participant DB as Postgres
  actor O as Other members
  M->>API: POST {walletId, amount, merchant, category}
  API->>DB: wallet_members.role?
  alt admin
    API->>DB: rpc execute_wallet_deduction
    DB-->>API: completed transaction
  else member
    API->>DB: rpc request_member_purchase
    DB-->>O: realtime: new approval_request
    O->>DB: rpc cast_approval_vote (via /approvals/:id/vote)
    Note over DB: approvals ≥ required →<br/>lock wallet, check balance,<br/>deduct, mark completed
    DB-->>M: realtime: request approved
  end
```

### Data model

```mermaid
erDiagram
  profiles ||--o{ wallet_members : joins
  wallets ||--o{ wallet_members : has
  wallets ||--o{ transactions : records
  transactions ||--o| approval_requests : "needs (member spend)"
  approval_requests ||--o{ approval_votes : collects
  profiles ||--o{ approval_votes : casts
```

## API

The OpenAPI 3.0 spec for `/api/v1/*` is in [docs/openapi.yaml](docs/openapi.yaml).

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/payments/transact` | Spend (admin: immediate · member: approval request) |
| POST | `/api/v1/payments/approvals/{requestId}/vote` | Approve / reject a member purchase |
| POST | `/api/v1/wallets` | Create a wallet |
| POST | `/api/v1/wallets/{walletId}/deposit` | Admin top-up |
| POST | `/api/v1/wallets/{walletId}/members` | Admin invites a user by email |

## Analytics

The wallet page shows **monthly burn rate**, a **spend-per-member leaderboard**
and a **category breakdown**, backed by `security_invoker` views so each member
only sees aggregates for their own wallets.

## Design system

| Token | Hex | Use |
| --- | --- | --- |
| Primary | `#FF6B00` Electric Orange | actions, focus ring, charts |
| Secondary | `#FF9E00` Warm Amber | secondary actions, leaderboard bars |
| Background | `#FFFFFF` | page |
| Neutral dark | `#18181B` Zinc 900 | text |
| Muted | `#F4F4F5` Zinc 100 | surfaces |

Logo: two overlapping rounded wallet shapes (solid admin, translucent consensus)
with a negative-space checkmark ([public/logo.svg](public/logo.svg)).

## Deploy

Import the repo in Vercel and set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Add the production `/auth/callback` URL to
Supabase's redirect allow-list.
