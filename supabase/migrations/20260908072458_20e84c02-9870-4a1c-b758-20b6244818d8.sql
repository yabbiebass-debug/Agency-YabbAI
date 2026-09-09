-- ============ LEADS ============
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  biz text not null,
  niche text,
  suburb text,
  pain text,
  email text,
  phone text,
  fit text check (fit in ('Hot','Warm','Cold')),
  score int check (score between 0 and 100),
  stage text not null default 'New' check (stage in ('New','Outreach drafted','Contacted','Replied','Awaiting close','Won','Dead')),
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now()
);

-- ============ CLIENTS ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  lead_id uuid references public.leads(id) on delete set null,
  biz text not null,
  package text check (package in ('Starter','Growth','Full Ops')),
  setup_fee numeric not null default 0,
  setup_paid boolean not null default false,
  tier text check (tier in ('Maintain','Optimize','Scale')),
  mrr numeric not null default 0,
  status text not null default 'Onboarding' check (status in ('Onboarding','QA','Ship pending','Active','Paused','Churned')),
  build_pct int not null default 0 check (build_pct between 0 and 100),
  health text not null default 'ok' check (health in ('ok','risk')),
  stripe_customer_id text,
  created_via text not null check (created_via in ('director','stripe_checkout','solana_payment')),
  created_at timestamptz not null default now()
);

-- ============ APPROVALS ============
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  type text not null check (type in ('outreach','contract','ship','fork','save','spend')),
  title text not null,
  detail text,
  payload jsonb not null default '{}'::jsonb,
  agent text not null default 'SYSTEM',
  license text,
  license_class text check (license_class in ('permissive','copyleft','blocked')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ ACTIONS (execution ledger) ============
create table public.actions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  approval_id uuid not null references public.approvals(id) on delete cascade,
  kind text not null,
  result jsonb not null default '{}'::jsonb,
  executed_at timestamptz not null default now()
);

-- ============ CYCLES / EVENTS ============
create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  n int not null,
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  cycle_n int not null default 0,
  agent text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ============ FORGE EVALUATIONS ============
create table public.forge_evaluations (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  name text not null,
  license text not null,
  license_class text not null check (license_class in ('permissive','copyleft','blocked')),
  note text,
  approval_id uuid references public.approvals(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============ PAYMENTS ============
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  method text not null check (method in ('stripe','solana')),
  purpose text not null default 'setup' check (purpose in ('setup','retainer')),
  biz text,
  package text,
  tier text,
  amount_aud numeric not null default 0,
  mrr numeric not null default 0,
  sol_amount numeric,
  recipient text,
  reference text,
  status text not null default 'pending' check (status in ('pending','confirmed','failed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create unique index payments_reference_uniq on public.payments (method, reference) where reference is not null;

-- ============ PLANS (seat stub, multi-tenant later) ============
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid(),
  name text not null default 'director',
  seats int not null default 1,
  created_at timestamptz not null default now()
);

-- ============ GRANTS ============
grant select, insert, update, delete on public.leads to authenticated;
grant select, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.approvals to authenticated;
grant select on public.actions to authenticated;
grant select, insert, update on public.cycles to authenticated;
grant select, insert on public.events to authenticated;
grant select, insert on public.forge_evaluations to authenticated;
grant select, insert, update on public.payments to authenticated;
grant select, insert, update on public.plans to authenticated;
grant all on public.leads, public.clients, public.approvals, public.actions,
  public.cycles, public.events, public.forge_evaluations, public.payments, public.plans to service_role;

-- ============ RLS ============
alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.approvals enable row level security;
alter table public.actions enable row level security;
alter table public.cycles enable row level security;
alter table public.events enable row level security;
alter table public.forge_evaluations enable row level security;
alter table public.payments enable row level security;
alter table public.plans enable row level security;

create policy "leads_owner_all" on public.leads for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "clients_owner_all" on public.clients for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "approvals_owner_all" on public.approvals for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "actions_owner_all" on public.actions for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "cycles_owner_all" on public.cycles for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "events_owner_all" on public.events for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "forge_owner_all" on public.forge_evaluations for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "payments_owner_all" on public.payments for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "plans_owner_all" on public.plans for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- ============ GATE 1: blocked licences can never be approved ============
create or replace function public.trg_block_blocked() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'approved' and new.license_class = 'blocked' then
    raise exception 'License policy: proprietary or unknown-license items cannot be approved.';
  end if;
  return new;
end $$;

create trigger block_blocked before insert or update on public.approvals
for each row execute function public.trg_block_blocked();

-- ============ GATE 2: no execution without an approved approval ============
create or replace function public.trg_require_approved() returns trigger
language plpgsql set search_path = public as $$
declare st text;
begin
  select status into st from public.approvals where id = new.approval_id and owner = new.owner;
  if st is distinct from 'approved' then
    raise exception 'Execution blocked: approval % is not approved.', new.approval_id;
  end if;
  return new;
end $$;

create trigger require_approved before insert on public.actions
for each row execute function public.trg_require_approved();

-- ============ GATE 3: clients only from close_deal or a verified payment ============
-- authenticated has no INSERT grant on clients; only the security-definer
-- functions below can create one.

create or replace function public.approve_approval(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.approvals;
begin
  select * into a from public.approvals
   where id = p_id and owner = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'Approval not found or already decided.'; end if;
  if a.license_class = 'blocked' then
    raise exception 'License policy: blocked items cannot be approved.';
  end if;

  update public.approvals set status = 'approved', decided_at = now() where id = p_id;

  if a.type = 'outreach' then
    update public.leads set stage = 'Contacted'
     where id = (a.payload->>'lead_id')::uuid and owner = auth.uid();
  elsif a.type = 'contract' then
    update public.leads set stage = 'Awaiting close'
     where id = (a.payload->>'lead_id')::uuid and owner = auth.uid();
  elsif a.type = 'ship' then
    update public.clients set status = 'Active'
     where id = (a.payload->>'client_id')::uuid and owner = auth.uid();
  elsif a.type = 'save' then
    update public.clients set health = 'ok'
     where id = (a.payload->>'client_id')::uuid and owner = auth.uid();
  end if;

  insert into public.actions(owner, approval_id, kind) values (auth.uid(), p_id, a.type);
  insert into public.events(owner, agent, message)
  values (auth.uid(), 'DIRECTOR', 'approved: ' || a.title);
end $$;

create or replace function public.reject_approval(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.approvals;
begin
  select * into a from public.approvals where id = p_id and owner = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'Approval not found or already decided.'; end if;
  update public.approvals set status = 'rejected', decided_at = now() where id = p_id;
  insert into public.events(owner, agent, message)
  values (auth.uid(), 'DIRECTOR', 'rejected: ' || a.title);
end $$;

-- The human close: the only user-side path that creates a client.
create or replace function public.close_deal(
  p_lead_id uuid, p_package text, p_tier text, p_fee numeric, p_mrr numeric
) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid; l public.leads;
begin
  select * into l from public.leads
   where id = p_lead_id and owner = auth.uid() and stage in ('Awaiting close','Replied') for update;
  if not found then raise exception 'Lead not found or not ready to close.'; end if;

  update public.leads set stage = 'Won' where id = p_lead_id;

  insert into public.clients(owner, lead_id, biz, package, setup_fee, setup_paid, tier, mrr, created_via)
  values (auth.uid(), l.id, l.biz, p_package, p_fee, true, p_tier, p_mrr, 'director')
  returning id into cid;

  insert into public.events(owner, agent, message)
  values (auth.uid(), 'DIRECTOR',
    'closed ' || l.biz || ' — ' || p_package || ' $' || p_fee || ' setup + ' || p_tier || ' $' || p_mrr || '/mo');
  return cid;
end $$;

create or replace function public.mark_replied(p_lead_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l public.leads;
begin
  select * into l from public.leads where id = p_lead_id and owner = auth.uid();
  if not found then raise exception 'Lead not found.'; end if;
  update public.leads set stage = 'Replied' where id = p_lead_id;
  insert into public.approvals(owner, type, title, detail, agent, payload)
  values (auth.uid(), 'contract', 'Proposal → ' || l.biz,
    'Lead replied positive. Approve to send the proposal; you take the close call.',
    'PITCHER', jsonb_build_object('lead_id', l.id));
  insert into public.events(owner, agent, message)
  values (auth.uid(), 'DIRECTOR', 'marked replied: ' || l.biz);
end $$;

-- Client creation from a verified payment (called only by the server after
-- a Stripe signature check or an on-chain Solana confirmation).
create or replace function public.create_client_from_payment(p_payment_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.payments; cid uuid;
begin
  select * into p from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found.'; end if;
  if p.status <> 'confirmed' then raise exception 'Payment is not confirmed.'; end if;
  if p.client_id is not null then return p.client_id; end if;

  insert into public.clients(owner, lead_id, biz, package, setup_fee, setup_paid, tier, mrr, created_via)
  values (p.owner, p.lead_id, coalesce(p.biz, 'New client'), p.package, p.amount_aud, true,
          p.tier, p.mrr, case when p.method = 'stripe' then 'stripe_checkout' else 'solana_payment' end)
  returning id into cid;

  update public.payments set client_id = cid where id = p.id;
  if p.lead_id is not null then
    update public.leads set stage = 'Won' where id = p.lead_id;
  end if;

  insert into public.events(owner, agent, message)
  values (p.owner, case when p.method = 'stripe' then 'STRIPE' else 'SOLANA' end,
    'payment confirmed — client created: ' || coalesce(p.biz, 'New client') || ' ($' || p.amount_aud || ')');
  return cid;
end $$;

revoke all on function public.create_client_from_payment(uuid) from public, anon, authenticated;
grant execute on function public.create_client_from_payment(uuid) to service_role;
grant execute on function public.approve_approval(uuid) to authenticated;
grant execute on function public.reject_approval(uuid) to authenticated;
grant execute on function public.close_deal(uuid, text, text, numeric, numeric) to authenticated;
grant execute on function public.mark_replied(uuid) to authenticated;

-- ============ REALTIME ============
alter publication supabase_realtime add table public.approvals;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.leads;

-- ============ MONEY VIEW ============
create or replace view public.money_view with (security_invoker = true) as
select
  coalesce(sum(mrr) filter (where status = 'Active'), 0) as mrr,
  coalesce(sum(setup_fee) filter (where setup_paid), 0) as cash_collected,
  count(*) filter (where status = 'Active') as active_clients
from public.clients where owner = auth.uid();

grant select on public.money_view to authenticated;