create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'teacher',
  created_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('teacher', 'admin'))
);

alter table public.profiles add column if not exists role text not null default 'teacher';
alter table public.profiles enable row level security;

-- Keep role records private to their owner. Administrative reads and writes are
-- performed by the protected Edge Function using the server-side service key.
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant usage on schema public to authenticated;

create or replace function public.create_teacher_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'teacher')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_teacher_profile_after_signup on auth.users;
create trigger create_teacher_profile_after_signup
after insert on auth.users
for each row execute function public.create_teacher_profile();

-- Backfill accounts created before the profile trigger was installed. Do not
-- overwrite any roles that have already been assigned.
insert into public.profiles (id, role)
select id, 'teacher' from auth.users
on conflict (id) do nothing;
