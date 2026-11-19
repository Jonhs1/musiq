-- Área Treino, Etapa 1: metas de BPM e de constância.
-- Progresso é sempre derivado de practice_sessions; nada de progresso digitado.
-- Fuso de todos os dias: America/Sao_Paulo. Semana começa na segunda.

create table public.training_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  kind text not null check (kind in ('bpm', 'consistency')),
  start_bpm smallint,
  target_bpm smallint,
  days_per_week smallint,
  status text not null default 'active' check (status in ('active', 'done', 'archived')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint training_goals_shape_chk check (
    (kind = 'bpm'
      and start_bpm between 20 and 400
      and target_bpm between 20 and 400
      and target_bpm > start_bpm
      and days_per_week is null)
    or
    (kind = 'consistency'
      and days_per_week between 1 and 7
      and start_bpm is null
      and target_bpm is null)
  )
);

create index training_goals_user_status_idx on public.training_goals (user_id, status);
create index training_goals_exercise_idx on public.training_goals (exercise_id);
create unique index training_goals_one_active_idx
  on public.training_goals (user_id, exercise_id, kind) where status = 'active';

alter table public.training_goals enable row level security;

-- Leitura só das próprias metas. Escrita só por RPC.
create policy training_goals_select_own on public.training_goals
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.training_goals from anon, public;
revoke insert, update, delete, truncate on public.training_goals from authenticated;
grant select on public.training_goals to authenticated;

-- Cria uma meta ativa. Erros: exercicio_invalido, meta_invalida, limite_de_metas, meta_duplicada.
create or replace function public.create_training_goal(
  p_exercise uuid,
  p_kind text,
  p_start_bpm int default null,
  p_target_bpm int default null,
  p_days_per_week int default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  ex public.exercises;
  active_count int;
  new_id uuid;
begin
  if uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  select * into ex from public.exercises where id = p_exercise;
  if not found or ex.deleted_at is not null or not public.can_see_exercise(ex, uid) then
    raise exception 'exercicio_invalido';
  end if;

  if p_kind = 'bpm' then
    if p_start_bpm is null or p_target_bpm is null or p_days_per_week is not null
       or p_start_bpm not between 20 and 400
       or p_target_bpm not between 20 and 400
       or p_target_bpm <= p_start_bpm then
      raise exception 'meta_invalida';
    end if;
  elsif p_kind = 'consistency' then
    if p_days_per_week is null or p_days_per_week not between 1 and 7
       or p_start_bpm is not null or p_target_bpm is not null then
      raise exception 'meta_invalida';
    end if;
  else
    raise exception 'meta_invalida';
  end if;

  select count(*) into active_count
    from public.training_goals tg
    where tg.user_id = uid and tg.status = 'active';
  if active_count >= 10 then
    raise exception 'limite_de_metas';
  end if;

  begin
    insert into public.training_goals (user_id, exercise_id, kind, start_bpm, target_bpm, days_per_week)
      values (uid, p_exercise, p_kind, p_start_bpm, p_target_bpm, p_days_per_week)
      returning id into new_id;
  exception when unique_violation then
    raise exception 'meta_duplicada';
  end;

  return new_id;
end;
$$;

-- Lista as metas do usuário (ativas e concluídas) com progresso calculado.
-- Antes de responder, marca como concluídas as metas de BPM que atingiram o alvo.
create or replace function public.get_my_training_goals()
returns table (
  goal_id uuid,
  exercise_id uuid,
  title text,
  instrument_id text,
  kind text,
  start_bpm smallint,
  target_bpm smallint,
  days_per_week smallint,
  status text,
  best_bpm smallint,
  days_done_week smallint,
  days_idle integer,
  ratio numeric,
  created_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  today_sp date := (now() at time zone 'America/Sao_Paulo')::date;
  week_start date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
begin
  if uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  -- conclusão automática de metas de BPM (escrita dentro da função definer)
  update public.training_goals tg
    set status = 'done', completed_at = now()
    where tg.user_id = uid
      and tg.status = 'active'
      and tg.kind = 'bpm'
      and tg.target_bpm <= greatest(
        tg.start_bpm,
        coalesce((
          select max(ps.bpm_max)
          from public.practice_sessions ps
          where ps.user_id = uid and ps.exercise_id = tg.exercise_id
        ), 0)
      );

  return query
  with goals as (
    select tg.id, tg.exercise_id, e.title, e.instrument_id, tg.kind, tg.start_bpm,
           tg.target_bpm, tg.days_per_week, tg.status, tg.created_at, tg.completed_at
    from public.training_goals tg
    join public.exercises e on e.id = tg.exercise_id
    where tg.user_id = uid
      and tg.status in ('active', 'done')
      and e.deleted_at is null
  ),
  stats as (
    select ps.exercise_id,
           max(ps.bpm_max) as max_bpm,
           count(distinct (ps.started_at at time zone 'America/Sao_Paulo')::date)
             filter (where (ps.started_at at time zone 'America/Sao_Paulo')::date >= week_start) as days_week,
           max((ps.started_at at time zone 'America/Sao_Paulo')::date) as last_day
    from public.practice_sessions ps
    where ps.user_id = uid
    group by ps.exercise_id
  ),
  calc as (
    select g.*,
           s.days_week,
           s.last_day,
           case when g.kind = 'bpm'
                then greatest(g.start_bpm, coalesce(s.max_bpm, g.start_bpm))
           end as best
    from goals g
    left join stats s on s.exercise_id = g.exercise_id
  )
  select c.id,
         c.exercise_id,
         c.title,
         c.instrument_id,
         c.kind,
         c.start_bpm,
         c.target_bpm,
         c.days_per_week,
         c.status,
         c.best::smallint,
         case when c.kind = 'consistency' then coalesce(c.days_week, 0)::smallint end,
         (today_sp - c.last_day)::integer,
         case when c.kind = 'bpm'
              then least(1::numeric, greatest(0::numeric,
                     (c.best - c.start_bpm)::numeric / (c.target_bpm - c.start_bpm)))
              else least(1::numeric, coalesce(c.days_week, 0)::numeric / c.days_per_week)
         end,
         c.created_at,
         c.completed_at
  from calc c
  order by (c.status = 'active') desc, c.created_at desc;
end;
$$;

-- Arquiva uma meta ativa do próprio usuário. Meta alheia: nenhum efeito, sem erro.
create or replace function public.archive_training_goal(p_goal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  update public.training_goals tg
    set status = 'archived'
    where tg.id = p_goal
      and tg.user_id = auth.uid()
      and tg.status = 'active';
end;
$$;

revoke execute on function public.create_training_goal(uuid, text, int, int, int) from public, anon;
revoke execute on function public.get_my_training_goals() from public, anon;
revoke execute on function public.archive_training_goal(uuid) from public, anon;
grant execute on function public.create_training_goal(uuid, text, int, int, int) to authenticated;
grant execute on function public.get_my_training_goals() to authenticated;
grant execute on function public.archive_training_goal(uuid) to authenticated;
