-- Supabase SQL Editor: run this once in your project before using the website.
-- Each signed-in account owns its own classes; RLS prevents cross-account access.

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  rows integer not null default 4 check (rows between 1 and 8),
  desks_per_row integer not null default 5 check (desks_per_row between 1 and 8),
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  seat_index integer check (seat_index is null or seat_index >= 0),
  sort_order integer not null default 0
);

create table if not exists public.student_seating_exclusions (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  excluded_student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id, excluded_student_id),
  constraint student_seating_exclusions_not_self check (student_id <> excluded_student_id)
);

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_seating_exclusions enable row level security;

drop policy if exists "Users manage their own classes" on public.classes;
create policy "Users manage their own classes" on public.classes for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

drop policy if exists "Users manage students in their own classes" on public.students;
create policy "Users manage students in their own classes" on public.students for all to authenticated using (exists(select 1 from public.classes c where c.id=students.class_id and c.user_id=(select auth.uid()))) with check (exists(select 1 from public.classes c where c.id=students.class_id and c.user_id=(select auth.uid())));

drop policy if exists "Users manage seating exclusions in their own classes" on public.student_seating_exclusions;
create policy "Users manage seating exclusions in their own classes" on public.student_seating_exclusions for all to authenticated using (exists(select 1 from public.classes c where c.id=student_seating_exclusions.class_id and c.user_id=(select auth.uid()))) with check (exists(select 1 from public.classes c where c.id=student_seating_exclusions.class_id and c.user_id=(select auth.uid())));

grants begin; grant usage on schema public to authenticated; grant select, insert, update, delete on public.classes, public.students to authenticated; grant select, insert, delete on public.student_seating_exclusions to authenticated;
