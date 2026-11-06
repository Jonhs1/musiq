-- Exercícios da comunidade: colunas, tabelas de interação e regra de visibilidade

alter table public.exercises
  add column visibility text not null default 'public' check (visibility in ('private', 'friends', 'public')),
  add column likes_count integer not null default 0 check (likes_count >= 0),
  add column reports_count integer not null default 0 check (reports_count >= 0),
  add column hidden boolean not null default false,
  add column deleted_at timestamptz;

create index exercises_community_idx on public.exercises (instrument_id, visibility, likes_count desc)
  where created_by is not null and deleted_at is null;

create table public.exercise_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
create index exercise_likes_exercise_idx on public.exercise_likes (exercise_id);

create table public.exercise_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
create index exercise_favorites_exercise_idx on public.exercise_favorites (exercise_id);

create table public.exercise_reports (
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
create index exercise_reports_exercise_idx on public.exercise_reports (exercise_id);

-- RLS ligada e sem policies: acesso somente pelas funções
alter table public.exercise_likes enable row level security;
alter table public.exercise_favorites enable row level security;
alter table public.exercise_reports enable row level security;

-- Regra única de quem pode ver um exercício
create or replace function public.can_see_exercise(p_exercise public.exercises, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_exercise.deleted_at is null
    and (
      p_exercise.created_by is null
      or p_exercise.created_by = p_user
      or (
        not p_exercise.hidden
        and (
          p_exercise.visibility = 'public'
          or (p_exercise.visibility = 'friends' and p_user is not null
              and public.are_friends(p_user, p_exercise.created_by))
        )
      )
    );
$$;

-- Escrita direta fica fechada: só as funções (Task 3) escrevem em exercises
drop policy if exists "exercises: ler do sistema e próprios" on public.exercises;
drop policy if exists "exercises: criar próprios" on public.exercises;
drop policy if exists "exercises: atualizar próprios" on public.exercises;
drop policy if exists "exercises: apagar próprios" on public.exercises;

create policy "exercises: leitura" on public.exercises
  for select to authenticated
  using (public.can_see_exercise(exercises, (select auth.uid())));

revoke execute on function public.can_see_exercise(public.exercises, uuid) from public, anon;
grant execute on function public.can_see_exercise(public.exercises, uuid) to authenticated;
