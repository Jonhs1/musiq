-- XP proporcional: 1 XP a cada 30 s (antes era (s/600)*20 com divisão inteira, então sessões < 10 min rendiam 0).
-- Mesmo ritmo de antes (20 XP por 10 min) e mesmo teto de 200 por sessão.
create or replace function public.practice_sessions_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.xp_earned := least(new.duration_seconds / 30, 200);
  return new;
end;
$$;

-- Recalcula o que já existe: sessões, XP por instrumento e XP/nível do perfil (somente a diferença).
do $$
begin
  create temp table _xp_delta on commit drop as
  select user_id, sum(least(duration_seconds / 30, 200) - xp_earned)::int as delta
  from public.practice_sessions
  group by user_id
  having sum(least(duration_seconds / 30, 200) - xp_earned) <> 0;

  update public.practice_sessions
  set xp_earned = least(duration_seconds / 30, 200)
  where xp_earned <> least(duration_seconds / 30, 200);

  update public.user_instrument_stats s
  set xp = t.total
  from (
    select user_id, instrument_id, sum(xp_earned)::int as total
    from public.practice_sessions group by user_id, instrument_id
  ) t
  where s.user_id = t.user_id and s.instrument_id = t.instrument_id;

  update public.profiles p
  set xp = p.xp + d.delta,
      level = floor(sqrt((p.xp + d.delta) / 100.0))::int + 1
  from _xp_delta d
  where p.id = d.user_id;
end;
$$;
