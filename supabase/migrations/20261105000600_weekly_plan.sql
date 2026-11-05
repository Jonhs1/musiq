-- Passo 8: plano de treino semanal sugerido
-- Gerado no servidor a partir de: nível de experiência (por instrumento), meta de tempo diário
-- e instrumentos parados há mais tempo (os que estão caindo no ranking aparecem mais vezes).
-- Segunda a sábado têm treino; domingo é descanso.

alter table public.profiles
  add column daily_goal_minutes smallint not null default 20
  check (daily_goal_minutes between 5 and 180);
grant update (daily_goal_minutes) on public.profiles to authenticated;

create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  goal_minutes smallint not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.weekly_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.weekly_plans (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_date date not null,
  slot smallint not null,
  instrument_id text not null references public.instruments (id),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  unique (plan_id, day_date, slot)
);
create index weekly_plan_items_user_idx on public.weekly_plan_items (user_id);
create index weekly_plan_items_instrument_idx on public.weekly_plan_items (instrument_id);
create index weekly_plan_items_exercise_idx on public.weekly_plan_items (exercise_id);

alter table public.weekly_plans enable row level security;
alter table public.weekly_plan_items enable row level security;
create policy "plans: ler os próprios" on public.weekly_plans
  for select to authenticated using (user_id = (select auth.uid()));
create policy "plan_items: ler os próprios" on public.weekly_plan_items
  for select to authenticated using (user_id = (select auth.uid()));
-- criação e alteração apenas pelo servidor

-- Gera os itens de treino de p_from até sábado da semana
create or replace function public.generate_plan_items(
  p_user uuid, p_plan uuid, p_from date, p_week_start date, p_goal integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rot text[];
  falling text[];
  d date;
  k integer := 0;
  inst text;
  lvl text;
  dmin smallint;
  dmax smallint;
  total integer;
  slot_n smallint;
  ex_id uuid;
  ex_min integer;
  used uuid[] := '{}';
  day_used uuid[];
begin
  -- Instrumentos do usuário: quem está há mais tempo sem praticar vem primeiro
  -- (nunca praticado = primeiro). Os que passaram da carência do ranking (5 dias) entram de novo na rotação.
  select coalesce(array_agg(t.instrument_id order by t.idle desc, t.instrument_id), '{}'::text[]),
         coalesce(array_agg(t.instrument_id order by t.idle desc, t.instrument_id)
                  filter (where t.idle > 5 and t.idle < 9999), '{}'::text[])
  into rot, falling
  from (
    select ui.instrument_id,
           coalesce(
             (now() at time zone 'America/Sao_Paulo')::date
               - (s.last_practiced_at at time zone 'America/Sao_Paulo')::date,
             9999
           ) as idle
    from public.user_instruments ui
    left join public.user_instrument_stats s
      on s.user_id = ui.user_id and s.instrument_id = ui.instrument_id
    where ui.user_id = p_user
  ) t;

  if coalesce(array_length(rot, 1), 0) = 0 then
    return;
  end if;
  rot := rot || falling;

  for d in
    select g::date from generate_series(p_from, p_week_start + 5, interval '1 day') g
  loop
    inst := rot[(k % array_length(rot, 1)) + 1];
    k := k + 1;

    select ui.experience_level into lvl
    from public.user_instruments ui
    where ui.user_id = p_user and ui.instrument_id = inst;

    if lvl = 'advanced' then dmin := 3; dmax := 5;
    elsif lvl = 'intermediate' then dmin := 2; dmax := 3;
    else dmin := 1; dmax := 2;
    end if;

    total := 0;
    slot_n := 0;
    day_used := '{}';

    while total < p_goal and slot_n < 4 loop
      select e.id, coalesce(e.duration_minutes, 10) into ex_id, ex_min
      from public.exercises e
      where e.instrument_id = inst
        and (e.created_by is null or e.created_by = p_user)
        and not (e.id = any (day_used))
      order by (e.difficulty between dmin and dmax) desc,
               (e.id = any (used)) asc,
               random()
      limit 1;

      exit when ex_id is null;

      slot_n := slot_n + 1;
      insert into public.weekly_plan_items (plan_id, user_id, day_date, slot, instrument_id, exercise_id)
      values (p_plan, p_user, d, slot_n, inst, ex_id);

      total := total + ex_min;
      used := used || ex_id;
      day_used := day_used || ex_id;
      ex_id := null;
    end loop;
  end loop;
end;
$$;
revoke execute on function public.generate_plan_items(uuid, uuid, date, date, integer) from public, anon, authenticated;

-- Devolve o plano da semana atual (cria se não existir; com p_regenerate refaz de hoje em diante)
create or replace function public.get_my_weekly_plan(p_regenerate boolean default false)
returns table (
  item_id uuid,
  day_date date,
  slot smallint,
  instrument_id text,
  exercise_id uuid,
  title text,
  difficulty smallint,
  recommended_bpm smallint,
  minutes smallint,
  done boolean
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
    order by i.day_date, i.slot;
end;
$$;
revoke execute on function public.get_my_weekly_plan(boolean) from public, anon;
grant execute on function public.get_my_weekly_plan(boolean) to authenticated;
