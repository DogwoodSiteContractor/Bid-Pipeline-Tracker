-- =====================================================================
-- Bid Pipeline — Supabase schema
-- Run this whole file once in Supabase: SQL Editor → New query → Run.
-- It is safe to re-run: it drops and recreates policies and functions.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- One row per login. role controls what the person can do:
--   admin     = precon manager: full control of everything
--   estimator = sees only bids assigned to them (lead or supporting); can
--               edit those bids (except estimator assignments), sign off
--               scopes, manage vendor quotes, and upload/download files
--   board     = read-only board dashboard and pipeline
--   pm        = project manager: the Jobs side only (budgets, job costs)
--   pending   = signed up but not yet given access by an admin
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'pending'
              check (role in ('admin','estimator','board','pm','pending')),
  created_at  timestamptz not null default now()
);

create table if not exists public.estimators (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  title       text not null default '',
  email       text not null default '',
  phone       text not null default '',
  active      boolean not null default true,
  user_id     uuid unique references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  company     text not null,
  type        text not null default 'General contractor',
  phone       text not null default '',
  email       text not null default '',
  address     text not null default '',
  notes       text not null default '',
  contacts    jsonb not null default '[]'::jsonb,   -- [{name,title,phone,email}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.vendors (
  id           uuid primary key default gen_random_uuid(),
  company      text not null,
  vendor_type  text not null default '',
  trade        text not null default 'Other',
  scopes       jsonb not null default '[]'::jsonb,   -- scope names this vendor quotes
  contact_name text not null default '',
  phone        text not null default '',
  email        text not null default '',
  area         text not null default '',
  preferred    boolean not null default false,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.bids (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  location              text not null default '',
  project_type          text not null default 'Commercial',
  units                 integer check (units is null or units >= 0),
  bid_type              text not null default 'Hard bid',
  size                  text not null default '',
  status                text not null default 'Not Started'
                        check (status in ('Not Started','Estimating','Takeoff Complete','Submitted','On Hold','Awarded','Not Awarded','No Bid')),
  probability           int  not null default 50 check (probability between 0 and 100),
  due_date              date,
  due_time              time,
  walk_date             date,
  rfi_date              date,
  lead_estimator_id     uuid references public.estimators(id) on delete set null,
  support_estimator_ids uuid[] not null default '{}',
  client_ids            uuid[] not null default '{}',
  client_contacts       jsonb not null default '{}'::jsonb,  -- {client_id: contact name}
  client_proposals      jsonb not null default '{}'::jsonb,  -- {client_id: {amount_with, amount_without, sent_date, status}}
  awarded_client_id     uuid references public.clients(id) on delete set null,
  archived_at           timestamptz,                          -- set when archived
  addenda               jsonb not null default '[]'::jsonb,  -- addendum log
  revisions             jsonb not null default '[]'::jsonb,  -- proposal revision log
  scopes                jsonb not null default '{}'::jsonb,   -- legacy, replaced by scope_items
  scope_items           jsonb not null default '[]'::jsonb,   -- [{id,name,group,status,assignee_id,signed_initials,signed_by_name,signed_by_user,signed_at}]
  proposal_status       text not null default 'Not Started',
  amount_with           numeric(14,2),
  amount_without        numeric(14,2),
  use_for               text not null default 'with' check (use_for in ('with','without')),
  margin                numeric(6,2),
  follow_ups            jsonb not null default '[]'::jsonb,  -- [{date,note}]
  notes                 text not null default '',
  submitted_date        date,
  awarded_date          date,
  awarded_amount        numeric(14,2),
  awarded_to            text not null default '',
  lost_reason           text not null default '',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users(id) on delete set null
);
alter table public.bids add column if not exists scope_items jsonb not null default '[]'::jsonb;
alter table public.vendors add column if not exists vendor_type text not null default '';
alter table public.vendors add column if not exists scopes jsonb not null default '[]'::jsonb;
alter table public.bids add column if not exists archived_at timestamptz;
alter table public.bids add column if not exists units integer check (units is null or units >= 0);
alter table public.bids add column if not exists addenda jsonb not null default '[]'::jsonb;
alter table public.bids add column if not exists revisions jsonb not null default '[]'::jsonb;
alter table public.bids add column if not exists client_proposals jsonb not null default '{}'::jsonb;
alter table public.bids add column if not exists awarded_client_id uuid references public.clients(id) on delete set null;
create index if not exists bids_lead_idx on public.bids(lead_estimator_id);
create index if not exists bids_support_idx on public.bids using gin(support_estimator_ids);

create table if not exists public.quotes (
  id             uuid primary key default gen_random_uuid(),
  bid_id         uuid not null references public.bids(id) on delete cascade,
  vendor_id      uuid references public.vendors(id) on delete set null,
  scope          text not null default 'Other',
  status         text not null default 'Requested'
                 check (status in ('Not requested','Requested','Received','Declined','No response')),
  requested_date date,
  due_date       date,
  received_date  date,
  amount         numeric(14,2),
  note           text not null default '',
  file_path      text,
  file_name      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null
);
create index if not exists quotes_bid_idx on public.quotes(bid_id);
create index if not exists quotes_vendor_idx on public.quotes(vendor_id);

-- Plans, specs, addenda, takeoffs, proposals… attached to a bid
create table if not exists public.bid_files (
  id               uuid primary key default gen_random_uuid(),
  bid_id           uuid not null references public.bids(id) on delete cascade,
  file_path        text not null,
  file_name        text not null,
  category         text not null default 'Other',
  size_bytes       bigint,
  uploaded_by      uuid references auth.users(id) on delete set null default auth.uid(),
  uploaded_by_name text not null default '',
  created_at       timestamptz not null default now()
);
create index if not exists bid_files_bid_idx on public.bid_files(bid_id);

-- Company-wide settings: {key:'general', value:{companyName}}, {key:'board', value:{widgets:{...}}}
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['estimators','clients','vendors','bids','quotes','settings'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Role helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'pending')
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_role() = 'admin'
$$;

create or replace function public.my_estimator_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.estimators where user_id = auth.uid() limit 1
$$;

-- Assigned = lead estimator or one of the supporting estimators
create or replace function public.is_assigned(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bids x
    where x.id = b
      and public.my_estimator_id() is not null
      and (x.lead_estimator_id = public.my_estimator_id()
           or public.my_estimator_id() = any(x.support_estimator_ids))
  )
$$;

-- Can read this bid (and its quotes and files)?
create or replace function public.can_see_bid(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.app_role()
    when 'admin' then true
    when 'board' then true
    when 'estimator' then public.is_assigned(b)
    else false end
$$;

-- Can add/update quotes and upload files on this bid?
create or replace function public.can_work_bid(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.app_role() = 'estimator' and public.is_assigned(b))
$$;

-- ---------------------------------------------------------------------
-- New users: create a profile. The very first user becomes admin.
-- If an estimator record already has the same email, the new login is
-- linked to it and given the estimator role automatically.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  first_user boolean := not exists (select 1 from public.profiles where role = 'admin');
  est_id uuid;
begin
  select id into est_id from public.estimators
   where user_id is null and email <> '' and lower(email) = lower(new.email) limit 1;

  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          case when first_user then 'admin'
               when est_id is not null then 'estimator'
               else 'pending' end)
  on conflict (id) do nothing;

  if est_id is not null then
    update public.estimators set user_id = new.id where id = est_id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users created before this script ran
insert into public.profiles (id, email, role)
select u.id, u.email, 'pending' from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.estimators enable row level security;
alter table public.clients    enable row level security;
alter table public.vendors    enable row level security;
alter table public.bids       enable row level security;
alter table public.quotes     enable row level security;
alter table public.bid_files  enable row level security;
alter table public.settings   enable row level security;

-- drop old policies so this file can be re-run
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public'
             and tablename in ('profiles','estimators','clients','vendors','bids','quotes','bid_files','settings')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles: you see yourself; admins see and manage everyone
create policy "profiles read"   on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles admin"  on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "profiles delete" on public.profiles for delete to authenticated using (public.is_admin() and id <> auth.uid());

-- directories: everyone with access can read, only admins change
create policy "estimators read"  on public.estimators for select to authenticated using (public.app_role() <> 'pending');
create policy "estimators write" on public.estimators for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "clients read"     on public.clients    for select to authenticated using (public.app_role() <> 'pending');
create policy "clients write"    on public.clients    for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "vendors read"     on public.vendors    for select to authenticated using (public.app_role() <> 'pending');
create policy "vendors write"    on public.vendors    for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "settings read"    on public.settings   for select to authenticated using (public.app_role() <> 'pending');
create policy "settings write"   on public.settings   for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- bids: estimators see only their assigned bids; only admins change bids
create policy "bids read"   on public.bids for select to authenticated using (public.can_see_bid(id));
create policy "bids insert" on public.bids for insert to authenticated with check (public.is_admin());
-- assigned estimators can edit their bids; the guard trigger below stops
-- them changing who is assigned
create policy "bids update" on public.bids for update to authenticated using (public.can_work_bid(id)) with check (public.can_work_bid(id));
create policy "bids delete" on public.bids for delete to authenticated using (public.is_admin());

-- quotes: assigned estimators can request/update quotes; only admins delete
create policy "quotes read"   on public.quotes for select to authenticated using (public.can_see_bid(bid_id));
create policy "quotes insert" on public.quotes for insert to authenticated with check (public.can_work_bid(bid_id));
create policy "quotes update" on public.quotes for update to authenticated using (public.can_work_bid(bid_id)) with check (public.can_work_bid(bid_id));
create policy "quotes delete" on public.quotes for delete to authenticated using (public.is_admin());

-- bid files: assigned estimators upload; admins or the uploader can remove
create policy "files read"   on public.bid_files for select to authenticated using (public.can_see_bid(bid_id));
create policy "files insert" on public.bid_files for insert to authenticated with check (public.can_work_bid(bid_id) and uploaded_by = auth.uid());
create policy "files delete" on public.bid_files for delete to authenticated using (public.is_admin() or uploaded_by = auth.uid());


-- ---------------------------------------------------------------------
-- Bid edit guard
--  * only admins can change the lead / supporting estimators
--  * a scope sign-off can only be recorded under the signed-in person's own login
-- ---------------------------------------------------------------------
create or replace function public.guard_bid_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  if not public.is_admin() then
    if new.lead_estimator_id is distinct from old.lead_estimator_id
       or new.support_estimator_ids is distinct from old.support_estimator_ids then
      raise exception 'Only the precon manager can change estimator assignments';
    end if;
  end if;
  for e in select value from jsonb_array_elements(coalesce(new.scope_items, '[]'::jsonb)) loop
    if coalesce(e->>'signed_by_user', '') <> '' and not exists (
         select 1 from jsonb_array_elements(coalesce(old.scope_items, '[]'::jsonb)) o
         where o.value->>'id' = e->>'id'
           and o.value->>'signed_by_user' = e->>'signed_by_user'
           and o.value->>'signed_at' is not distinct from e->>'signed_at') then
      if e->>'signed_by_user' <> auth.uid()::text then
        raise exception 'A scope can only be signed off by the person who is signed in';
      end if;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists guard_bid_update on public.bids;
create trigger guard_bid_update before update on public.bids
  for each row execute function public.guard_bid_update();

-- ---------------------------------------------------------------------
-- File storage: private bucket, files stored under <bid_id>/...
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('bid-files', 'bid-files', false)
on conflict (id) do nothing;

create or replace function public.bid_from_path(p text) returns uuid
language plpgsql immutable as $$
begin
  return (split_part(p, '/', 1))::uuid;
exception when others then
  return null;
end $$;

drop policy if exists "bid files read"   on storage.objects;
drop policy if exists "bid files upload" on storage.objects;
drop policy if exists "bid files delete" on storage.objects;

create policy "bid files read" on storage.objects for select to authenticated
  using (bucket_id = 'bid-files' and public.can_see_bid(public.bid_from_path(name)));
create policy "bid files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'bid-files' and public.can_work_bid(public.bid_from_path(name)));
create policy "bid files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'bid-files' and (public.is_admin() or owner = auth.uid()));

-- ---------------------------------------------------------------------
-- Live updates: everyone's screen refreshes when data changes
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['bids','quotes','bid_files','estimators','clients','vendors','settings'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;


-- =====================================================================
-- Update 9: Project manager side — jobs, budgets and job costs
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run more than once. Run it BEFORE uploading the new app.js.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New role: pm (Project Manager). PMs see only the Jobs side.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ~ '\mrole\M'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','estimator','board','pm','pending'));

create or replace function public.can_job() returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_role() in ('admin','pm')
$$;

-- People who can be assigned as a job's PM (names only; readable by admins and PMs)
create or replace function public.pm_directory()
returns table (id uuid, full_name text, email text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, p.role from public.profiles p
  where public.can_job() and p.role in ('pm','admin')
  order by coalesce(nullif(p.full_name,''), p.email)
$$;
grant execute on function public.pm_directory() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------
create table if not exists public.jobs (
  id               uuid primary key default gen_random_uuid(),
  job_number       text not null default '',
  name             text not null,
  bid_id           uuid unique references public.bids(id) on delete set null,
  client_id        uuid references public.clients(id) on delete set null,
  location         text not null default '',
  pm_user_id       uuid references auth.users(id) on delete set null,
  status           text not null default 'Active'
                   check (status in ('Not Started','Active','On Hold','Complete')),
  structure        text not null default 'bid_items'
                   check (structure in ('bid_items','cost_codes')),
  contract_amount  numeric(14,2),          -- blank = sum of the budget line prices
  start_date       date,
  end_date         date,
  notes            text not null default '',
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null
);

-- one row per bid item or cost code
create table if not exists public.job_items (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.jobs(id) on delete cascade,
  code           text not null default '',   -- bid item no. or cost code
  description    text not null default '',
  unit           text not null default '',   -- CY, LF, EA, LS …
  quantity       numeric(14,3),              -- budget quantity
  labor          numeric(14,2) not null default 0,
  equipment      numeric(14,2) not null default 0,
  materials      numeric(14,2) not null default 0,
  subcontract    numeric(14,2) not null default 0,
  other          numeric(14,2) not null default 0,
  overhead_pct   numeric(7,3) not null default 0,
  markup_pct     numeric(7,3) not null default 0,
  pct_override   numeric(6,2),               -- % complete for lump-sum items with no quantity
  sort           int not null default 0,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists job_items_job_idx on public.job_items(job_id);

-- actual cost and production entries
create table if not exists public.job_costs (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs(id) on delete cascade,
  item_id      uuid references public.job_items(id) on delete cascade,
  date         date not null default current_date,
  type         text not null default 'Labor'
               check (type in ('Labor','Equipment','Material','Subcontract','Other','Production')),
  description  text not null default '',
  hours        numeric(10,2),
  rate         numeric(12,2),
  amount       numeric(14,2) not null default 0,
  qty          numeric(14,3),                -- quantity installed
  reference    text not null default '',     -- vendor, invoice, timesheet …
  source       text not null default 'manual' check (source in ('manual','import')),
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  created_by_name text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists job_costs_job_idx on public.job_costs(job_id);
create index if not exists job_costs_item_idx on public.job_costs(item_id);

do $$
declare t text;
begin
  foreach t in array array['jobs','job_items'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Row-level security: admins and PMs work jobs; nobody else sees them
-- ---------------------------------------------------------------------
alter table public.jobs      enable row level security;
alter table public.job_items enable row level security;
alter table public.job_costs enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('jobs','job_items','job_costs')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "jobs read"   on public.jobs for select to authenticated using (public.can_job());
create policy "jobs insert" on public.jobs for insert to authenticated with check (public.can_job());
create policy "jobs update" on public.jobs for update to authenticated using (public.can_job()) with check (public.can_job());
create policy "jobs delete" on public.jobs for delete to authenticated using (public.is_admin());

create policy "job items read"  on public.job_items for select to authenticated using (public.can_job());
create policy "job items write" on public.job_items for all    to authenticated using (public.can_job()) with check (public.can_job());

create policy "job costs read"   on public.job_costs for select to authenticated using (public.can_job());
create policy "job costs insert" on public.job_costs for insert to authenticated with check (public.can_job());
create policy "job costs update" on public.job_costs for update to authenticated
  using (public.is_admin() or created_by = auth.uid()) with check (public.can_job());
create policy "job costs delete" on public.job_costs for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- ---------------------------------------------------------------------
-- 4. Live updates
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['jobs','job_items','job_costs'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;


-- =====================================================================
-- Update 10: default overhead % and markup % on each job
-- Used to take overhead and markup back out of bid prices when budget
-- lines are imported or added. Run once in Supabase SQL Editor; safe to re-run.
-- =====================================================================
alter table public.jobs add column if not exists overhead_pct numeric(7,3) not null default 0;
alter table public.jobs add column if not exists markup_pct   numeric(7,3) not null default 0;


-- =====================================================================
-- Update 11: Estimator log — dated notes on a bid, for the whole project
-- or one scope of work, with optional photos and files.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run more than once. Run it BEFORE uploading the new app.js.
-- =====================================================================

create table if not exists public.bid_log (
  id               uuid primary key default gen_random_uuid(),
  bid_id           uuid not null references public.bids(id) on delete cascade,
  scope            text not null default '',          -- '' = whole project
  category         text not null default 'General',
  entry_date       date not null default current_date,
  body             text not null default '',
  pinned           boolean not null default false,
  attachments      jsonb not null default '[]'::jsonb, -- [{path,name,size,type}]
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_by_name  text not null default '',
  edited_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists bid_log_bid_idx on public.bid_log(bid_id);

drop trigger if exists touch_bid_log on public.bid_log;
create trigger touch_bid_log before update on public.bid_log
  for each row execute function public.touch_updated_at();

-- Who can read a bid's log: anyone who can see the bid, plus admins and PMs
-- once the bid has become a job (so the estimator's notes carry over to the field).
create or replace function public.can_read_bid_log(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_see_bid(b)
      or (public.app_role() in ('admin','pm') and exists (select 1 from public.jobs j where j.bid_id = b))
$$;

alter table public.bid_log enable row level security;
drop policy if exists "bid log read"   on public.bid_log;
drop policy if exists "bid log insert" on public.bid_log;
drop policy if exists "bid log update" on public.bid_log;
drop policy if exists "bid log delete" on public.bid_log;

create policy "bid log read"   on public.bid_log for select to authenticated
  using (public.can_read_bid_log(bid_id));
-- estimators on the bid (and admins) add notes, as themselves
create policy "bid log insert" on public.bid_log for insert to authenticated
  with check (public.can_work_bid(bid_id) and created_by = auth.uid());
-- you can edit or delete your own notes; admins can edit or delete any
create policy "bid log update" on public.bid_log for update to authenticated
  using (public.is_admin() or (created_by = auth.uid() and public.can_work_bid(bid_id)))
  with check (public.is_admin() or (created_by = auth.uid() and public.can_work_bid(bid_id)));
create policy "bid log delete" on public.bid_log for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- Photos and files attached to log notes live in bid-files/<bid id>/log/…
-- PMs on a job can open those (but not the rest of the bid's files).
drop policy if exists "bid files read" on storage.objects;
create policy "bid files read" on storage.objects for select to authenticated
  using (bucket_id = 'bid-files' and (
    public.can_see_bid(public.bid_from_path(name))
    or (split_part(name, '/', 2) = 'log' and public.can_read_bid_log(public.bid_from_path(name)))));

do $$
begin
  alter publication supabase_realtime add table public.bid_log;
exception when duplicate_object then null;
end $$;


-- =====================================================================
-- Update 12: Supersede a project — keep a dated history when the same
-- project comes back under a new name or with new details.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run more than once.
-- =====================================================================
alter table public.bids add column if not exists supersede_history jsonb not null default '[]'::jsonb;
alter table public.bids add column if not exists superseded_at timestamptz;


-- =====================================================================
-- Update 13: Estimating codebooks — materials, labor, equipment and crews.
-- The price book estimates are built from. Admins edit; estimators read.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run more than once. Run it BEFORE uploading the new app.js.
-- =====================================================================

create table if not exists public.codebook (
  id             uuid primary key default gen_random_uuid(),
  book           text not null check (book in ('material','labor','equipment','crew')),
  code           text not null default '',
  description    text not null default '',
  category       text not null default '',
  unit           text not null default '',
  cost           numeric(14,4),                      -- $ per unit (materials) or loaded $/hr (labor, equipment)
  data           jsonb not null default '{}'::jsonb, -- book-specific: wage/fringe/burden, rate/operating, crew members, waste…
  vendor_id      uuid references public.vendors(id) on delete set null,
  price_date     date,
  price_history  jsonb not null default '[]'::jsonb, -- [{d, by, f, o, n, src, note}] newest last
  active         boolean not null default true,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null default auth.uid()
);
create index if not exists codebook_book_idx on public.codebook(book);
create index if not exists codebook_vendor_idx on public.codebook(vendor_id);
-- codes are unique within a book (blank codes allowed)
create unique index if not exists codebook_code_uniq on public.codebook(book, lower(code)) where code <> '';

drop trigger if exists touch_codebook on public.codebook;
create trigger touch_codebook before update on public.codebook
  for each row execute function public.touch_updated_at();

alter table public.codebook enable row level security;
drop policy if exists "codebook read"   on public.codebook;
drop policy if exists "codebook insert" on public.codebook;
drop policy if exists "codebook update" on public.codebook;
drop policy if exists "codebook delete" on public.codebook;

create policy "codebook read"   on public.codebook for select to authenticated
  using (public.app_role() in ('admin','estimator'));
create policy "codebook insert" on public.codebook for insert to authenticated
  with check (public.is_admin());
create policy "codebook update" on public.codebook for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "codebook delete" on public.codebook for delete to authenticated
  using (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.codebook;
exception when duplicate_object then null;
end $$;


-- =====================================================================
-- Update 14: Estimates — one estimate per bid (bid items → activities →
-- crews, labor, equipment, materials, subs, trucking), plus activity and
-- bid item templates in the codebook.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run more than once. Run update-13 first, and run this BEFORE
-- uploading the new app.js.
-- =====================================================================

-- codebook can now hold activity and bid item templates
alter table public.codebook drop constraint if exists codebook_book_check;
alter table public.codebook add constraint codebook_book_check
  check (book in ('material','labor','equipment','crew','activity','biditem'));

create table if not exists public.estimates (
  id               uuid primary key default gen_random_uuid(),
  bid_id           uuid not null unique references public.bids(id) on delete cascade,
  data             jsonb not null default '{}'::jsonb,  -- {settings, markup, items:[{…, acts:[{…, crew, res:[…]}]}]}
  version          integer not null default 1,          -- bumped on every save; used to catch two people saving at once
  total_cost       numeric(14,2),
  total_price      numeric(14,2),
  updated_by_name  text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null default auth.uid()
);

drop trigger if exists touch_estimates on public.estimates;
create trigger touch_estimates before update on public.estimates
  for each row execute function public.touch_updated_at();

alter table public.estimates enable row level security;
drop policy if exists "estimates read"   on public.estimates;
drop policy if exists "estimates insert" on public.estimates;
drop policy if exists "estimates update" on public.estimates;
drop policy if exists "estimates delete" on public.estimates;

-- anyone who can see the bid can see its estimate; people working the bid edit it
create policy "estimates read"   on public.estimates for select to authenticated
  using (public.can_see_bid(bid_id));
create policy "estimates insert" on public.estimates for insert to authenticated
  with check (public.can_work_bid(bid_id));
create policy "estimates update" on public.estimates for update to authenticated
  using (public.can_work_bid(bid_id)) with check (public.can_work_bid(bid_id));
create policy "estimates delete" on public.estimates for delete to authenticated
  using (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.estimates;
exception when duplicate_object then null;
end $$;


-- =====================================================================
-- Update 15: Quote line items — each vendor quote can hold unit prices
-- for the estimate's materials, subs and trucking, plus freight / other
-- charges and a lump-sum option, so quotes can be compared side by side.
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run more than once. Run it BEFORE uploading the new app.js.
-- =====================================================================
alter table public.quotes add column if not exists lines jsonb not null default '[]'::jsonb; -- [{rk, price, note}]
alter table public.quotes add column if not exists meta  jsonb not null default '{}'::jsonb; -- {lump, taxIncl, extra, extraNote}


-- =====================================================================
-- Update 16: Estimate sections, master templates and quick estimates.
--  • codebook can hold section templates and whole-estimate (master) templates
--  • create_estimate_bid(): lets an estimator start a new estimate from the
--    Estimates page — it creates the bid record behind the scenes with them
--    as lead estimator (estimators can't create bids directly).
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to run more than once. Run it BEFORE uploading the new app.js.
-- =====================================================================
alter table public.codebook drop constraint if exists codebook_book_check;
alter table public.codebook add constraint codebook_book_check
  check (book in ('material','labor','equipment','crew','activity','biditem','section','estimate'));

create or replace function public.create_estimate_bid(p_name text, p_location text, p_client uuid, p_due date, p_type text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_est uuid;
begin
  if public.app_role() not in ('admin','estimator') then
    raise exception 'Only admins and estimators can start estimates.';
  end if;
  select id into v_est from public.estimators where user_id = auth.uid() limit 1;
  if v_est is null and public.app_role() = 'estimator' then
    raise exception 'Your login isn''t linked to an estimator record yet. Ask an admin to link it on the Team page.';
  end if;
  insert into public.bids (name, location, client_ids, due_date, bid_type, status, lead_estimator_id, updated_by)
  values (coalesce(nullif(trim(p_name), ''), 'Untitled project'), coalesce(p_location, ''),
          case when p_client is null then '{}'::uuid[] else array[p_client] end,
          p_due, coalesce(nullif(trim(p_type), ''), 'Hard bid'), 'Estimating', v_est, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_estimate_bid(text, text, uuid, date, text) from public;
grant execute on function public.create_estimate_bid(text, text, uuid, date, text) to authenticated;


-- =====================================================================
-- Update 17: Accounting tab
--   • new role: accounting (bookkeeper) — sees the Accounting tab only
--   • pay applications (progress billing with retainage)
--   • accounting IDs on clients and vendors
--   • change-order lines on jobs
--   • import keys on job costs so the same accounting rows never post twice
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================

-- 1. Role ---------------------------------------------------------------
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ~ '\mrole\M'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','estimator','board','pm','accounting','pending'));

-- admins, project managers and the bookkeeper
create or replace function public.can_acct() returns boolean
language sql stable security definer set search_path = public as $$
  select public.app_role() in ('admin','pm','accounting')
$$;

-- 2. Columns ------------------------------------------------------------
alter table public.clients   add column if not exists acct_id text not null default '';
alter table public.vendors   add column if not exists acct_id text not null default '';
alter table public.job_items add column if not exists change_order text not null default '';  -- CO number; blank = original contract
alter table public.job_items add column if not exists bid_price numeric(14,2);                -- contract value (schedule of values); blank = cost + overhead + markup
alter table public.job_costs add column if not exists import_key text;
create index if not exists job_costs_import_key_idx on public.job_costs(import_key);

-- 3. Pay applications ---------------------------------------------------
create table if not exists public.pay_apps (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.jobs(id) on delete cascade,
  number         int  not null default 1,
  period_to      date not null default current_date,
  app_date       date not null default current_date,
  status         text not null default 'Draft'
                 check (status in ('Draft','Submitted','Approved','Paid')),
  retainage_pct  numeric(6,3) not null default 10,
  lines          jsonb not null default '{}'::jsonb,   -- { job_item_id: {qty, pct, stored} } for this period
  meta           jsonb not null default '{}'::jsonb,   -- invoice no., paid date/amount, notes, retainage release
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users(id) on delete set null default auth.uid(),
  unique (job_id, number)
);
create index if not exists pay_apps_job_idx on public.pay_apps(job_id);
drop trigger if exists touch_pay_apps on public.pay_apps;
create trigger touch_pay_apps before update on public.pay_apps for each row execute function public.touch_updated_at();

-- 4. Row-level security -------------------------------------------------
alter table public.pay_apps enable row level security;
drop policy if exists "pay apps read"   on public.pay_apps;
drop policy if exists "pay apps write"  on public.pay_apps;
drop policy if exists "pay apps update" on public.pay_apps;
drop policy if exists "pay apps delete" on public.pay_apps;
create policy "pay apps read"   on public.pay_apps for select to authenticated using (public.can_acct());
create policy "pay apps write"  on public.pay_apps for insert to authenticated with check (public.can_acct());
create policy "pay apps update" on public.pay_apps for update to authenticated using (public.can_acct()) with check (public.can_acct());
create policy "pay apps delete" on public.pay_apps for delete to authenticated using (public.is_admin() or (public.can_acct() and status = 'Draft'));

-- the bookkeeper reads jobs and posts imported costs (admins and PMs keep their existing access)
drop policy if exists "jobs read acct"       on public.jobs;
drop policy if exists "job items read acct"  on public.job_items;
drop policy if exists "job costs read acct"  on public.job_costs;
drop policy if exists "job costs insert acct" on public.job_costs;
create policy "jobs read acct"        on public.jobs      for select to authenticated using (public.app_role() = 'accounting');
create policy "job items read acct"   on public.job_items for select to authenticated using (public.app_role() = 'accounting');
create policy "job costs read acct"   on public.job_costs for select to authenticated using (public.app_role() = 'accounting');
create policy "job costs insert acct" on public.job_costs for insert to authenticated with check (public.app_role() = 'accounting');

-- the bookkeeper keeps accounting IDs on clients and vendors
drop policy if exists "clients acct update" on public.clients;
drop policy if exists "vendors acct update" on public.vendors;
create policy "clients acct update" on public.clients for update to authenticated using (public.app_role() = 'accounting') with check (public.app_role() = 'accounting');
create policy "vendors acct update" on public.vendors for update to authenticated using (public.app_role() = 'accounting') with check (public.app_role() = 'accounting');

-- accounting settings (export formats, cost code list) can be saved by the bookkeeper and PMs too
drop policy if exists "settings acct write" on public.settings;
create policy "settings acct write" on public.settings for all to authenticated
  using (key = 'acct' and public.can_acct()) with check (key = 'acct' and public.can_acct());

-- PM names on the Accounting overview
create or replace function public.pm_directory()
returns table (id uuid, full_name text, email text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, p.role from public.profiles p
  where (public.can_job() or public.app_role() = 'accounting') and p.role in ('pm','admin')
  order by coalesce(nullif(p.full_name,''), p.email)
$$;
grant execute on function public.pm_directory() to authenticated;

-- 5. Live updates -------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.pay_apps;
exception when duplicate_object then null;
end $$;


-- =====================================================================
-- Update 18: Team & access
--   • new role: executive (sees everything, changes nothing)
--   • title and phone on each login
--   • per-person access: each area of the app can be set to
--     No access / View / Edit, overriding the person's role default
--   • the database enforces the same rules the app shows
-- Run AFTER update-17-accounting.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================

-- 1. Columns and roles ------------------------------------------------------
alter table public.profiles add column if not exists title text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists perms jsonb not null default '{}'::jsonb;

do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ~ '\mrole\M'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','executive','estimator','pm','accounting','board','pending'));

-- 2. Access levels -----------------------------------------------------------
-- Areas: dash, bids, estimates, codebook, jobs, acct, contacts, calc   → 'none' | 'view' | 'edit'
--        bids_scope                                                   → 'mine' | 'all'
-- Keep in step with ROLE_ACCESS in app.js.
create or replace function public.role_perm(r text, a text) returns text
language sql immutable as $$
  select case
    when r = 'admin' then case when a = 'bids_scope' then 'all' else 'edit' end
    when r = 'executive' then case when a = 'bids_scope' then 'all' else 'view' end
    when r = 'board' then case when a in ('dash','bids','estimates') then 'view' when a = 'bids_scope' then 'all' else 'none' end
    when r = 'estimator' then case
        when a in ('bids','estimates','calc') then 'edit'
        when a in ('dash','codebook','contacts') then 'view'
        when a = 'bids_scope' then 'mine' else 'none' end
    when r = 'pm' then case when a in ('jobs','acct','calc') then 'edit' when a = 'bids_scope' then 'all' else 'none' end
    when r = 'accounting' then case when a = 'acct' then 'edit' when a = 'bids_scope' then 'all' else 'none' end
    else case when a = 'bids_scope' then 'mine' else 'none' end
  end
$$;

-- the signed-in person's level for one area (role default unless overridden; admins always edit)
create or replace function public.perm(a text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when p.role = 'admin' then public.role_perm('admin', a)
      when p.role = 'pending' then public.role_perm('pending', a)
      else coalesce(nullif(p.perms->>a, ''), public.role_perm(p.role, a)) end
    from public.profiles p where p.id = auth.uid()), public.role_perm('pending', a))
$$;
create or replace function public.can_view(a text) returns boolean
language sql stable security definer set search_path = public as $$ select public.perm(a) in ('view','edit') $$;
create or replace function public.can_edit(a text) returns boolean
language sql stable security definer set search_path = public as $$ select public.perm(a) = 'edit' $$;
grant execute on function public.perm(text) to authenticated;

-- 3. Existing helpers now follow access levels --------------------------------
create or replace function public.can_see_bid(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_view('bids') and (public.perm('bids_scope') = 'all' or public.is_assigned(b))
$$;
create or replace function public.can_work_bid(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_edit('bids') and (public.perm('bids_scope') = 'all' or public.is_assigned(b))
$$;
-- can_job() = may change jobs; reading is can_view('jobs')
create or replace function public.can_job() returns boolean
language sql stable security definer set search_path = public as $$ select public.can_edit('jobs') $$;
-- can_acct() = may read accounting; changing it is can_edit('acct')
create or replace function public.can_acct() returns boolean
language sql stable security definer set search_path = public as $$ select public.can_view('acct') $$;
create or replace function public.can_read_bid_log(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_see_bid(b)
      or (public.can_view('jobs') and exists (select 1 from public.jobs j where j.bid_id = b))
$$;
create or replace function public.pm_directory()
returns table (id uuid, full_name text, email text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, p.role from public.profiles p
  where (public.can_view('jobs') or public.can_view('acct')) and p.role in ('pm','admin')
  order by coalesce(nullif(p.full_name,''), p.email)
$$;
grant execute on function public.pm_directory() to authenticated;

-- people who can edit all bids may also change estimator assignments
create or replace function public.guard_bid_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  if not (public.can_edit('bids') and public.perm('bids_scope') = 'all') then
    if new.lead_estimator_id is distinct from old.lead_estimator_id
       or new.support_estimator_ids is distinct from old.support_estimator_ids then
      raise exception 'Only someone who manages all bids can change estimator assignments';
    end if;
  end if;
  for e in select value from jsonb_array_elements(coalesce(new.scope_items, '[]'::jsonb)) loop
    if coalesce(e->>'signed_by_user', '') <> '' and not exists (
         select 1 from jsonb_array_elements(coalesce(old.scope_items, '[]'::jsonb)) o
         where o.value->>'id' = e->>'id'
           and o.value->>'signed_by_user' = e->>'signed_by_user'
           and o.value->>'signed_at' is not distinct from e->>'signed_at') then
      if e->>'signed_by_user' <> auth.uid()::text then
        raise exception 'A scope can only be signed off by the person who is signed in';
      end if;
    end if;
  end loop;
  return new;
end $$;

create or replace function public.create_estimate_bid(p_name text, p_location text, p_client uuid, p_due date, p_type text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_est uuid;
begin
  if not (public.can_edit('bids') and public.can_edit('estimates')) then
    raise exception 'You don''t have access to start estimates.';
  end if;
  select id into v_est from public.estimators where user_id = auth.uid() limit 1;
  if v_est is null and public.perm('bids_scope') = 'mine' then
    raise exception 'Your login isn''t linked to an estimator record yet. Ask an admin to link it on the Team page.';
  end if;
  insert into public.bids (name, location, client_ids, due_date, bid_type, status, lead_estimator_id, updated_by)
  values (coalesce(nullif(trim(p_name), ''), 'Untitled project'), coalesce(p_location, ''),
          case when p_client is null then '{}'::uuid[] else array[p_client] end,
          p_due, coalesce(nullif(trim(p_type), ''), 'Hard bid'), 'Estimating', v_est, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_estimate_bid(text, text, uuid, date, text) from public;
grant execute on function public.create_estimate_bid(text, text, uuid, date, text) to authenticated;

-- 4. Policies -----------------------------------------------------------------
-- bids: anyone who edits all bids can add them; deleting stays with admins
drop policy if exists "bids insert" on public.bids;
create policy "bids insert" on public.bids for insert to authenticated
  with check (public.can_edit('bids') and public.perm('bids_scope') = 'all');

-- estimates follow the bid, plus the estimates area
drop policy if exists "estimates read"   on public.estimates;
drop policy if exists "estimates insert" on public.estimates;
drop policy if exists "estimates update" on public.estimates;
create policy "estimates read"   on public.estimates for select to authenticated
  using (public.can_see_bid(bid_id) and public.can_view('estimates'));
create policy "estimates insert" on public.estimates for insert to authenticated
  with check (public.can_work_bid(bid_id) and public.can_edit('estimates'));
create policy "estimates update" on public.estimates for update to authenticated
  using (public.can_work_bid(bid_id) and public.can_edit('estimates')) with check (public.can_work_bid(bid_id) and public.can_edit('estimates'));

-- codebooks: read to price estimates, edit with the codebook area
drop policy if exists "codebook read"   on public.codebook;
drop policy if exists "codebook insert" on public.codebook;
drop policy if exists "codebook update" on public.codebook;
drop policy if exists "codebook delete" on public.codebook;
create policy "codebook read"   on public.codebook for select to authenticated using (public.can_view('codebook') or public.can_view('estimates'));
create policy "codebook insert" on public.codebook for insert to authenticated with check (public.can_edit('codebook'));
create policy "codebook update" on public.codebook for update to authenticated using (public.can_edit('codebook')) with check (public.can_edit('codebook'));
create policy "codebook delete" on public.codebook for delete to authenticated using (public.can_edit('codebook'));

-- contacts
drop policy if exists "clients write" on public.clients;
drop policy if exists "vendors write" on public.vendors;
drop policy if exists "clients acct update" on public.clients;
drop policy if exists "vendors acct update" on public.vendors;
create policy "clients write" on public.clients for all to authenticated using (public.can_edit('contacts')) with check (public.can_edit('contacts'));
create policy "vendors write" on public.vendors for all to authenticated using (public.can_edit('contacts')) with check (public.can_edit('contacts'));
-- accounting keeps account IDs on clients and vendors
create policy "clients acct update" on public.clients for update to authenticated using (public.can_edit('acct')) with check (public.can_edit('acct'));
create policy "vendors acct update" on public.vendors for update to authenticated using (public.can_edit('acct')) with check (public.can_edit('acct'));

-- settings: bid settings, scope library and proposal library go with codebooks; accounting settings with accounting
drop policy if exists "settings est write"  on public.settings;
drop policy if exists "settings acct write" on public.settings;
create policy "settings est write" on public.settings for all to authenticated
  using (key in ('est_settings','scope_library','prop_library') and public.can_edit('codebook'))
  with check (key in ('est_settings','scope_library','prop_library') and public.can_edit('codebook'));
create policy "settings acct write" on public.settings for all to authenticated
  using (key = 'acct' and public.can_edit('acct')) with check (key = 'acct' and public.can_edit('acct'));

-- jobs: view or edit with the jobs area; accounting reads them and posts imported costs
drop policy if exists "jobs read"             on public.jobs;
drop policy if exists "jobs insert"           on public.jobs;
drop policy if exists "jobs update"           on public.jobs;
drop policy if exists "jobs read acct"        on public.jobs;
drop policy if exists "job items read"        on public.job_items;
drop policy if exists "job items write"       on public.job_items;
drop policy if exists "job items read acct"   on public.job_items;
drop policy if exists "job costs read"        on public.job_costs;
drop policy if exists "job costs insert"      on public.job_costs;
drop policy if exists "job costs read acct"   on public.job_costs;
drop policy if exists "job costs insert acct" on public.job_costs;
create policy "jobs read"   on public.jobs for select to authenticated using (public.can_view('jobs') or public.can_view('acct'));
create policy "jobs insert" on public.jobs for insert to authenticated with check (public.can_edit('jobs'));
create policy "jobs update" on public.jobs for update to authenticated using (public.can_edit('jobs')) with check (public.can_edit('jobs'));
create policy "job items read"  on public.job_items for select to authenticated using (public.can_view('jobs') or public.can_view('acct'));
create policy "job items write" on public.job_items for all    to authenticated using (public.can_edit('jobs') or public.can_edit('acct')) with check (public.can_edit('jobs') or public.can_edit('acct'));
create policy "job costs read"   on public.job_costs for select to authenticated using (public.can_view('jobs') or public.can_view('acct'));
create policy "job costs insert" on public.job_costs for insert to authenticated with check (public.can_edit('jobs') or public.can_edit('acct'));

-- pay apps: view or edit with the accounting area
drop policy if exists "pay apps read"   on public.pay_apps;
drop policy if exists "pay apps write"  on public.pay_apps;
drop policy if exists "pay apps update" on public.pay_apps;
drop policy if exists "pay apps delete" on public.pay_apps;
create policy "pay apps read"   on public.pay_apps for select to authenticated using (public.can_view('acct'));
create policy "pay apps write"  on public.pay_apps for insert to authenticated with check (public.can_edit('acct'));
create policy "pay apps update" on public.pay_apps for update to authenticated using (public.can_edit('acct')) with check (public.can_edit('acct'));
create policy "pay apps delete" on public.pay_apps for delete to authenticated using (public.is_admin() or (public.can_edit('acct') and status = 'Draft'));


-- =====================================================================
-- Update 19: Help tab, feedback, and the developer account
--   • feedback: anyone signed in can send a bug report or an idea and
--     see their own; the developer sees and manages all of it
--   • developer flag on a login: turns on the Developer tab. It can only
--     be switched on here in the SQL Editor, never from inside the app.
-- Run AFTER update-18-team-access.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================

-- 1. Developer flag ----------------------------------------------------------
alter table public.profiles add column if not exists is_dev boolean not null default false;

create or replace function public.is_dev() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_dev from public.profiles where id = auth.uid()), false)
$$;
grant execute on function public.is_dev() to authenticated;

-- nobody can make themselves (or anyone) a developer from the app;
-- only an existing developer, or the SQL Editor, can change the flag
create or replace function public.guard_profile_dev() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_dev is distinct from old.is_dev and auth.uid() is not null and not public.is_dev() then
    raise exception 'Only the developer can change developer access';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_dev on public.profiles;
create trigger guard_profile_dev before update on public.profiles
  for each row execute function public.guard_profile_dev();

-- ▶ TO MAKE YOUR LOGIN THE DEVELOPER: put your sign-in email below, remove the two dashes, and run it.
-- update public.profiles set is_dev = true where email = 'you@yourcompany.com';

-- 2. Feedback ------------------------------------------------------------------
create table if not exists public.feedback (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_by_name text not null default '',
  created_by_role text not null default '',
  kind            text not null default 'bug' check (kind in ('bug','feature','question','other')),
  area            text not null default '',          -- part of the app
  title           text not null default '',
  body            text not null default '',
  importance      text not null default 'normal' check (importance in ('low','normal','high')),
  context         jsonb not null default '{}'::jsonb, -- page, browser, screen size, app build
  status          text not null default 'New'
                  check (status in ('New','Reviewing','Planned','In progress','Done','Won''t do','Duplicate')),
  priority        text not null default '' check (priority in ('','P1','P2','P3')),
  dev_notes       text not null default '',           -- private to the developer
  reply           text not null default '',           -- shown to the person who sent it
  replied_at      timestamptz
);
create index if not exists feedback_status_idx on public.feedback(status);
create index if not exists feedback_by_idx on public.feedback(created_by);
drop trigger if exists touch_feedback on public.feedback;
create trigger touch_feedback before update on public.feedback for each row execute function public.touch_updated_at();

alter table public.feedback enable row level security;
drop policy if exists "feedback read"   on public.feedback;
drop policy if exists "feedback insert" on public.feedback;
drop policy if exists "feedback update" on public.feedback;
drop policy if exists "feedback delete" on public.feedback;
-- Only the developer reads the table itself (it holds private developer notes).
-- Everyone else reads their own feedback through my_feedback() below, which leaves the notes out.
create policy "feedback read"   on public.feedback for select to authenticated
  using (public.is_dev());
-- anyone with access to the app can send feedback, as themselves, and can't pre-fill the developer's fields
create policy "feedback insert" on public.feedback for insert to authenticated
  with check (public.app_role() <> 'pending' and created_by = auth.uid()
              and status = 'New' and priority = '' and dev_notes = '' and reply = '');
-- only the developer changes status, priority, notes and replies, or deletes
create policy "feedback update" on public.feedback for update to authenticated
  using (public.is_dev()) with check (public.is_dev());
create policy "feedback delete" on public.feedback for delete to authenticated
  using (public.is_dev());

-- what you sent, with its status and the developer's reply (never the private notes)
create or replace function public.my_feedback()
returns table (id uuid, created_at timestamptz, kind text, area text, title text, body text, importance text, status text, reply text, replied_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, f.created_at, f.kind, f.area, f.title, f.body, f.importance, f.status, f.reply, f.replied_at
  from public.feedback f where f.created_by = auth.uid() order by f.created_at desc
$$;
grant execute on function public.my_feedback() to authenticated;

-- take back something you sent, while it's still New
create or replace function public.withdraw_feedback(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.feedback where id = p_id and created_by = auth.uid() and status = 'New';
  get diagnostics n = row_count;
  return n > 0;
end $$;
grant execute on function public.withdraw_feedback(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.feedback;
exception when duplicate_object then null;
end $$;


-- =====================================================================
-- Update 20: storage and capacity for the Developer tab
--   dev_usage() reports how much space the database and the uploaded
--   files are using. Only the developer login can call it.
-- Run AFTER update-19-help-developer.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================
create or replace function public.dev_usage() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb; fs jsonb := '{}'::jsonb; us jsonb := '{}'::jsonb;
begin
  if not public.is_dev() then
    raise exception 'Only the developer can read usage';
  end if;

  -- database: total size, and each app table (data + indexes)
  select jsonb_build_object(
    'at', now(),
    'db_bytes', pg_database_size(current_database()),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.relname, 'bytes', pg_total_relation_size(c.oid),
                                          'rows', greatest(c.reltuples, 0)::bigint)
                       order by pg_total_relation_size(c.oid) desc)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'), '[]'::jsonb)
  ) into r;

  -- uploaded files (plans, quotes, photos)
  begin
    execute $q$
      select jsonb_build_object(
        'bytes', coalesce(sum((o.metadata->>'size')::bigint), 0),
        'count', count(*),
        'largest', coalesce((select jsonb_agg(x) from (
            select jsonb_build_object('name', o2.name, 'bytes', (o2.metadata->>'size')::bigint) x
            from storage.objects o2 where o2.metadata ? 'size'
            order by (o2.metadata->>'size')::bigint desc limit 8) t), '[]'::jsonb))
      from storage.objects o $q$ into fs;
  exception when others then
    fs := jsonb_build_object('error', sqlerrm);
  end;

  -- logins: total, and how many signed in during the last 30 days
  begin
    execute $q$
      select jsonb_build_object('total', count(*),
        'active30', count(*) filter (where last_sign_in_at > now() - interval '30 days'))
      from auth.users $q$ into us;
  exception when others then
    begin
      execute 'select jsonb_build_object(''total'', count(*)) from auth.users' into us;
    exception when others then us := jsonb_build_object('error', sqlerrm);
    end;
  end;

  return r || jsonb_build_object('files', fs, 'users', us);
end $$;
revoke all on function public.dev_usage() from public;
grant execute on function public.dev_usage() to authenticated;


-- =====================================================================
-- Update 21: Break room — profiles, trophies and games
--   • each person can customize their own profile (avatar, tagline…)
--   • a crew directory everyone can see (names, titles, profiles only)
--   • trophy stats: counts of each person's accomplishments
--   • game scores and trivia streaks
-- Run AFTER update-20-dev-usage.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================

-- 1. Profiles ---------------------------------------------------------------
alter table public.profiles add column if not exists profile jsonb not null default '{}'::jsonb;

-- You can change your own name, title, phone and profile — never your role or access.
create or replace function public.update_my_profile(p_name text, p_title text, p_phone text, p_profile jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if length(coalesce(p_profile, '{}'::jsonb)::text) > 6000 then raise exception 'That profile is too long'; end if;
  update public.profiles
     set full_name = left(coalesce(p_name, full_name), 80),
         title     = left(coalesce(p_title, title), 80),
         phone     = left(coalesce(p_phone, phone), 40),
         profile   = coalesce(p_profile, profile)
   where id = auth.uid();
end $$;
revoke all on function public.update_my_profile(text, text, text, jsonb) from public;
grant execute on function public.update_my_profile(text, text, text, jsonb) to authenticated;

-- Everyone with access sees who's on the crew (no emails, roles' access or anything private).
create or replace function public.crew_directory()
returns table (id uuid, full_name text, title text, role text, profile jsonb, joined date)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)), p.title, p.role, p.profile, p.created_at::date
  from public.profiles p
  where public.app_role() <> 'pending' and p.role <> 'pending'
  order by 2
$$;
grant execute on function public.crew_directory() to authenticated;

-- 2. Game scores, streaks and other fun numbers --------------------------------
create table if not exists public.fun_stats (
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  key        text not null,                 -- dirt, pipe, guess, trivia …
  value      numeric not null default 0,    -- best score or running total
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.fun_stats enable row level security;
drop policy if exists "fun read"   on public.fun_stats;
drop policy if exists "fun insert" on public.fun_stats;
drop policy if exists "fun update" on public.fun_stats;
drop policy if exists "fun delete" on public.fun_stats;
create policy "fun read"   on public.fun_stats for select to authenticated using (public.app_role() <> 'pending');
create policy "fun insert" on public.fun_stats for insert to authenticated with check (user_id = auth.uid() and public.app_role() <> 'pending');
create policy "fun update" on public.fun_stats for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "fun delete" on public.fun_stats for delete to authenticated using (user_id = auth.uid() or public.is_dev());
do $$
begin
  alter publication supabase_realtime add table public.fun_stats;
exception when duplicate_object then null;
end $$;

-- 3. Trophy stats: counts only, so the trophy room works for everyone -----------
-- One row per person, plus one row with user_id null for the whole company.
create or replace function public.trophy_stats()
returns table (user_id uuid, stats jsonb)
language sql stable security definer set search_path = public as $$
  with allowed as (select public.app_role() <> 'pending' as ok),
  eb as (  -- each bid an estimator worked, as lead or support
    select e.user_id, b.id, b.status, (b.lead_estimator_id = e.id) as lead,
           coalesce(b.awarded_amount, b.amount_with, b.amount_without, 0) as amt,
           coalesce(b.awarded_date, b.updated_at::date) as won_on
    from public.estimators e
    join public.bids b on b.lead_estimator_id = e.id or e.id = any(b.support_estimator_ids)
    where e.user_id is not null
  ),
  so as (  -- scope sign-offs
    select (s.value->>'signed_by_user') as uid, count(*) as n
    from public.bids b, jsonb_array_elements(case when jsonb_typeof(b.scope_items) = 'array' then b.scope_items else '[]'::jsonb end) s
    where coalesce(s.value->>'signed_by_user', '') <> ''
    group by 1
  )
  select p.id, jsonb_build_object(
      'bids',       (select count(*) from eb where eb.user_id = p.id),
      'bids_led',   (select count(*) from eb where eb.user_id = p.id and eb.lead),
      'submitted',  (select count(*) from eb where eb.user_id = p.id and eb.status in ('Submitted','Awarded','Not Awarded')),
      'wins',       (select count(*) from eb where eb.user_id = p.id and eb.status = 'Awarded'),
      'wins_year',  (select count(*) from eb where eb.user_id = p.id and eb.status = 'Awarded' and extract(year from eb.won_on) = extract(year from now())),
      'won_value',  (select coalesce(sum(eb.amt), 0) from eb where eb.user_id = p.id and eb.status = 'Awarded'),
      'biggest_win',(select coalesce(max(eb.amt), 0) from eb where eb.user_id = p.id and eb.status = 'Awarded'),
      'signoffs',   coalesce((select so.n from so where so.uid = p.id::text), 0),
      'notes',      (select count(*) from public.bid_log l where l.created_by = p.id),
      'estimates',  (select count(*) from public.estimates e where e.updated_by = p.id),
      'jobs',       (select count(*) from public.jobs j where j.pm_user_id = p.id),
      'jobs_done',  (select count(*) from public.jobs j where j.pm_user_id = p.id and j.status = 'Complete'),
      'cost_entries',(select count(*) from public.job_costs c where c.created_by = p.id),
      'production', (select count(*) from public.job_costs c where c.created_by = p.id and coalesce(c.qty, 0) > 0),
      'pay_apps',   (select count(*) from public.pay_apps a where a.updated_by = p.id and a.status <> 'Draft'),
      'feedback',   (select count(*) from public.feedback f where f.created_by = p.id),
      'bugs_fixed', (select count(*) from public.feedback f where f.created_by = p.id and f.kind = 'bug' and f.status = 'Done'),
      'ideas_built',(select count(*) from public.feedback f where f.created_by = p.id and f.kind = 'feature' and f.status = 'Done'),
      'days',       greatest(0, (now()::date - p.created_at::date))
    )
  from public.profiles p, allowed
  where allowed.ok and p.role <> 'pending'
  union all
  select null::uuid, jsonb_build_object(
      'bids',      (select count(*) from public.bids),
      'wins',      (select count(*) from public.bids b where b.status = 'Awarded'),
      'wins_year', (select count(*) from public.bids b where b.status = 'Awarded' and extract(year from coalesce(b.awarded_date, b.updated_at::date)) = extract(year from now())),
      'won_value', (select coalesce(sum(coalesce(b.awarded_amount, b.amount_with, b.amount_without, 0)), 0) from public.bids b where b.status = 'Awarded'),
      'biggest_win',(select coalesce(max(coalesce(b.awarded_amount, b.amount_with, b.amount_without, 0)), 0) from public.bids b where b.status = 'Awarded'),
      'jobs',      (select count(*) from public.jobs),
      'jobs_done', (select count(*) from public.jobs j where j.status = 'Complete'),
      'estimates', (select count(*) from public.estimates),
      'people',    (select count(*) from public.profiles p where p.role <> 'pending'),
      'feedback',  (select count(*) from public.feedback),
      'bugs_fixed',(select count(*) from public.feedback f where f.kind = 'bug' and f.status = 'Done'),
      'codebook',  (select count(*) from public.codebook)
    )
  from allowed where allowed.ok
$$;
revoke all on function public.trophy_stats() from public;
grant execute on function public.trophy_stats() to authenticated;
-- =====================================================================
-- Update 22: Estimate revisions
--   • estimate_versions: locked copies of an estimate, kept when you start
--     a revision (prelim plans → stamped plans) so the number you
--     submitted stays on record
-- Run AFTER update-21-break-room.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================
create table if not exists public.estimate_versions (
  id              uuid primary key default gen_random_uuid(),
  bid_id          uuid not null references public.bids(id) on delete cascade,
  label           text not null default '',
  note            text not null default '',
  rev             integer not null default 0,          -- 0 = original, 1 = revision 1 …
  data            jsonb not null default '{}'::jsonb,   -- the whole estimate as it was
  total_cost      numeric(14,2),
  total_price     numeric(14,2),
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_by_name text not null default ''
);
create index if not exists estimate_versions_bid_idx on public.estimate_versions(bid_id);

alter table public.estimate_versions enable row level security;
drop policy if exists "estver read"   on public.estimate_versions;
drop policy if exists "estver insert" on public.estimate_versions;
drop policy if exists "estver delete" on public.estimate_versions;
-- same people as the estimate itself; copies are never edited, and only an admin deletes one
create policy "estver read"   on public.estimate_versions for select to authenticated
  using (public.can_see_bid(bid_id) and public.can_view('estimates'));
create policy "estver insert" on public.estimate_versions for insert to authenticated
  with check (public.can_work_bid(bid_id) and public.can_edit('estimates'));
create policy "estver delete" on public.estimate_versions for delete to authenticated
  using (public.is_admin());
-- =====================================================================
-- Update 23: Your own proposal templates
--   • proposal_templates: the company's Word (.docx) and Excel (.xlsx)
--     proposal files. The app fills the {{fields}} in them for each bid.
--     Admins upload and remove them; anyone who can see estimates uses them.
-- Run AFTER update-22-estimate-revisions.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================
create table if not exists public.proposal_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null default '',
  kind            text not null check (kind in ('docx','xlsx')),
  filename        text not null default '',
  size            integer not null default 0,
  file            text not null default '',            -- the file itself, base64
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_by_name text not null default '',
  constraint proposal_templates_size check (length(file) <= 6000000)
);
drop trigger if exists touch_proposal_templates on public.proposal_templates;
create trigger touch_proposal_templates before update on public.proposal_templates
  for each row execute function public.touch_updated_at();

alter table public.proposal_templates enable row level security;
drop policy if exists "proptpl read"   on public.proposal_templates;
drop policy if exists "proptpl insert" on public.proposal_templates;
drop policy if exists "proptpl update" on public.proposal_templates;
drop policy if exists "proptpl delete" on public.proposal_templates;
create policy "proptpl read"   on public.proposal_templates for select to authenticated
  using (public.can_view('estimates'));
create policy "proptpl insert" on public.proposal_templates for insert to authenticated
  with check (public.is_admin());
create policy "proptpl update" on public.proposal_templates for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "proptpl delete" on public.proposal_templates for delete to authenticated
  using (public.is_admin());
-- =====================================================================
-- Update 24: Estimators see every bid, and can ask to work on one
--   • new "which bids" level: 'view' = see all bids, work only on the
--     ones you're assigned to. It is the new default for estimators.
--   • bid_requests: an estimator asks to work on a bid; someone who
--     manages all bids approves (adds them as a supporting estimator) or denies
-- Run AFTER update-23-proposal-templates.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================

-- 1. Access levels: bids_scope is now 'mine' | 'view' | 'all' ------------------
-- Keep in step with ROLE_ACCESS in app.js.
create or replace function public.role_perm(r text, a text) returns text
language sql immutable as $$
  select case
    when r = 'admin' then case when a = 'bids_scope' then 'all' else 'edit' end
    when r = 'executive' then case when a = 'bids_scope' then 'all' else 'view' end
    when r = 'board' then case when a in ('dash','bids','estimates') then 'view' when a = 'bids_scope' then 'all' else 'none' end
    when r = 'estimator' then case
        when a in ('bids','estimates','calc') then 'edit'
        when a in ('dash','codebook','contacts') then 'view'
        when a = 'bids_scope' then 'view' else 'none' end
    when r = 'pm' then case when a in ('jobs','acct','calc') then 'edit' when a = 'bids_scope' then 'all' else 'none' end
    when r = 'accounting' then case when a = 'acct' then 'edit' when a = 'bids_scope' then 'all' else 'none' end
    else case when a = 'bids_scope' then 'mine' else 'none' end
  end
$$;

-- seeing a bid: everyone at 'view' or 'all'; working on it is unchanged (assigned, or 'all')
create or replace function public.can_see_bid(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_view('bids') and (public.perm('bids_scope') in ('all','view') or public.is_assigned(b))
$$;

create or replace function public.create_estimate_bid(p_name text, p_location text, p_client uuid, p_due date, p_type text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_est uuid;
begin
  if not (public.can_edit('bids') and public.can_edit('estimates')) then
    raise exception 'You don''t have access to start estimates.';
  end if;
  select id into v_est from public.estimators where user_id = auth.uid() limit 1;
  if v_est is null and public.perm('bids_scope') <> 'all' then
    raise exception 'Your login isn''t linked to an estimator record yet. Ask an admin to link it on the Team page.';
  end if;
  insert into public.bids (name, location, client_ids, due_date, bid_type, status, lead_estimator_id, updated_by)
  values (coalesce(nullif(trim(p_name), ''), 'Untitled project'), coalesce(p_location, ''),
          case when p_client is null then '{}'::uuid[] else array[p_client] end,
          p_due, coalesce(nullif(trim(p_type), ''), 'Hard bid'), 'Estimating', v_est, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_estimate_bid(text, text, uuid, date, text) from public;
grant execute on function public.create_estimate_bid(text, text, uuid, date, text) to authenticated;

-- 2. Requests to work on a bid ---------------------------------------------------
create table if not exists public.bid_requests (
  id              uuid primary key default gen_random_uuid(),
  bid_id          uuid not null references public.bids(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade default auth.uid(),
  estimator_id    uuid references public.estimators(id) on delete cascade,
  name            text not null default '',
  note            text not null default '',
  status          text not null default 'Pending' check (status in ('Pending','Approved','Denied')),
  decided_by_name text not null default '',
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists bid_requests_bid_idx on public.bid_requests(bid_id);

alter table public.bid_requests enable row level security;
drop policy if exists "bidreq read"   on public.bid_requests;
drop policy if exists "bidreq insert" on public.bid_requests;
drop policy if exists "bidreq update" on public.bid_requests;
drop policy if exists "bidreq delete" on public.bid_requests;
-- you see your own; people who manage all bids see every request
create policy "bidreq read"   on public.bid_requests for select to authenticated
  using (user_id = auth.uid() or (public.can_edit('bids') and public.perm('bids_scope') = 'all'));
-- you ask for yourself, for a bid you can see, and can't pre-approve it
create policy "bidreq insert" on public.bid_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'Pending' and decided_by_name = '' and public.can_edit('bids') and public.can_see_bid(bid_id)
              and (estimator_id is null or exists (select 1 from public.estimators e where e.id = estimator_id and e.user_id = auth.uid())));
create policy "bidreq update" on public.bid_requests for update to authenticated
  using (public.can_edit('bids') and public.perm('bids_scope') = 'all')
  with check (public.can_edit('bids') and public.perm('bids_scope') = 'all');
create policy "bidreq delete" on public.bid_requests for delete to authenticated
  using (public.is_admin() or (user_id = auth.uid() and status = 'Pending'));
do $$
begin
  alter publication supabase_realtime add table public.bid_requests;
exception when duplicate_object then null;
end $$;
-- =====================================================================
-- Update 25: Change orders
--   • change_orders: priced change orders on a job, written by PMs
--     (anyone who can edit jobs), tracked Draft → Sent → Approved/Rejected.
--     Approving one adds a change-order line to the job's budget.
-- Run AFTER update-24-estimator-view-requests.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================
create table if not exists public.change_orders (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  number          text not null default '',
  title           text not null default '',
  description     text not null default '',
  reason          text not null default '',
  status          text not null default 'Draft' check (status in ('Draft','Sent','Approved','Rejected','Void')),
  days            integer,                              -- working days added to the schedule
  data            jsonb not null default '{}'::jsonb,   -- {lines:[{kind,desc,qty,unit,price}], mk:{self,sub,bond}, notes, detail}
  cost            numeric(14,2),
  price           numeric(14,2),
  sent_date       date,
  approved_date   date,
  approved_by     text not null default '',
  job_item_id     uuid references public.job_items(id) on delete set null,  -- the budget line made on approval
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by_name text not null default ''
);
create index if not exists change_orders_job_idx on public.change_orders(job_id);
create unique index if not exists change_orders_job_number on public.change_orders(job_id, number);
drop trigger if exists touch_change_orders on public.change_orders;
create trigger touch_change_orders before update on public.change_orders
  for each row execute function public.touch_updated_at();

alter table public.change_orders enable row level security;
drop policy if exists "co read"   on public.change_orders;
drop policy if exists "co insert" on public.change_orders;
drop policy if exists "co update" on public.change_orders;
drop policy if exists "co delete" on public.change_orders;
-- read with jobs or accounting; write with edit access to jobs (PMs and admins by default)
create policy "co read"   on public.change_orders for select to authenticated
  using (public.can_view('jobs') or public.can_view('acct'));
create policy "co insert" on public.change_orders for insert to authenticated
  with check (public.can_edit('jobs'));
create policy "co update" on public.change_orders for update to authenticated
  using (public.can_edit('jobs')) with check (public.can_edit('jobs'));
create policy "co delete" on public.change_orders for delete to authenticated
  using (public.can_edit('jobs') and status <> 'Approved');
do $$
begin
  alter publication supabase_realtime add table public.change_orders;
exception when duplicate_object then null;
end $$;
-- =====================================================================
-- Update 26: Create and manage logins from the Team page
--   Admin-only database functions. Nothing here puts a secret key in the
--   app: each function checks that the signed-in person is an admin.
--   • admin_user_list      who has signed in, who is deactivated
--   • admin_finish_user    confirms a new login's email, sets name/role/title
--   • admin_set_password   sets a temporary password
--   • admin_set_active     deactivate (blocks sign-in, removes access) / reactivate
--   • admin_delete_user    removes a login for good
-- Run AFTER update-25-change-orders.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
--
-- ALSO, once, in Supabase → Authentication → Sign In / Providers:
--   keep "Allow new users to sign up" ON. New people still get no access
--   until an admin gives them a role.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- shared checks: caller is an admin; the target isn't the caller or a developer login
create or replace function public.admin_guard(p_id uuid, p_protect boolean) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Only an admin can manage accounts'; end if;
  if p_id is null or not exists (select 1 from public.profiles where id = p_id) then raise exception 'That account doesn''t exist'; end if;
  if p_protect then
    if p_id = auth.uid() then raise exception 'You can''t do that to your own account'; end if;
    if coalesce((select is_dev from public.profiles where id = p_id), false) and not public.is_dev() then
      raise exception 'Only the developer can change the developer account';
    end if;
  end if;
end $$;
revoke all on function public.admin_guard(uuid, boolean) from public;

create or replace function public.admin_user_list()
returns table (id uuid, last_sign_in_at timestamptz, confirmed boolean, banned boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Only an admin can manage accounts'; end if;
  return query select u.id, u.last_sign_in_at, u.email_confirmed_at is not null, coalesce(u.banned_until > now(), false) from auth.users u;
end $$;

create or replace function public.admin_finish_user(p_id uuid, p_name text, p_role text, p_title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard(p_id, false);
  if p_role is not null and p_role not in ('admin','executive','estimator','pm','accounting','board','pending') then raise exception 'Unknown role'; end if;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = p_id;
  update public.profiles
     set full_name = coalesce(nullif(trim(p_name), ''), full_name),
         role      = coalesce(p_role, role),
         title     = coalesce(nullif(trim(p_title), ''), title)
   where id = p_id;
end $$;

create or replace function public.admin_set_password(p_id uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.admin_guard(p_id, false);
  if coalesce((select is_dev from public.profiles where id = p_id), false) and not public.is_dev() then
    raise exception 'Only the developer can change the developer account';
  end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'The password needs at least 8 characters'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_id;
end $$;

create or replace function public.admin_set_active(p_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard(p_id, true);
  if p_active then
    update auth.users set banned_until = null where id = p_id;
  else
    update auth.users set banned_until = 'infinity' where id = p_id;
    update public.profiles set role = 'pending', perms = '{}'::jsonb where id = p_id;   -- access ends right away, even for an open session
  end if;
end $$;

create or replace function public.admin_delete_user(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard(p_id, true);
  update public.estimators set user_id = null where user_id = p_id;
  delete from auth.users where id = p_id;
  delete from public.profiles where id = p_id;
end $$;

revoke all on function public.admin_user_list() from public;
revoke all on function public.admin_finish_user(uuid, text, text, text) from public;
revoke all on function public.admin_set_password(uuid, text) from public;
revoke all on function public.admin_set_active(uuid, boolean) from public;
revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_user_list() to authenticated;
grant execute on function public.admin_finish_user(uuid, text, text, text) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
grant execute on function public.admin_set_active(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
-- =====================================================================
-- Update 27: Choose your own password at first sign-in
--   When an admin creates a login or sets a temporary password, the
--   person must pick their own password the next time they sign in.
-- Run AFTER update-26-accounts.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================
alter table public.profiles add column if not exists must_change_pw boolean not null default false;

-- called by the app right after the person saves their new password
create or replace function public.password_changed() returns void
language sql security definer set search_path = public as $$
  update public.profiles set must_change_pw = false where id = auth.uid()
$$;
revoke all on function public.password_changed() from public;
grant execute on function public.password_changed() to authenticated;

create or replace function public.admin_finish_user(p_id uuid, p_name text, p_role text, p_title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard(p_id, false);
  if p_role is not null and p_role not in ('admin','executive','estimator','pm','accounting','board','pending') then raise exception 'Unknown role'; end if;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = p_id;
  update public.profiles
     set full_name = coalesce(nullif(trim(p_name), ''), full_name),
         role      = coalesce(p_role, role),
         title     = coalesce(nullif(trim(p_title), ''), title),
         must_change_pw = case when p_role is not null then true else must_change_pw end   -- a brand-new login
   where id = p_id;
end $$;

create or replace function public.admin_set_password(p_id uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.admin_guard(p_id, false);
  if coalesce((select is_dev from public.profiles where id = p_id), false) and not public.is_dev() then
    raise exception 'Only the developer can change the developer account';
  end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'The password needs at least 8 characters'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_id;
  update public.profiles set must_change_pw = (p_id <> auth.uid()) where id = p_id;
end $$;
-- =====================================================================
-- Update 28: Client bid tracker
--   Each GC / client gets one private link. Opening it (no login) shows
--   every project that client has sent you and the stage each bid is in.
--   It never shows prices, margins, other GCs, notes or internal detail.
--   • clients.track_token   the secret in the link
--   • bids.proposal_eta     "proposal expected by" date shown to the client
--   • client_track_link()   staff: get (or, admins, replace) a client's link
--   • client_tracker()      public: what the page shows for one link
-- Run AFTER update-27-first-login-password.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================
alter table public.clients add column if not exists track_token text;
create unique index if not exists clients_track_token on public.clients(track_token) where track_token is not null;
alter table public.bids add column if not exists proposal_eta date;

create or replace function public.client_track_link(p_client uuid, p_new boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if auth.uid() is null or not (public.can_edit('bids') or public.can_edit('contacts')) then raise exception 'You don''t have access to client tracker links'; end if;
  select track_token into v from public.clients where id = p_client;
  if not found then raise exception 'That client doesn''t exist'; end if;
  if p_new and not public.is_admin() then raise exception 'Only an admin can replace a tracker link'; end if;
  if v is null or p_new then
    v := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update public.clients set track_token = v where id = p_client;
  end if;
  return v;
end $$;
revoke all on function public.client_track_link(uuid, boolean) from public;
grant execute on function public.client_track_link(uuid, boolean) to authenticated;

-- Public. Returns only what a client may see, for the one client the link belongs to.
create or replace function public.client_tracker(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c record;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select id, company into c from public.clients where track_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object('client', c.company, 'as_of', now(), 'bids', coalesce((
    select jsonb_agg(x.j order by x.decided, x.due nulls last, x.name) from (
      select b.name, b.due_date as due, (b.status in ('Awarded','Not Awarded','No Bid')) as decided,
        jsonb_build_object(
          'name', b.name, 'location', b.location, 'status', b.status,
          'received', b.created_at::date, 'due_date', b.due_date, 'due_time', b.due_time,
          'proposal_eta', coalesce(b.proposal_eta, b.due_date),
          'sent', coalesce(b.client_proposals -> c.id::text ->> 'status', '') in ('Sent','Awarded','Lost') or b.status = 'Submitted',
          'sent_date', nullif(b.client_proposals -> c.id::text ->> 'sent_date', ''),
          'awarded_to_you', b.status = 'Awarded' and b.awarded_client_id = c.id,
          'addenda', coalesce((select jsonb_agg(jsonb_build_object('number', a.value -> 'number', 'date', a.value ->> 'date',
                         'acknowledged', coalesce((a.value ->> 'acknowledged')::boolean, false)) order by (a.value ->> 'number')::numeric nulls last)
                       from jsonb_array_elements(case when jsonb_typeof(b.addenda) = 'array' then b.addenda else '[]'::jsonb end) a
                       where a.value ->> 'number' ~ '^[0-9.]+$'), '[]'::jsonb),
          'estimator', (select jsonb_build_object('name', e.name, 'title', e.title, 'email', e.email, 'phone', e.phone)
                        from public.estimators e where e.id = b.lead_estimator_id)
        ) as j
      from public.bids b
      where c.id = any(b.client_ids) and b.archived_at is null
        and (b.status not in ('Awarded','Not Awarded','No Bid') or b.updated_at > now() - interval '90 days')
    ) x), '[]'::jsonb));
end $$;
revoke all on function public.client_tracker(text) from public;
grant execute on function public.client_tracker(text) to anon, authenticated;
-- =====================================================================
-- Update 29: New pipeline stages
--   Project Created → RFQ Sent → Takeoff → Quotes Received → Estimating
--   → Proposal Review → Submitted, then Awarded / Not Awarded / No Bid
--   (On Hold at any point).
--   Existing bids move over: Not Started → Project Created,
--   Takeoff Complete → Estimating. Everything else keeps its stage.
-- Run AFTER update-28-client-tracker.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- ▶ Run this FIRST, then upload the new app.js right away.
-- =====================================================================
do $$
declare r record;
begin
  for r in select conname from pg_constraint
           where conrelid = 'public.bids'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%No Bid%' loop
    execute format('alter table public.bids drop constraint %I', r.conname);
  end loop;
end $$;

update public.bids set status = 'Project Created' where status = 'Not Started';
update public.bids set status = 'Estimating'      where status = 'Takeoff Complete';

alter table public.bids alter column status set default 'Project Created';
-- the two old names stay allowed so nothing breaks in the minutes between running this and uploading the new app
alter table public.bids add constraint bids_status_check check (status in (
  'Project Created','RFQ Sent','Takeoff','Quotes Received','Estimating','Proposal Review','Submitted','On Hold',
  'Awarded','Not Awarded','No Bid','Not Started','Takeoff Complete'));
-- =====================================================================
-- Update 30: GC follow-ups, and a tidier client tracker
--   • bids.follow_plan: each bid's follow-up plan after the proposal goes
--     out (days between follow-ups, how many, the Teams/Zoom meeting and
--     what was learned). Reminders show inside the app.
--   • client tracker: a bid comes off the client's page as soon as it is
--     Awarded, Not Awarded or No Bid.
-- Run AFTER update-29-pipeline-stages.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================
alter table public.bids add column if not exists follow_plan jsonb not null default '{}'::jsonb;

-- Public. Returns only what a client may see, for the one client the link belongs to.
create or replace function public.client_tracker(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c record;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select id, company into c from public.clients where track_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object('client', c.company, 'as_of', now(), 'bids', coalesce((
    select jsonb_agg(x.j order by x.decided, x.due nulls last, x.name) from (
      select b.name, b.due_date as due, (b.status in ('Awarded','Not Awarded','No Bid')) as decided,
        jsonb_build_object(
          'name', b.name, 'location', b.location, 'status', b.status,
          'received', b.created_at::date, 'due_date', b.due_date, 'due_time', b.due_time,
          'proposal_eta', coalesce(b.proposal_eta, b.due_date),
          'sent', coalesce(b.client_proposals -> c.id::text ->> 'status', '') in ('Sent','Awarded','Lost') or b.status = 'Submitted',
          'sent_date', nullif(b.client_proposals -> c.id::text ->> 'sent_date', ''),
          'awarded_to_you', b.status = 'Awarded' and b.awarded_client_id = c.id,
          'addenda', coalesce((select jsonb_agg(jsonb_build_object('number', a.value -> 'number', 'date', a.value ->> 'date',
                         'acknowledged', coalesce((a.value ->> 'acknowledged')::boolean, false)) order by (a.value ->> 'number')::numeric nulls last)
                       from jsonb_array_elements(case when jsonb_typeof(b.addenda) = 'array' then b.addenda else '[]'::jsonb end) a
                       where a.value ->> 'number' ~ '^[0-9.]+$'), '[]'::jsonb),
          'estimator', (select jsonb_build_object('name', e.name, 'title', e.title, 'email', e.email, 'phone', e.phone)
                        from public.estimators e where e.id = b.lead_estimator_id)
        ) as j
      from public.bids b
      where c.id = any(b.client_ids) and b.archived_at is null
        and b.status not in ('Awarded','Not Awarded','No Bid')   -- once it's decided it comes off the client's page
    ) x), '[]'::jsonb));
end $$;
revoke all on function public.client_tracker(text) from public;
grant execute on function public.client_tracker(text) to anon, authenticated;
-- =====================================================================
-- Update 31: The lead estimator can approve requests to join their bid
--   Before: only people who manage all bids could approve.
--   Now:    the bid's lead estimator can too (and can see those requests).
-- Run AFTER update-30-follow-ups.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================
create or replace function public.is_bid_lead(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_estimator_id() is not null
     and exists (select 1 from public.bids x where x.id = b and x.lead_estimator_id = public.my_estimator_id())
$$;
grant execute on function public.is_bid_lead(uuid) to authenticated;

-- the lead sees requests for their bids
drop policy if exists "bidreq read" on public.bid_requests;
create policy "bidreq read" on public.bid_requests for select to authenticated
  using (user_id = auth.uid() or (public.can_edit('bids') and public.perm('bids_scope') = 'all') or public.is_bid_lead(bid_id));

-- assignments are still locked for everyone else; approving a request is the one way a lead adds someone
create or replace function public.guard_bid_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  if not (public.can_edit('bids') and public.perm('bids_scope') = 'all')
     and coalesce(current_setting('app.approving_request', true), '') <> '1' then
    if new.lead_estimator_id is distinct from old.lead_estimator_id
       or new.support_estimator_ids is distinct from old.support_estimator_ids then
      raise exception 'Only someone who manages all bids can change estimator assignments';
    end if;
  end if;
  for e in select value from jsonb_array_elements(coalesce(new.scope_items, '[]'::jsonb)) loop
    if coalesce(e->>'signed_by_user', '') <> '' and not exists (
         select 1 from jsonb_array_elements(coalesce(old.scope_items, '[]'::jsonb)) o
         where o.value->>'id' = e->>'id'
           and o.value->>'signed_by_user' = e->>'signed_by_user'
           and o.value->>'signed_at' is not distinct from e->>'signed_at') then
      if e->>'signed_by_user' <> auth.uid()::text then
        raise exception 'A scope can only be signed off by the person who is signed in';
      end if;
    end if;
  end loop;
  return new;
end $$;

create or replace function public.decide_bid_request(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.bid_requests%rowtype; v_name text;
begin
  select * into r from public.bid_requests where id = p_id;
  if not found then raise exception 'That request is gone'; end if;
  if not ((public.can_edit('bids') and public.perm('bids_scope') = 'all') or (public.can_edit('bids') and public.is_bid_lead(r.bid_id))) then
    raise exception 'Only the lead estimator or someone who manages all bids can decide this';
  end if;
  if r.status <> 'Pending' then raise exception 'That request was already decided'; end if;
  if p_ok and r.estimator_id is not null then
    perform set_config('app.approving_request', '1', true);
    update public.bids set support_estimator_ids = array_append(support_estimator_ids, r.estimator_id)
     where id = r.bid_id and lead_estimator_id is distinct from r.estimator_id and not (r.estimator_id = any(support_estimator_ids));
    perform set_config('app.approving_request', '', true);
  end if;
  select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where id = auth.uid();
  update public.bid_requests set status = case when p_ok then 'Approved' else 'Denied' end,
         decided_by_name = coalesce(v_name, ''), decided_at = now() where id = p_id;
end $$;
revoke all on function public.decide_bid_request(uuid, boolean) from public;
grant execute on function public.decide_bid_request(uuid, boolean) to authenticated;
-- =====================================================================
-- Update 32: Feedback mode
--   feature_reviews: one rating (1–5) and comment per person per feature,
--   written as people use the app with Feedback mode switched on.
--   Each person sees and changes only their own; the developer sees all.
--   (Guide mode needs nothing in the database.)
-- Run AFTER update-31-lead-approves-requests.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================
create table if not exists public.feature_reviews (
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  feature    text not null,                         -- e.g. estimate:quotes, modal:bid
  label      text not null default '',
  area       text not null default '',
  rating     smallint not null check (rating between 1 and 5),
  comment    text not null default '',
  user_name  text not null default '',
  user_role  text not null default '',
  context    jsonb not null default '{}'::jsonb,    -- app build, screen size
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature)
);
alter table public.feature_reviews enable row level security;
drop policy if exists "review read"   on public.feature_reviews;
drop policy if exists "review insert" on public.feature_reviews;
drop policy if exists "review update" on public.feature_reviews;
drop policy if exists "review delete" on public.feature_reviews;
create policy "review read"   on public.feature_reviews for select to authenticated
  using (user_id = auth.uid() or public.is_dev());
create policy "review insert" on public.feature_reviews for insert to authenticated
  with check (user_id = auth.uid() and public.app_role() <> 'pending' and length(comment) <= 2000);
create policy "review update" on public.feature_reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and length(comment) <= 2000);
create policy "review delete" on public.feature_reviews for delete to authenticated
  using (user_id = auth.uid() or public.is_dev());
-- =====================================================================
-- Update 33: Import takeoff — remembered matches
--   takeoff_map: which codebook bid item(s) each takeoff name or code
--   goes to, with a factor. Shared by the whole company, so a match made
--   on one job is already made on the next.
-- Run AFTER update-32-guide-feedback-modes.sql. Run once in Supabase:
-- SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================
create table if not exists public.takeoff_map (
  key             text primary key,                    -- the takeoff code or name, lower-case letters and digits only
  label           text not null default '',            -- as it appears in the takeoff
  code            text not null default '',
  unit            text not null default '',
  targets         jsonb not null default '[]'::jsonb,  -- [{cb: codebook bid item id, f: factor}]
  skip            boolean not null default false,      -- "never import this line"
  updated_at      timestamptz not null default now(),
  updated_by_name text not null default ''
);
alter table public.takeoff_map enable row level security;
drop policy if exists "tkomap read"  on public.takeoff_map;
drop policy if exists "tkomap write" on public.takeoff_map;
create policy "tkomap read"  on public.takeoff_map for select to authenticated
  using (public.can_view('estimates'));
create policy "tkomap write" on public.takeoff_map for all to authenticated
  using (public.can_edit('estimates')) with check (public.can_edit('estimates'));
-- update-34: takeoff workspace. A takeoff belongs to a bid (one per bid), or stands on its own
-- (made from the Calculators tab) and belongs to the person who made it. It holds each sheet's scale and
-- alignment, its surfaces and everything picked or drawn on them. The plan PDF stays on each person's
-- computer (too big to keep here); the takeoff remembers its file name and size and asks for it elsewhere.
-- Safe to run more than once.

create table if not exists public.takeoffs (
  id               uuid primary key default gen_random_uuid(),
  bid_id           uuid unique references public.bids(id) on delete cascade,   -- null = a stand-alone takeoff
  name             text not null default '',
  owner            uuid references auth.users(id) on delete cascade default auth.uid(),
  data             jsonb not null default '{}'::jsonb,
  version          integer not null default 1,
  updated_by_name  text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references auth.users(id) on delete set null default auth.uid()
);
-- if an earlier copy of this update was run, bring the table up to date
alter table public.takeoffs alter column bid_id drop not null;
alter table public.takeoffs add column if not exists name  text not null default '';
alter table public.takeoffs add column if not exists owner uuid references auth.users(id) on delete cascade default auth.uid();

drop trigger if exists touch_takeoffs on public.takeoffs;
create trigger touch_takeoffs before update on public.takeoffs
  for each row execute function public.touch_updated_at();

alter table public.takeoffs enable row level security;
drop policy if exists "takeoffs read"   on public.takeoffs;
drop policy if exists "takeoffs insert" on public.takeoffs;
drop policy if exists "takeoffs update" on public.takeoffs;
drop policy if exists "takeoffs delete" on public.takeoffs;
-- a bid's takeoff follows the estimate's rules: see the bid to see it, work the bid to edit it.
-- a stand-alone takeoff is its owner's (admins can see and clear them too).
create policy "takeoffs read" on public.takeoffs for select to authenticated using (
  case when bid_id is null then owner = auth.uid() or public.is_admin() else public.can_see_bid(bid_id) end);
create policy "takeoffs insert" on public.takeoffs for insert to authenticated with check (
  case when bid_id is null then owner = auth.uid() else public.can_work_bid(bid_id) end);
create policy "takeoffs update" on public.takeoffs for update to authenticated
  using (case when bid_id is null then owner = auth.uid() else public.can_work_bid(bid_id) end)
  with check (case when bid_id is null then owner = auth.uid() else public.can_work_bid(bid_id) end);
create policy "takeoffs delete" on public.takeoffs for delete to authenticated using (
  public.is_admin() or (bid_id is null and owner = auth.uid()));

grant select, insert, update, delete on public.takeoffs to authenticated;

-- update-35: "last seen" for the who's-online list. Who's on right now needs no table: it uses Supabase
-- Realtime presence. This table only remembers when each person was last on and what they were looking at,
-- so the list can show "Recently: Pat, 2 h ago". Each person writes only their own row; everyone with
-- access (not people still waiting for access) can read them. Safe to run more than once.

create table if not exists public.last_seen (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  name     text not null default '',
  role     text not null default '',
  area     text not null default '',
  seen_at  timestamptz not null default now()
);

alter table public.last_seen enable row level security;

drop policy if exists "last_seen read" on public.last_seen;
create policy "last_seen read" on public.last_seen for select to authenticated
  using (public.app_role() <> 'pending');

drop policy if exists "last_seen write own" on public.last_seen;
create policy "last_seen write own" on public.last_seen for insert to authenticated
  with check (user_id = auth.uid() and public.app_role() <> 'pending');

drop policy if exists "last_seen update own" on public.last_seen;
create policy "last_seen update own" on public.last_seen for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.last_seen to authenticated;

-- update-36: Planner. Everyone gets their own to-do list and calendar, plus a team board.
-- A task is private to the person who made it (and whoever it's assigned to) until it's shared; a shared task
-- shows on the team board and calendar for everyone with access, and anyone can move it along. Only the
-- person who made a task (or an admin) can delete it, and only they can take it off the team board.
-- Safe to run more than once.

create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  owner            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  owner_name       text not null default '',
  assignee         uuid references auth.users(id) on delete set null,
  assignee_name    text not null default '',
  title            text not null default '',
  notes            text not null default '',
  status           text not null default 'todo' check (status in ('todo','doing','done')),
  priority         smallint not null default 0,
  due_date         date,
  due_time         text not null default '',
  shared           boolean not null default false,
  bid_id           uuid references public.bids(id) on delete set null,
  job_id           uuid references public.jobs(id) on delete set null,
  list             text not null default '',
  repeat           text not null default '',
  checklist        jsonb not null default '[]'::jsonb,
  sort             double precision not null default 0,
  done_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by_name  text not null default ''
);
create index if not exists tasks_owner_idx on public.tasks(owner);
create index if not exists tasks_assignee_idx on public.tasks(assignee);
create index if not exists tasks_shared_idx on public.tasks(shared) where shared;
create index if not exists tasks_due_idx on public.tasks(due_date);

alter table public.tasks enable row level security;

drop policy if exists "tasks read" on public.tasks;
create policy "tasks read" on public.tasks for select to authenticated
  using (owner = auth.uid() or assignee = auth.uid() or (shared and public.app_role() <> 'pending'));

drop policy if exists "tasks add" on public.tasks;
create policy "tasks add" on public.tasks for insert to authenticated
  with check (owner = auth.uid() and public.app_role() <> 'pending');

-- the owner and the assignee can change a task; anyone can move a shared one along, but it has to stay shared
-- unless they made it
drop policy if exists "tasks change" on public.tasks;
create policy "tasks change" on public.tasks for update to authenticated
  using (owner = auth.uid() or assignee = auth.uid() or (shared and public.app_role() <> 'pending'))
  with check (owner = auth.uid() or assignee = auth.uid() or shared);

drop policy if exists "tasks delete" on public.tasks;
create policy "tasks delete" on public.tasks for delete to authenticated
  using (owner = auth.uid() or public.is_admin());

-- nobody can hand a task to a different owner
create or replace function public.tasks_keep_owner() returns trigger language plpgsql as $$
begin
  if new.owner is distinct from old.owner then new.owner := old.owner; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists tasks_keep_owner on public.tasks;
create trigger tasks_keep_owner before update on public.tasks for each row execute function public.tasks_keep_owner();

grant select, insert, update, delete on public.tasks to authenticated;

-- live updates: a shared task moved on one screen moves on everyone's
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- update-37: vendor rankings, price lists and vendor update links.
--   • vendors.regions / vendors.base   service regions (tags) and home base
--   • vendor_ratings     team members rate a vendor 1–5 on price, quality, communication, schedule
--   • vendor_prices      each vendor's price list (materials for suppliers, services for subs)
--   • vendor_price_log   every price change, so trends can be seen later
--   • vendor_links       private links a vendor uses to update their own prices (no login)
--   • vendor_portal() / vendor_portal_save()   what that link can read and write, for that one vendor only
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.

alter table public.vendors add column if not exists regions jsonb not null default '[]'::jsonb;
alter table public.vendors add column if not exists base text not null default '';

-- ratings ------------------------------------------------------------------------------------
create table if not exists public.vendor_ratings (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.vendors(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_name  text not null default '',
  bid_id     uuid references public.bids(id) on delete set null,
  price      smallint check (price between 1 and 5),
  quality    smallint check (quality between 1 and 5),
  comm       smallint check (comm between 1 and 5),
  schedule   smallint check (schedule between 1 and 5),
  again      boolean,
  comment    text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists vendor_ratings_vendor_idx on public.vendor_ratings(vendor_id);
alter table public.vendor_ratings enable row level security;
drop policy if exists "vr read" on public.vendor_ratings;
create policy "vr read" on public.vendor_ratings for select to authenticated using (public.app_role() <> 'pending');
drop policy if exists "vr add" on public.vendor_ratings;
create policy "vr add" on public.vendor_ratings for insert to authenticated with check (user_id = auth.uid() and public.app_role() <> 'pending');
drop policy if exists "vr change" on public.vendor_ratings;
create policy "vr change" on public.vendor_ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "vr delete" on public.vendor_ratings;
create policy "vr delete" on public.vendor_ratings for delete to authenticated using (user_id = auth.uid() or public.is_admin());
grant select, insert, update, delete on public.vendor_ratings to authenticated;

-- price lists ----------------------------------------------------------------------------------
create table if not exists public.vendor_prices (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references public.vendors(id) on delete cascade,
  kind            text not null default 'material' check (kind in ('material','service')),
  item            text not null default '',
  spec            text not null default '',
  unit            text not null default '',
  price           numeric(14,4),
  lead            text not null default '',
  notes           text not null default '',
  sort            double precision not null default 0,
  source          text not null default 'team' check (source in ('team','vendor')),
  updated_at      timestamptz not null default now(),
  updated_by_name text not null default ''
);
create index if not exists vendor_prices_vendor_idx on public.vendor_prices(vendor_id);
alter table public.vendor_prices enable row level security;
drop policy if exists "vp read" on public.vendor_prices;
create policy "vp read" on public.vendor_prices for select to authenticated using (public.app_role() <> 'pending');
drop policy if exists "vp write" on public.vendor_prices;
create policy "vp write" on public.vendor_prices for all to authenticated using (public.can_edit('contacts')) with check (public.can_edit('contacts'));
grant select, insert, update, delete on public.vendor_prices to authenticated;

create table if not exists public.vendor_price_log (
  id         bigint generated always as identity primary key,
  vendor_id  uuid not null references public.vendors(id) on delete cascade,
  price_id   uuid,
  item       text not null default '',
  unit       text not null default '',
  old_price  numeric(14,4),
  new_price  numeric(14,4),
  by_name    text not null default '',
  source     text not null default 'team',
  at         timestamptz not null default now()
);
create index if not exists vendor_price_log_vendor_idx on public.vendor_price_log(vendor_id, at desc);
alter table public.vendor_price_log enable row level security;
drop policy if exists "vpl read" on public.vendor_price_log;
create policy "vpl read" on public.vendor_price_log for select to authenticated using (public.app_role() <> 'pending');
drop policy if exists "vpl delete" on public.vendor_price_log;
create policy "vpl delete" on public.vendor_price_log for delete to authenticated using (public.can_edit('contacts'));
grant select, delete on public.vendor_price_log to authenticated;

create or replace function public.vendor_prices_track() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.price is not null then
      insert into public.vendor_price_log(vendor_id, price_id, item, unit, old_price, new_price, by_name, source)
      values (new.vendor_id, new.id, new.item, new.unit, null, new.price, new.updated_by_name, new.source);
    end if;
  elsif new.price is distinct from old.price then
    insert into public.vendor_price_log(vendor_id, price_id, item, unit, old_price, new_price, by_name, source)
    values (new.vendor_id, new.id, new.item, new.unit, old.price, new.price, new.updated_by_name, new.source);
  end if;
  return new;
end $$;
drop trigger if exists vendor_prices_track on public.vendor_prices;
create trigger vendor_prices_track after insert or update on public.vendor_prices for each row execute function public.vendor_prices_track();

-- links a vendor uses to update their own prices --------------------------------------------------
create table if not exists public.vendor_links (
  token        text primary key,
  vendor_id    uuid not null references public.vendors(id) on delete cascade,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_name text not null default '',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '60 days',
  revoked      boolean not null default false,
  last_used_at timestamptz,
  saves        integer not null default 0
);
create index if not exists vendor_links_vendor_idx on public.vendor_links(vendor_id);
alter table public.vendor_links enable row level security;
drop policy if exists "vl read" on public.vendor_links;
create policy "vl read" on public.vendor_links for select to authenticated using (public.can_edit('contacts'));
drop policy if exists "vl write" on public.vendor_links;
create policy "vl write" on public.vendor_links for all to authenticated using (public.can_edit('contacts')) with check (public.can_edit('contacts'));
grant select, insert, update, delete on public.vendor_links to authenticated;

-- Public: what one link may see. Only that vendor's company name, contact and price list.
create or replace function public.vendor_portal(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l record; v record;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select * into l from public.vendor_links where token = p_token and not revoked and expires_at > now();
  if not found then return null; end if;
  select id, company, contact_name, vendor_type into v from public.vendors where id = l.vendor_id;
  if not found then return null; end if;
  update public.vendor_links set last_used_at = now() where token = p_token;
  return jsonb_build_object(
    'vendor', v.company, 'contact', v.contact_name, 'type', v.vendor_type, 'expires', l.expires_at,
    'company', coalesce((select value ->> 'companyName' from public.settings where key = 'general'), ''),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'item', p.item, 'spec', p.spec, 'unit', p.unit,
                 'price', p.price, 'lead', p.lead, 'notes', p.notes, 'updated_at', p.updated_at) order by p.kind, p.sort, p.item)
               from public.vendor_prices p where p.vendor_id = v.id), '[]'::jsonb));
end $$;
revoke all on function public.vendor_portal(text) from public;
grant execute on function public.vendor_portal(text) to anon, authenticated;

-- Public: save from the vendor's page. Rows they send replace what's there; rows they leave out are removed.
create or replace function public.vendor_portal_save(p_token text, p_items jsonb, p_name text default '') returns integer
language plpgsql security definer set search_path = public as $$
declare l record; it jsonb; n integer := 0; keep uuid[] := '{}'; pid uuid; who text;
begin
  if p_token is null or length(p_token) < 32 then raise exception 'This link isn''t active'; end if;
  select * into l from public.vendor_links where token = p_token and not revoked and expires_at > now();
  if not found then raise exception 'This link isn''t active'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 1000 then raise exception 'Too many rows'; end if;
  who := left(coalesce(nullif(trim(p_name), ''), (select contact_name from public.vendors where id = l.vendor_id), 'Vendor'), 80);
  for it in select * from jsonb_array_elements(p_items) loop
    if coalesce(trim(it ->> 'item'), '') = '' then continue; end if;
    pid := null;
    if (it ->> 'id') ~ '^[0-9a-f-]{36}$' then
      update public.vendor_prices set
        kind = case when it ->> 'kind' in ('material','service') then it ->> 'kind' else kind end,
        item = left(it ->> 'item', 200), spec = left(coalesce(it ->> 'spec', ''), 200), unit = left(coalesce(it ->> 'unit', ''), 20),
        price = nullif(regexp_replace(coalesce(it ->> 'price', ''), '[^0-9.]', '', 'g'), '')::numeric,
        lead = left(coalesce(it ->> 'lead', ''), 80), notes = left(coalesce(it ->> 'notes', ''), 300),
        sort = coalesce((it ->> 'sort')::double precision, sort),
        source = 'vendor', updated_at = now(), updated_by_name = who
      where id = (it ->> 'id')::uuid and vendor_id = l.vendor_id
      returning id into pid;
    end if;
    if pid is null then
      insert into public.vendor_prices(vendor_id, kind, item, spec, unit, price, lead, notes, sort, source, updated_by_name)
      values (l.vendor_id, case when it ->> 'kind' in ('material','service') then it ->> 'kind' else 'material' end,
        left(it ->> 'item', 200), left(coalesce(it ->> 'spec', ''), 200), left(coalesce(it ->> 'unit', ''), 20),
        nullif(regexp_replace(coalesce(it ->> 'price', ''), '[^0-9.]', '', 'g'), '')::numeric,
        left(coalesce(it ->> 'lead', ''), 80), left(coalesce(it ->> 'notes', ''), 300), coalesce((it ->> 'sort')::double precision, n), 'vendor', who)
      returning id into pid;
    end if;
    keep := keep || pid; n := n + 1;
  end loop;
  delete from public.vendor_prices where vendor_id = l.vendor_id and not (id = any(keep));
  update public.vendor_links set last_used_at = now(), saves = saves + 1 where token = p_token;
  return n;
end $$;
revoke all on function public.vendor_portal_save(text, jsonb, text) from public;
grant execute on function public.vendor_portal_save(text, jsonb, text) to anon, authenticated;

-- live updates
do $$ begin
  begin alter publication supabase_realtime add table public.vendor_prices; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.vendor_ratings; exception when duplicate_object then null; when undefined_object then null; end;
end $$;

-- update-39: RFQ details on each bid (quotes due date and time, plans link, engineer, anticipated start, note).
-- Used by the RFQ email on the bid's Scopes & RFQs tab. Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run. Until it's run, the app keeps these details in each person's browser.
alter table public.bids add column if not exists rfq jsonb not null default '{}'::jsonb;
