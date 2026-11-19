-- Correções da auditoria geral (segurança + desempenho)
--
-- 1. are_friends() deixa de ser chamável pelo app: é um auxiliar interno.
--    Exposta, ela permitia descobrir se duas pessoas quaisquer são amigas.
--    (can_see_exercise() continua exposta de propósito: a política RLS da
--     tabela exercises a usa, e políticas rodam com as permissões de quem consulta.)
-- 2. Índice que cobre a chave estrangeira messages.sender_id.
-- 3. O gatilho de prática só avalia as conquistas que ainda faltam, em vez de
--    rodar as seis agregações sobre practice_sessions em toda sessão salva.

revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated;

create index if not exists messages_sender_idx
  on public.messages (sender_id, created_at desc);

create or replace function public.practice_sessions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
  locked text[];
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

  -- Conquistas que esta pessoa ainda não tem. Só essas precisam ser conferidas.
  select coalesce(array_agg(a.id), '{}'::text[]) into locked
  from public.achievements a
  where not exists (
    select 1 from public.user_achievements ua
    where ua.user_id = new.user_id and ua.achievement_id = a.id
  );

  if array_length(locked, 1) is not null then
    with candidates(id) as (
      select 'first_step'::text
        where 'first_step' = any(locked)
      union all select 'discipline'
        where 'discipline' = any(locked) and new_streak >= 7
      union all select 'tireless'
        where 'tireless' = any(locked) and new_total >= 36000
      union all select 'centenary'
        where 'centenary' = any(locked)
          and (select count(*) from public.practice_sessions where user_id = new.user_id) >= 100
      union all select 'multi_instrumentalist'
        where 'multi_instrumentalist' = any(locked)
          and (select count(distinct instrument_id) from public.practice_sessions where user_id = new.user_id) >= 3
      union all select 'speedster'
        where 'speedster' = any(locked)
          and new.used_metronome
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
      union all select 'rhythm_master'
        where 'rhythm_master' = any(locked)
          and (
            select count(*) from public.practice_sessions s
            where s.user_id = new.user_id and s.used_metronome and s.exercise_id is not null
          ) >= 50
      union all select 'perfectionist'
        where 'perfectionist' = any(locked)
          and (
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
  end if;

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
$function$;
