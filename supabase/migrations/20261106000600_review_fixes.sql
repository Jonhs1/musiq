-- Correções da revisão final

-- 1) Plano: não mostrar exercícios que o usuário não pode mais ver (ocultos, apagados, privados de outros)
create or replace function public.get_my_weekly_plan(p_regenerate boolean default false)
returns table (
  item_id uuid, day_date date, slot smallint, instrument_id text, exercise_id uuid,
  title text, difficulty smallint, recommended_bpm smallint, minutes smallint, done boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_week_start date := date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date;
  v_plan uuid;
  v_goal integer;
begin
  if uid is null then
    return;
  end if;

  select pr.daily_goal_minutes into v_goal from public.profiles pr where pr.id = uid;

  select p.id into v_plan
  from public.weekly_plans p
  where p.user_id = uid and p.week_start = v_week_start;

  if v_plan is null then
    insert into public.weekly_plans (user_id, week_start, goal_minutes)
    values (uid, v_week_start, v_goal)
    on conflict (user_id, week_start) do nothing
    returning id into v_plan;

    if v_plan is not null then
      perform public.generate_plan_items(uid, v_plan, v_today, v_week_start, v_goal);
    else
      select p.id into v_plan
      from public.weekly_plans p
      where p.user_id = uid and p.week_start = v_week_start;
    end if;
  elsif p_regenerate then
    delete from public.weekly_plan_items i where i.plan_id = v_plan and i.day_date >= v_today;
    update public.weekly_plans p set goal_minutes = v_goal where p.id = v_plan;
    perform public.generate_plan_items(uid, v_plan, v_today, v_week_start, v_goal);
  end if;

  return query
    select i.id, i.day_date, i.slot, i.instrument_id, i.exercise_id,
           e.title, e.difficulty, e.recommended_bpm, e.duration_minutes,
           exists (
             select 1 from public.practice_sessions s
             where s.user_id = uid
               and s.exercise_id = i.exercise_id
               and (s.started_at at time zone 'America/Sao_Paulo')::date = i.day_date
           )
    from public.weekly_plan_items i
    join public.exercises e on e.id = i.exercise_id
    where i.plan_id = v_plan
      and public.can_see_exercise(e, uid)
    order by i.day_date, i.slot;
end;
$$;

-- 2) Limites de criação: trava por usuário para que chamadas em paralelo não passem do limite
create or replace function public.create_exercise(
  p_instrument text, p_title text, p_description text, p_objective text,
  p_difficulty smallint, p_bpm smallint, p_duration smallint, p_visibility text
) returns public.exercises
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  result public.exercises;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.instruments where id = p_instrument) then
    raise exception 'invalid_instrument';
  end if;
  perform public.check_exercise_fields(p_title, p_description, p_objective, p_difficulty, p_bpm, p_duration, p_visibility);

  perform pg_advisory_xact_lock(hashtextextended('create_exercise:' || me::text, 0));

  if (select count(*) from public.exercises where created_by = me and deleted_at is null) >= 20 then
    raise exception 'limit_total';
  end if;
  if (select count(*) from public.exercises
        where created_by = me
          and (created_at at time zone 'America/Sao_Paulo')::date = today) >= 10 then
    raise exception 'limit_daily';
  end if;

  insert into public.exercises
    (instrument_id, title, description, objective, difficulty, recommended_bpm, duration_minutes, created_by, visibility)
  values
    (p_instrument, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
     nullif(btrim(coalesce(p_objective, '')), ''), p_difficulty, p_bpm, p_duration, me, p_visibility)
  returning * into result;
  return result;
end $$;
