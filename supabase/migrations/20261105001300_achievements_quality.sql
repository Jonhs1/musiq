-- Libera as 3 conquistas que dependiam de "qualidade": Velocista, Mestre do Ritmo e Perfeccionista.
-- O app passa a informar se o metrônomo foi usado na sessão (used_metronome).
-- Sessões antigas ficam como false (não há como saber) e não contam para essas três.

alter table public.practice_sessions
  add column used_metronome boolean not null default false;

update public.achievements set
  description = 'Supere seu recorde de BPM num exercício (sessão de 1 minuto ou mais, com metrônomo).'
where id = 'speedster';

update public.achievements set
  description = 'Complete 50 treinos de exercícios usando o metrônomo.'
where id = 'rhythm_master';

update public.achievements set
  description = 'Cumpra o tempo e o BPM recomendados, com metrônomo, em 10 exercícios diferentes.'
where id = 'perfectionist';

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
  challenge_bonus integer := 0;
  total_xp integer;
  ch public.user_challenges%rowtype;
  prog integer;
begin
  select * into p from public.profiles where id = new.user_id for update;

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

  insert into public.user_instrument_stats (user_id, instrument_id, xp, last_practiced_at)
  values (new.user_id, new.instrument_id, new.xp_earned, new.started_at)
  on conflict (user_id, instrument_id) do update
  set xp = public.user_instrument_stats.xp + excluded.xp,
      last_practiced_at = greatest(public.user_instrument_stats.last_practiced_at, excluded.last_practiced_at);

  with candidates(id) as (
    select 'first_step'::text
    union all select 'discipline' where new_streak >= 7
    union all select 'tireless' where new_total >= 36000
    union all select 'centenary'
      where (select count(*) from public.practice_sessions where user_id = new.user_id) >= 100
    union all select 'multi_instrumentalist'
      where (select count(distinct instrument_id) from public.practice_sessions where user_id = new.user_id) >= 3
    -- Velocista: bateu o próprio recorde de BPM (com metrônomo, 1 min ou mais) num exercício já praticado antes
    union all select 'speedster'
      where new.used_metronome
        and new.exercise_id is not null
        and new.duration_seconds >= 60
        and exists (
          select 1 from public.practice_sessions s
          where s.user_id = new.user_id and s.exercise_id = new.exercise_id
            and s.used_metronome and s.id <> new.id
        )
        and new.bpm_max > (
          select max(s.bpm_max) from public.practice_sessions s
          where s.user_id = new.user_id and s.exercise_id = new.exercise_id
            and s.used_metronome and s.id <> new.id
        )
    -- Mestre do Ritmo: 50 treinos de exercício com metrônomo
    union all select 'rhythm_master'
      where (
        select count(*) from public.practice_sessions s
        where s.user_id = new.user_id and s.used_metronome and s.exercise_id is not null
      ) >= 50
    -- Perfeccionista: tempo e BPM recomendados cumpridos (com metrônomo) em 10 exercícios diferentes
    union all select 'perfectionist'
      where (
        select count(distinct s.exercise_id)
        from public.practice_sessions s
        join public.exercises e on e.id = s.exercise_id
        where s.user_id = new.user_id
          and s.used_metronome
          and s.duration_seconds >= coalesce(e.duration_minutes, 5) * 60
          and s.bpm_max >= coalesce(e.recommended_bpm, 0)
      ) >= 10
  ), unlocked as (
    insert into public.user_achievements (user_id, achievement_id)
    select new.user_id, c.id from candidates c
    on conflict do nothing
    returning achievement_id
  )
  select coalesce(sum(a.xp_reward), 0) into bonus_xp
  from unlocked u
  join public.achievements a on a.id = u.achievement_id;

  for ch in
    select * from public.user_challenges
    where user_id = new.user_id
      and completed_at is null
      and session_day between period_start and period_end
    for update
  loop
    prog := least(ch.target, public.compute_challenge_progress(ch.user_id, ch.instrument_id, ch.period_start, ch.period_end));
    if prog >= ch.target then
      update public.user_challenges set progress = prog, completed_at = now() where id = ch.id;
      challenge_bonus := challenge_bonus + ch.xp_reward;
    elsif prog <> ch.progress then
      update public.user_challenges set progress = prog where id = ch.id;
    end if;
  end loop;

  total_xp := p.xp + new.xp_earned + bonus_xp + challenge_bonus;

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
