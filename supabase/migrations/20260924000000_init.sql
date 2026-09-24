-- ShareWallet: initial schema
-- Tables, RLS, and the atomic RPCs every ledger write goes through.
-- Clients never INSERT/UPDATE ledger tables directly; they call the RPCs below.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

create table wallets (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  admin_id uuid references profiles(id) on delete restrict,
  balance numeric(12, 2) default 0.00 check (balance >= 0),
  currency text default 'USD',
  -- How many member approvals a non-admin purchase needs. Capped at run time
  -- by the number of members who are eligible to vote.
  approval_threshold integer not null default 2 check (approval_threshold >= 1),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table wallet_members (
  wallet_id uuid references wallets(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text check (role in ('admin', 'member')) default 'member',
  joined_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (wallet_id, user_id)
);

create table transactions (
  id uuid default uuid_generate_v4() primary key,
  wallet_id uuid references wallets(id) on delete cascade,
  initiated_by uuid references profiles(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  merchant_name text not null,
  category text not null,
  status text check (status in ('pending', 'approved', 'rejected', 'completed')) default 'completed',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table approval_requests (
  id uuid default uuid_generate_v4() primary key,
  transaction_id uuid references transactions(id) on delete cascade,
  wallet_id uuid references wallets(id) on delete cascade,
  requester_id uuid references profiles(id) on delete cascade,
  required_approvals integer default 1,
  current_approvals integer default 0,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table approval_votes (
  request_id uuid references approval_requests(id) on delete cascade,
  voter_id uuid references profiles(id) on delete cascade,
  decision text check (decision in ('approved', 'rejected')),
  voted_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (request_id, voter_id)
);

create index on wallet_members (user_id);
create index on transactions (wallet_id, created_at desc);
create index on approval_requests (wallet_id, status);

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer so policies on wallet_members don't recurse)
-- ---------------------------------------------------------------------------

create or replace function is_wallet_member(p_wallet_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from wallet_members
    where wallet_id = p_wallet_id and user_id = auth.uid()
  );
$$;

create or replace function is_wallet_admin(p_wallet_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from wallet_members
    where wallet_id = p_wallet_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Create a profile row for every new auth user.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table wallets enable row level security;
alter table wallet_members enable row level security;
alter table transactions enable row level security;
alter table approval_requests enable row level security;
alter table approval_votes enable row level security;

create policy "Users can view themselves and co-members" on profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from wallet_members mine
      join wallet_members theirs on theirs.wallet_id = mine.wallet_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy "Users can update their own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Wallet members can view shared wallet" on wallets
  for select using (is_wallet_member(id));

create policy "Wallet members can view the member list" on wallet_members
  for select using (is_wallet_member(wallet_id));

create policy "Wallet admins can remove members" on wallet_members
  for delete using (is_wallet_admin(wallet_id) and role <> 'admin');

create policy "Wallet members can view transactions" on transactions
  for select using (is_wallet_member(wallet_id));

create policy "Wallet members can view approval requests" on approval_requests
  for select using (is_wallet_member(wallet_id));

create policy "Wallet members can view votes" on approval_votes
  for select using (
    exists (
      select 1 from approval_requests r
      where r.id = approval_votes.request_id and is_wallet_member(r.wallet_id)
    )
  );

-- No insert/update policies on ledger tables: all writes go through the RPCs below.

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function create_wallet(
  p_name text,
  p_currency text default 'USD',
  p_approval_threshold integer default 2
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_wallet_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into wallets (name, admin_id, currency, approval_threshold)
  values (p_name, auth.uid(), p_currency, p_approval_threshold)
  returning id into v_wallet_id;

  insert into wallet_members (wallet_id, user_id, role)
  values (v_wallet_id, auth.uid(), 'admin');

  return v_wallet_id;
end;
$$;

create or replace function add_wallet_member(p_wallet_id uuid, p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
begin
  if not is_wallet_admin(p_wallet_id) then
    raise exception 'only_admin_can_invite';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email);
  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into wallet_members (wallet_id, user_id, role)
  values (p_wallet_id, v_user_id, 'member')
  on conflict do nothing;

  return v_user_id;
end;
$$;

create or replace function deposit_to_wallet(p_wallet_id uuid, p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_balance numeric;
begin
  if not is_wallet_admin(p_wallet_id) then
    raise exception 'only_admin_can_deposit';
  end if;
  if p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  update wallets set balance = balance + p_amount
  where id = p_wallet_id
  returning balance into v_balance;

  return v_balance;
end;
$$;

-- Admin purchase: deducts immediately and records a completed transaction.
-- The acting user is always auth.uid(); it is never taken from the caller.
create or replace function execute_wallet_deduction(
  p_wallet_id uuid,
  p_amount numeric,
  p_merchant text,
  p_category text
) returns transactions language plpgsql security definer set search_path = public as $$
declare
  v_balance numeric;
  v_tx transactions;
begin
  if not is_wallet_admin(p_wallet_id) then
    raise exception 'only_admin_can_spend_directly';
  end if;
  if p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select balance into v_balance from wallets where id = p_wallet_id for update;
  if v_balance < p_amount then
    raise exception 'insufficient_funds';
  end if;

  update wallets set balance = balance - p_amount where id = p_wallet_id;

  insert into transactions (wallet_id, initiated_by, amount, merchant_name, category, status)
  values (p_wallet_id, auth.uid(), p_amount, p_merchant, p_category, 'completed')
  returning * into v_tx;

  return v_tx;
end;
$$;

-- Member purchase: records a pending transaction plus its approval request in
-- one statement, so a failure can never leave a transaction without a request.
create or replace function request_member_purchase(
  p_wallet_id uuid,
  p_amount numeric,
  p_merchant text,
  p_category text
) returns approval_requests language plpgsql security definer set search_path = public as $$
declare
  v_threshold integer;
  v_eligible integer;
  v_tx_id uuid;
  v_request approval_requests;
begin
  if not is_wallet_member(p_wallet_id) then
    raise exception 'not_a_member';
  end if;
  if p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select approval_threshold into v_threshold from wallets where id = p_wallet_id;
  -- Everyone except the requester can vote.
  select count(*) - 1 into v_eligible from wallet_members where wallet_id = p_wallet_id;

  insert into transactions (wallet_id, initiated_by, amount, merchant_name, category, status)
  values (p_wallet_id, auth.uid(), p_amount, p_merchant, p_category, 'pending')
  returning id into v_tx_id;

  insert into approval_requests (transaction_id, wallet_id, requester_id, required_approvals)
  values (v_tx_id, p_wallet_id, auth.uid(), greatest(1, least(v_threshold, v_eligible)))
  returning * into v_request;

  return v_request;
end;
$$;

-- Cast a vote. When approvals reach the threshold the purchase executes in the
-- same transaction; when it can no longer reach the threshold it is rejected.
create or replace function cast_approval_vote(p_request_id uuid, p_decision text)
returns approval_requests language plpgsql security definer set search_path = public as $$
declare
  v_request approval_requests;
  v_tx transactions;
  v_eligible integer;
  v_rejections integer;
  v_balance numeric;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_decision';
  end if;

  select * into v_request from approval_requests where id = p_request_id for update;
  if v_request.id is null or not is_wallet_member(v_request.wallet_id) then
    raise exception 'request_not_found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'request_already_resolved';
  end if;
  if v_request.requester_id = auth.uid() then
    raise exception 'cannot_vote_on_own_request';
  end if;

  insert into approval_votes (request_id, voter_id, decision)
  values (p_request_id, auth.uid(), p_decision);
  -- Primary key rejects a second vote from the same member.

  if p_decision = 'approved' then
    update approval_requests set current_approvals = current_approvals + 1
    where id = p_request_id
    returning * into v_request;
  end if;

  select count(*) - 1 into v_eligible from wallet_members where wallet_id = v_request.wallet_id;
  select count(*) into v_rejections from approval_votes
  where request_id = p_request_id and decision = 'rejected';

  if v_request.current_approvals >= v_request.required_approvals then
    select * into v_tx from transactions where id = v_request.transaction_id for update;
    select balance into v_balance from wallets where id = v_request.wallet_id for update;
    if v_balance < v_tx.amount then
      -- Roll back the vote too, so it can be cast again after a top-up.
      raise exception 'insufficient_funds';
    end if;

    update wallets set balance = balance - v_tx.amount where id = v_request.wallet_id;
    update transactions set status = 'completed' where id = v_tx.id;
    update approval_requests set status = 'approved' where id = p_request_id
    returning * into v_request;
  elsif v_eligible - v_rejections < v_request.required_approvals then
    update transactions set status = 'rejected' where id = v_request.transaction_id;
    update approval_requests set status = 'rejected' where id = p_request_id
    returning * into v_request;
  end if;

  return v_request;
end;
$$;

revoke all on function create_wallet, add_wallet_member, deposit_to_wallet,
  execute_wallet_deduction, request_member_purchase, cast_approval_vote from public, anon;
grant execute on function create_wallet, add_wallet_member, deposit_to_wallet,
  execute_wallet_deduction, request_member_purchase, cast_approval_vote to authenticated;

-- ---------------------------------------------------------------------------
-- Analytics views (security_invoker, so the caller's RLS applies)
-- ---------------------------------------------------------------------------

create view wallet_monthly_burn with (security_invoker = true) as
  select wallet_id,
         date_trunc('month', created_at)::date as month,
         sum(amount)::numeric(12, 2) as total_spent,
         count(*) as transaction_count
  from transactions
  where status = 'completed'
  group by wallet_id, date_trunc('month', created_at);

create view wallet_member_spend with (security_invoker = true) as
  select t.wallet_id,
         t.initiated_by as user_id,
         p.full_name,
         sum(t.amount)::numeric(12, 2) as total_spent,
         count(*) as transaction_count
  from transactions t
  left join profiles p on p.id = t.initiated_by
  where t.status = 'completed'
  group by t.wallet_id, t.initiated_by, p.full_name;

create view wallet_category_spend with (security_invoker = true) as
  select wallet_id,
         category,
         sum(amount)::numeric(12, 2) as total_spent
  from transactions
  where status = 'completed'
  group by wallet_id, category;

-- ---------------------------------------------------------------------------
-- Realtime: members get live approval and ledger updates
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table approval_requests, transactions, wallets;
