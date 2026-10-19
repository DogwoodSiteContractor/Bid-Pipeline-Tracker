-- update-39: RFQ details on each bid (quotes due date and time, plans link, engineer, anticipated start, note).
-- Used by the RFQ email on the bid's Scopes & RFQs tab. Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run. Until it's run, the app keeps these details in each person's browser.
alter table public.bids add column if not exists rfq jsonb not null default '{}'::jsonb;
