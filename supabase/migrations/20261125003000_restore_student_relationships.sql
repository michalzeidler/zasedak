-- The composite student/class foreign keys introduce multiple PostgREST relationships
-- from classes to students, breaking existing embeds such as students(count).
-- Replace them with simple student foreign keys and enforce same-class membership
-- in a trigger so the old embeds keep working without weakening data integrity.
alter table public.student_seating_exclusions
  drop constraint if exists student_seating_exclusions_student_same_class_fk,
  drop constraint if exists student_seating_exclusions_excluded_same_class_fk;

alter table public.student_seating_exclusions
  add constraint student_seating_exclusions_student_fk
    foreign key (student_id) references public.students(id) on delete cascade,
  add constraint student_seating_exclusions_excluded_student_fk
    foreign key (excluded_student_id) references public.students(id) on delete cascade;

create or replace function public.validate_student_seating_exclusion_class()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  student_class_id uuid;
  excluded_class_id uuid;
begin
  select class_id into student_class_id
    from public.students where id = new.student_id;
  select class_id into excluded_class_id
    from public.students where id = new.excluded_student_id;

  if student_class_id is null or excluded_class_id is null
     or student_class_id <> new.class_id
     or excluded_class_id <> new.class_id then
    raise exception 'Both students must belong to the selected class.'
      using errcode = '23514';
  end if;
  if new.student_id = new.excluded_student_id then
    raise exception 'A student cannot be excluded from sitting with themselves.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

 drop trigger if exists validate_student_seating_exclusion_class
   on public.student_seating_exclusions;
create trigger validate_student_seating_exclusion_class
  before insert or update on public.student_seating_exclusions
  for each row execute function public.validate_student_seating_exclusion_class();
