-- update-63: Notifications panel (personal + team summaries)
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- Summaries are written by the scheduled Claude task (service role).
-- Everyone reads the team summaries (if they can see bids); each person reads only their own personal summaries.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('team','personal')),
  user_id     uuid references auth.users(id) on delete cascade,   -- set for personal, null for team
  title       text not null default '',
  body        text not null default '',                          -- light markdown: ## heading, - bullets, **bold**
  for_date    date not null default current_date,
  source      text not null default 'claude',
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint notifications_personal_has_user check (kind = 'team' or user_id is not null)
);
create index if not exists notifications_recent on public.notifications (created_at desc);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications read" on public.notifications;
create policy "notifications read" on public.notifications for select using (
  (kind = 'personal' and user_id = auth.uid())
  or (kind = 'team' and (app_role() in ('admin','executive','estimator','board') or is_dev()))
);

-- admins can post or remove team notes by hand; people can clear their own personal ones
drop policy if exists "notifications add" on public.notifications;
create policy "notifications add" on public.notifications for insert with check (
  is_admin() and created_by = auth.uid()
);
drop policy if exists "notifications delete" on public.notifications;
create policy "notifications delete" on public.notifications for delete using (
  is_admin() or (kind = 'personal' and user_id = auth.uid())
);

-- live updates in the app
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
