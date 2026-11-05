-- Conquistas automáticas: avaliadas no servidor a cada sessão registrada.
-- Desbloqueáveis agora: first_step, discipline, tireless, centenary, multi_instrumentalist.
-- Ainda bloqueadas (dependem de critério de qualidade/precisão): speedster, rhythm_master, perfectionist.
create or replace function public.practice_sessions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_day date := (new.started_at at time zone 'America/Sao_Paulo')::date;
  p public.profiles%rowtype;
  new_streak integer;
  new_last_day date;
  new_total bigint;
  bonus_xp integer := 0;
  total_xp integer;
begin
  select * into p from public.profiles where id = new.user_id for update;

  -- Sequência de dias
  new_streak := p.streak_days;
  new_last_day := p.last_practice_date;
  if new_last_day is null or session_day > new_last_day then
    if new_last_day is not null and session_day = new_last_day + 1 then
      new_streak := p.streak_days + 1;
    else
      new_streak := 1;
    end if;
    new_last_day := session_day;
  end if;
  new_total := p.total_practice_seconds + new.duration_seconds;

  -- Conquistas (o bônus de XP só é pago na primeira vez que a conquista é desbloqueada)
  with candidates(id) as (
    select 'first_step'::text
    union all select 'discipline' where new_streak >= 7
    union all select 'tireless' where new_total >= 36000
    union all select 'centenary'
      where (select count(*) from public.practice_sessions where user_id = new.user_id) >= 100
    union all select 'multi_instrumentalist'
      where (select count(distinct instrument_id) from public.practice_sessions where user_id = new.user_id) >= 3
  ), unlocked as (
    insert into public.user_achievements (user_id, achievement_id)
    select new.user_id, c.id from candidates c
    on conflict do nothing
    returning achievement_id
  )
  select coalesce(sum(a.xp_reward), 0) into bonus_xp
  from unlocked u
  join public.achievements a on a.id = u.achievement_id;

  total_xp := p.xp + new.xp_earned + bonus_xp;

  update public.profiles
  set xp = total_xp,
      level = floor(sqrt(total_xp / 100.0))::int + 1,
      total_practice_seconds = new_total,
      streak_days = new_streak,
      last_practice_date = new_last_day
  where id = new.user_id;

  return new;
end;
$$;
