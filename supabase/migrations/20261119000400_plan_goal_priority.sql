-- Área Treino, Etapa 1: metas ativas entram primeiro na geração de cada dia.
-- Até 2 exercícios de metas ativas do instrumento do dia entram antes do preenchimento.
-- Ordem: mais dias sem praticar (nunca = maior) e, em empate, menor progresso.
-- Corpo copiado da versão atual (20261106000400_plan_community.sql); o bloco novo está
-- marcado com "METAS" e fica antes do while.

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
  ex_comm boolean;
  community_today boolean;
  used uuid[] := '{}';
  day_used uuid[];
begin
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
    community_today := false;

    -- METAS: até 2 exercícios de metas ativas do instrumento do dia, antes do preenchimento
    for ex_id, ex_min, ex_comm in
      select g.exercise_id,
             coalesce(e.duration_minutes, 10)::integer,
             (e.created_by is not null and e.created_by <> p_user)
      from public.training_goals g
      join public.exercises e on e.id = g.exercise_id
      left join lateral (
        select max(ps.bpm_max) as max_bpm,
               max((ps.started_at at time zone 'America/Sao_Paulo')::date) as last_day,
               count(distinct (ps.started_at at time zone 'America/Sao_Paulo')::date)
                 filter (where (ps.started_at at time zone 'America/Sao_Paulo')::date >= p_week_start) as days_week
        from public.practice_sessions ps
        where ps.user_id = p_user and ps.exercise_id = g.exercise_id
      ) s on true
      where g.user_id = p_user
        and g.status = 'active'
        and e.instrument_id = inst
        and e.deleted_at is null
        and public.can_see_exercise(e, p_user)
      order by coalesce((now() at time zone 'America/Sao_Paulo')::date - s.last_day, 9999) desc,
               (case when g.kind = 'bpm'
                     then least(1::numeric, greatest(0::numeric,
                            (greatest(g.start_bpm, coalesce(s.max_bpm, g.start_bpm)) - g.start_bpm)::numeric
                            / (g.target_bpm - g.start_bpm)))
                     else least(1::numeric, coalesce(s.days_week, 0)::numeric / g.days_per_week)
                end) asc
      limit 2
    loop
      slot_n := slot_n + 1;
      insert into public.weekly_plan_items (plan_id, user_id, day_date, slot, instrument_id, exercise_id)
      values (p_plan, p_user, d, slot_n, inst, ex_id);

      if ex_comm then community_today := true; end if;
      total := total + ex_min;
      used := used || ex_id;
      day_used := day_used || ex_id;
    end loop;
    ex_id := null;

    while total < p_goal and slot_n < 8 loop
      select e.id, coalesce(e.duration_minutes, 10),
             (e.created_by is not null and e.created_by <> p_user)
      into ex_id, ex_min, ex_comm
      from public.exercises e
      where e.instrument_id = inst
        and not (e.id = any (day_used))
        and (
          e.created_by is null
          or (e.created_by = p_user and e.deleted_at is null)
          or (
            not community_today
            and e.created_by <> p_user
            and e.visibility = 'public'
            and e.likes_count >= 3
            and e.reports_count = 0
            and not e.hidden
            and e.deleted_at is null
          )
        )
      order by (e.difficulty between dmin and dmax) desc,
               (e.id = any (used)) asc,
               random()
      limit 1;

      exit when ex_id is null;

      slot_n := slot_n + 1;
      insert into public.weekly_plan_items (plan_id, user_id, day_date, slot, instrument_id, exercise_id)
      values (p_plan, p_user, d, slot_n, inst, ex_id);

      if ex_comm then community_today := true; end if;
      total := total + ex_min;
      used := used || ex_id;
      day_used := day_used || ex_id;
      ex_id := null;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.generate_plan_items(uuid, uuid, date, date, integer) from public, anon, authenticated;
