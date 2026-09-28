/*
  # Personal vault for cloud sync (v2)

  The app is now a single-user, local-first log. The browser keeps the data;
  this table is an optional cloud copy so the same log can be opened on
  several devices. One row per auth user, holding the whole document.
  `rev` is bumped on every write so two devices can't overwrite each other
  blindly (the client retries with a merge on conflict).

  The multi-user tables from v1 (profiles, claims, respects, badges, ...)
  are left untouched so nothing is lost. Settings → Sync in the app can copy
  the old `claims` rows into the new format once.

  Setup
  1. Run this file (SQL editor, or `supabase db push`).
  2. Authentication → Users → Add user: your own email + password.
  3. Authentication → Sign In / Providers: turn off "Allow new users to sign up".
*/

create table if not exists public.itys_vault (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  doc jsonb not null check (pg_column_size(doc) < 5242880),
  rev integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.itys_vault enable row level security;

drop policy if exists "Owner reads own vault" on public.itys_vault;
create policy "Owner reads own vault"
  on public.itys_vault for select
  to authenticated
  using ((select auth.uid()) = owner);

drop policy if exists "Owner creates own vault" on public.itys_vault;
create policy "Owner creates own vault"
  on public.itys_vault for insert
  to authenticated
  with check ((select auth.uid()) = owner);

drop policy if exists "Owner updates own vault" on public.itys_vault;
create policy "Owner updates own vault"
  on public.itys_vault for update
  to authenticated
  using ((select auth.uid()) = owner)
  with check ((select auth.uid()) = owner);

drop policy if exists "Owner deletes own vault" on public.itys_vault;
create policy "Owner deletes own vault"
  on public.itys_vault for delete
  to authenticated
  using ((select auth.uid()) = owner);
