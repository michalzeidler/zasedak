create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'teacher',
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('teacher', 'admin'))
);
alter table public.profiles add column if not exists role text not null default 'teacher';
alter table public.profiles enable row level security;
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grants:;