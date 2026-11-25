-- Each exclusion is scoped to the same class as both students. RLS restricts access to the class owner.
create unique index if not exists students_id_class_id_unique
  on public.students (id, class_id);

create table if not exists public.student_seating_exclusions (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null,
  excluded_student_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id, excluded_student_id),
  constraint student_seating_exclusions_not_self check (student_id <> excluded_student_id),
  constraint student_seating_exclusions_student_same_class_fk
    foreign key (student_id, class_id) references public.students(id, class_id) on delete cascade,
  constraint student_seating_exclusions_excluded_same_class_fk
    foreign key (excluded_student_id, class_id) references public.students(id, class_id) on delete cascade
);

alter table public.student_seating_exclusions enable row level security;

drop policy if exists "Users manage seating exclusions in their own classes" on public.student_seating_exclusions;
create policy "Users manage seating exclusions in their own classes"
  on public.student_seating_exclusions
  for all to authenticated
  using (exists (
    select 1 from public.classes c
    where c.id = student_seating_exclusions.class_id
      and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.classes c
    where c.id = student_seating_exclusions.class_id
      and c.user_id = (select auth.uid())
  ));

grant select, insert, delete on public.student_seating_exclusions to authenticated;
