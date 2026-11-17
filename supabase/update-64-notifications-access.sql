-- update-64: choose which roles see the Notifications panel (Team → Access chart → Notifications panel)
-- Run once in the Supabase SQL Editor after update-63. Safe to re-run.
-- The setting lives in settings.key = 'notifications' as {"roles": ["admin","estimator", ...]}.

insert into public.settings (key, value)
values ('notifications', '{"roles": ["admin","estimator"]}'::jsonb)
on conflict (key) do nothing;

create or replace function public.notif_role_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_dev() or public.app_role() in (
    select jsonb_array_elements_text(coalesce(
      (select value->'roles' from public.settings where key = 'notifications'),
      '["admin","estimator"]'::jsonb)))
$$;

drop policy if exists "notifications read" on public.notifications;
create policy "notifications read" on public.notifications for select using (
  notif_role_ok() and (
    (kind = 'personal' and user_id = auth.uid())
    or kind = 'team'
  )
);
