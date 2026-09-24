# Supabase setup & RLS guide

## 1. Apply the schema

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations/*
```

Or paste `supabase/migrations/20260924000000_init.sql` into the SQL editor.

## 2. Auth

- **Authentication → Providers → Email**: enable magic links.
- **Authentication → URL Configuration**: add `http://localhost:3000/auth/callback` and your
  Vercel URL + `/auth/callback` to the redirect allow-list.

A trigger (`on_auth_user_created`) creates a `profiles` row for every new user.

## 3. Realtime

The migration adds `approval_requests`, `transactions` and `wallets` to the
`supabase_realtime` publication. Realtime respects RLS, so members only receive
changes for wallets they belong to.

## 4. The security model

**Reads go through RLS; writes go through RPCs.**

| Table | SELECT | INSERT / UPDATE / DELETE |
| --- | --- | --- |
| `profiles` | yourself and people who share a wallet with you | update your own row |
| `wallets` | members | RPC only |
| `wallet_members` | members of that wallet | admin can remove non-admins; add via RPC |
| `transactions` | members | RPC only |
| `approval_requests` | members | RPC only |
| `approval_votes` | members of the request's wallet | RPC only |

There are no insert/update policies on ledger tables, so a client holding the
anon key cannot write a transaction or change a balance directly. Every write is
a `security definer` function that checks `auth.uid()` itself:

| RPC | Who | What |
| --- | --- | --- |
| `create_wallet(name, currency, threshold)` | any user | creates wallet, caller becomes admin |
| `add_wallet_member(wallet, email)` | admin | adds an existing user |
| `deposit_to_wallet(wallet, amount)` | admin | tops up the balance |
| `execute_wallet_deduction(wallet, amount, merchant, category)` | admin | locks the wallet row, checks balance, deducts, records a `completed` transaction |
| `request_member_purchase(wallet, amount, merchant, category)` | member | records a `pending` transaction and its approval request together |
| `cast_approval_vote(request, decision)` | member (not the requester) | records the vote; executes or rejects when the outcome is decided |

`is_wallet_member()` / `is_wallet_admin()` are `security definer` helpers. Using
them inside policies avoids the infinite recursion you get when a
`wallet_members` policy queries `wallet_members`.

### Approval rules

- `required_approvals = max(1, min(wallet.approval_threshold, members - 1))`,
  so a two-person wallet never needs more votes than it has voters.
- The requester cannot vote; each member votes once (primary key).
- Approvals reach the threshold → wallet row is locked, balance re-checked,
  deducted, transaction `completed`, request `approved`.
- If that final approval would overdraw the wallet, the call fails with
  `insufficient_funds` and **the vote is rolled back**, so it can be cast
  again after a deposit.
- Rejections make the threshold unreachable → transaction and request `rejected`.

### Analytics views

`wallet_monthly_burn`, `wallet_member_spend` and `wallet_category_spend` are
created `with (security_invoker = true)`, so they run with the caller's RLS and
only aggregate wallets the caller can see.
