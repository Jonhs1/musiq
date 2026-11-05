-- Plano semanal: permite até 8 exercícios por dia (metas de tempo maiores não ficavam completas com 4).
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

    while total < p_goal and slot_n < 8 loop
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
