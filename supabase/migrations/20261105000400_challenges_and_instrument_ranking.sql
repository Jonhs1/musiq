-- Passo 7: desafios diários/semanais (constância) + ranking permanente por instrumento
-- com queda de pontuação por inatividade (o XP do instrumento nunca é perdido).

-- ============ XP por instrumento ============
create table public.user_instrument_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  instrument_id text not null references public.instruments (id),
  xp integer not null default 0 check (xp >= 0),
  last_practiced_at timestamptz,
  primary key (user_id, instrument_id)
);
create index user_instrument_stats_rank_idx on public.user_instrument_stats (instrument_id, xp desc);

alter table public.user_instrument_stats enable row level security;
create policy "instrument_stats: ler os próprios" on public.user_instrument_stats
  for select to authenticated using (user_id = (select auth.uid()));
-- escrita apenas via trigger do servidor

insert into public.user_instrument_stats (user_id, instrument_id, xp, last_practiced_at)
select user_id, instrument_id, sum(xp_earned), max(started_at)
from public.practice_sessions
group by user_id, instrument_id;

-- ============ Modelos de desafio ============
create table public.challenge_templates (
  id text primary key,
  period text not null check (period in ('daily', 'weekly')),
  title text not null,
  description text not null,
  uses_instrument boolean not null default false,
  target smallint not null check (target > 0),
  xp_reward integer not null check (xp_reward >= 0)
);

alter table public.challenge_templates enable row level security;
create policy "challenge_templates: leitura" on public.challenge_templates
  for select to authenticated using (true);

insert into public.challenge_templates (id, period, title, description, uses_instrument, target, xp_reward) values
  ('daily_any', 'daily', 'Mantenha o ritmo', 'Pratique qualquer instrumento hoje.', false, 1, 20),
  ('daily_instrument', 'daily', 'Dia de {instrument}', 'Pratique {instrument} hoje.', true, 1, 25),
  ('weekly_days_3', 'weekly', 'Constância', 'Pratique em 3 dias diferentes nesta semana.', false, 3, 60),
  ('weekly_days_5', 'weekly', 'Semana de ferro', 'Pratique em 5 dias diferentes nesta semana.', false, 5, 120),
  ('weekly_instrument_3', 'weekly', 'Foco em {instrument}', 'Pratique {instrument} em 3 dias diferentes nesta semana.', true, 3, 90);

-- ============ Desafios de cada usuário ============
create table public.user_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  template_id text not null references public.challenge_templates (id),
  period text not null check (period in ('daily', 'weekly')),
  period_start date not null,
  period_end date not null,
  instrument_id text references public.instruments (id),
  title text not null,
  description text not null,
  progress smallint not null default 0,
  target smallint not null,
  xp_reward integer not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, period, period_start)
);
create index user_challenges_template_idx on public.user_challenges (template_id);
create index user_challenges_instrument_idx on public.user_challenges (instrument_id);

alter table public.user_challenges enable row level security;
create policy "challenges: ler os próprios" on public.user_challenges
  for select to authenticated using (user_id = (select auth.uid()));
-- criação e progresso apenas pelo servidor

-- Dias distintos (fuso de São Paulo) em que o usuário praticou dentro de um período
create or replace function public.compute_challenge_progress(
  p_user uuid, p_instrument text, p_start date, p_end date
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct (started_at at time zone 'America/Sao_Paulo')::date)::int
  from public.practice_sessions
  where user_id = p_user
    and (p_instrument is null or instrument_id = p_instrument)
    and (started_at at time zone 'America/Sao_Paulo')::date between p_start and p_end;
$$;
revoke execute on function public.compute_challenge_progress(uuid, text, date, date) from public, anon, authenticated;

-- Garante (sorteando, se preciso) o desafio do dia e o da semana e devolve os dois
create or replace function public.get_my_challenges()
returns setof public.user_challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  week_start date := date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date;
  per text;
  p_start date;
  p_end date;
  t public.challenge_templates%rowtype;
  inst_id text;
  inst_name text;
  prog integer;
begin
  if uid is null then
    return;
  end if;

  foreach per in array array['daily', 'weekly'] loop
    if per = 'daily' then
      p_start := today; p_end := today;
    else
      p_start := week_start; p_end := week_start + 6;
    end if;

    if not exists (
      select 1 from public.user_challenges
      where user_id = uid and period = per and period_start = p_start
    ) then
      select * into t from public.challenge_templates where period = per order by random() limit 1;

      inst_id := null;
      inst_name := null;
      if t.uses_instrument then
        select ui.instrument_id into inst_id
        from public.user_instruments ui
        where ui.user_id = uid
        order by random() limit 1;
        if inst_id is null then
          select i.id into inst_id from public.instruments i order by random() limit 1;
        end if;
        select i.name into inst_name from public.instruments i where i.id = inst_id;
      end if;

      prog := least(t.target, public.compute_challenge_progress(uid, inst_id, p_start, p_end));

      insert into public.user_challenges (
        user_id, template_id, period, period_start, period_end, instrument_id,
        title, description, progress, target, xp_reward, completed_at
      ) values (
        uid, t.id, per, p_start, p_end, inst_id,
        replace(t.title, '{instrument}', coalesce(inst_name, '')),
        replace(t.description, '{instrument}', coalesce(inst_name, '')),
        prog, t.target, t.xp_reward,
        null
      )
      on conflict (user_id, period, period_start) do nothing;
      -- Se já praticou antes de abrir os desafios, o progresso entra e o bônus é pago na próxima sessão.
    end if;
  end loop;

  return query
    select * from public.user_challenges
    where user_id = uid
      and ((period = 'daily' and period_start = today) or (period = 'weekly' and period_start = week_start))
    order by period;
end;
$$;
revoke execute on function public.get_my_challenges() from public, anon;
grant execute on function public.get_my_challenges() to authenticated;

-- ============ Trigger de sessão: XP por instrumento + desafios ============
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

  -- XP e última prática por instrumento (base do ranking por instrumento)
  insert into public.user_instrument_stats (user_id, instrument_id, xp, last_practiced_at)
  values (new.user_id, new.instrument_id, new.xp_earned, new.started_at)
  on conflict (user_id, instrument_id) do update
  set xp = public.user_instrument_stats.xp + excluded.xp,
      last_practiced_at = greatest(public.user_instrument_stats.last_practiced_at, excluded.last_practiced_at);

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

  -- Desafios do período desta sessão: atualiza progresso e paga o bônus uma única vez
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

-- ============ Ranking por instrumento (com queda por inatividade) ============
-- Carência de 5 dias sem praticar o instrumento; depois, -2% da pontuação por dia, até no máximo -50%.
create or replace function public.get_instrument_leaderboard(p_instrument text, max_rows integer default 50)
returns table (
  rank_position bigint,
  user_id uuid,
  nickname text,
  avatar_url text,
  xp integer,
  score integer,
  inactive_days integer,
  last_practiced_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select s.user_id, p.nickname, p.avatar_url, s.xp, s.last_practiced_at,
           greatest(0,
             (now() at time zone 'America/Sao_Paulo')::date
             - (s.last_practiced_at at time zone 'America/Sao_Paulo')::date
           )::int as idle_days
    from public.user_instrument_stats s
    join public.profiles p on p.id = s.user_id
    where s.instrument_id = p_instrument
      and p.nickname is not null
      and s.xp > 0
  ), scored as (
    select b.*,
           floor(b.xp * greatest(0.5, 1 - 0.02 * greatest(0, b.idle_days - 5)))::int as final_score
    from base b
  )
  select row_number() over (order by sc.final_score desc, sc.xp desc, sc.user_id) as rank_position,
         sc.user_id, sc.nickname, sc.avatar_url, sc.xp, sc.final_score, sc.idle_days, sc.last_practiced_at
  from scored sc
  order by sc.final_score desc, sc.xp desc, sc.user_id
  limit least(greatest(max_rows, 1), 100);
$$;
revoke execute on function public.get_instrument_leaderboard(text, integer) from public, anon;
grant execute on function public.get_instrument_leaderboard(text, integer) to authenticated;
