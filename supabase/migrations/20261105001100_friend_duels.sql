-- Duelos entre amigos: "minutos" (mais minutos praticados na janela) e
-- "streak" (maior sequência de dias seguidos praticando na janela).
-- Janela começa quando o desafiado aceita (fuso America/Sao_Paulo). O vencedor ganha XP.

create table public.friend_duels (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.profiles (id) on delete cascade,
  opponent_id uuid not null references public.profiles (id) on delete cascade,
  format text not null check (format in ('minutes', 'streak')),
  duration_days smallint not null check (duration_days between 1 and 14),
  status text not null default 'pending' check (status in ('pending', 'active', 'finished')),
  xp_reward integer not null check (xp_reward >= 0),
  start_date date,
  end_date date,
  winner_id uuid references public.profiles (id) on delete set null,
  challenger_score integer,
  opponent_score integer,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  finished_at timestamptz,
  check (challenger_id <> opponent_id)
);

-- no máximo um duelo em aberto (pendente/ativo) por par e formato
create unique index friend_duels_open_unique
  on public.friend_duels (least(challenger_id, opponent_id), greatest(challenger_id, opponent_id), format)
  where status in ('pending', 'active');

create index friend_duels_challenger_idx on public.friend_duels (challenger_id);
create index friend_duels_opponent_idx on public.friend_duels (opponent_id);
create index friend_duels_winner_idx on public.friend_duels (winner_id);

alter table public.friend_duels enable row level security;
-- sem policies de escrita: tudo passa pelas RPCs (security definer)
create policy "participants can read duels" on public.friend_duels
  for select to authenticated
  using ((select auth.uid()) in (challenger_id, opponent_id));

-- pontuação de um usuário numa janela
create or replace function public.duel_score(p_user uuid, p_format text, p_start date, p_end date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case p_format
    when 'minutes' then (
      select coalesce(floor(sum(duration_seconds) / 60.0), 0)::int
      from public.practice_sessions
      where user_id = p_user
        and (started_at at time zone 'America/Sao_Paulo')::date between p_start and p_end
    )
    else (
      select coalesce(max(run), 0)::int from (
        select count(*) as run
        from (
          select d, d - (row_number() over (order by d))::int as grp
          from (
            select distinct (started_at at time zone 'America/Sao_Paulo')::date as d
            from public.practice_sessions
            where user_id = p_user
              and (started_at at time zone 'America/Sao_Paulo')::date between p_start and p_end
          ) days
        ) islands
        group by grp
      ) runs
    )
  end;
$$;

-- minutos praticados (desempate do duelo de streak)
create or replace function public.duel_minutes(p_user uuid, p_start date, p_end date)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.duel_score(p_user, 'minutes', p_start, p_end);
$$;

-- encerra duelos vencidos e paga o XP (uso interno)
create or replace function public.finalize_due_duels()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  d public.friend_duels%rowtype;
  s1 integer;
  s2 integer;
  m1 integer;
  m2 integer;
  win uuid;
  pay integer;
begin
  for d in
    select * from public.friend_duels
    where status = 'active' and end_date < today
    for update skip locked
  loop
    s1 := public.duel_score(d.challenger_id, d.format, d.start_date, d.end_date);
    s2 := public.duel_score(d.opponent_id, d.format, d.start_date, d.end_date);
    win := case when s1 > s2 then d.challenger_id when s2 > s1 then d.opponent_id else null end;

    if win is null and d.format = 'streak' then
      m1 := public.duel_minutes(d.challenger_id, d.start_date, d.end_date);
      m2 := public.duel_minutes(d.opponent_id, d.start_date, d.end_date);
      win := case when m1 > m2 then d.challenger_id when m2 > m1 then d.opponent_id else null end;
    end if;

    update public.friend_duels
    set status = 'finished', finished_at = now(), winner_id = win,
        challenger_score = s1, opponent_score = s2
    where id = d.id;

    if win is not null then
      update public.profiles
      set xp = xp + d.xp_reward,
          level = floor(sqrt((xp + d.xp_reward) / 100.0))::int + 1
      where id = win;
    else
      pay := d.xp_reward / 2;
      update public.profiles
      set xp = xp + pay,
          level = floor(sqrt((xp + pay) / 100.0))::int + 1
      where id in (d.challenger_id, d.opponent_id);
    end if;
  end loop;
end;
$$;

create or replace function public.create_duel(p_friend uuid, p_format text, p_days integer)
returns public.friend_duels
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  row public.friend_duels;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_format not in ('minutes', 'streak') then raise exception 'invalid_format'; end if;
  if p_days is null or p_days < 1 or p_days > 14 then raise exception 'invalid_days'; end if;
  if not public.are_friends(uid, p_friend) then raise exception 'not_friends'; end if;

  begin
    insert into public.friend_duels (challenger_id, opponent_id, format, duration_days, xp_reward)
    values (uid, p_friend, p_format, p_days, 50 + 25 * p_days)
    returning * into row;
  exception when unique_violation then
    raise exception 'duel_exists';
  end;
  return row;
end;
$$;

create or replace function public.respond_duel(p_duel uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  d public.friend_duels%rowtype;
begin
  select * into d from public.friend_duels
  where id = p_duel and opponent_id = uid and status = 'pending'
  for update;
  if not found then raise exception 'duel_not_found'; end if;

  if p_accept then
    if not public.are_friends(d.challenger_id, d.opponent_id) then raise exception 'not_friends'; end if;
    update public.friend_duels
    set status = 'active', accepted_at = now(),
        start_date = today, end_date = today + (duration_days - 1)
    where id = d.id;
    return 'accepted';
  end if;

  delete from public.friend_duels where id = d.id;
  return 'declined';
end;
$$;

-- quem convidou pode cancelar enquanto estiver pendente
create or replace function public.cancel_duel(p_duel uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friend_duels
  where id = p_duel and challenger_id = auth.uid() and status = 'pending';
$$;

create or replace function public.get_friend_duels()
returns table (
  id uuid,
  format text,
  duration_days integer,
  status text,
  xp_reward integer,
  start_date date,
  end_date date,
  i_am_challenger boolean,
  other_id uuid,
  other_nickname text,
  other_avatar_url text,
  my_score integer,
  their_score integer,
  winner_id uuid,
  created_at timestamptz,
  finished_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  perform public.finalize_due_duels();

  return query
  select
    d.id, d.format, d.duration_days::int, d.status, d.xp_reward, d.start_date, d.end_date,
    (d.challenger_id = uid),
    o.id, o.nickname, o.avatar_url,
    case d.status
      when 'pending' then null
      when 'finished' then case when d.challenger_id = uid then d.challenger_score else d.opponent_score end
      else public.duel_score(uid, d.format, d.start_date, d.end_date)
    end,
    case d.status
      when 'pending' then null
      when 'finished' then case when d.challenger_id = uid then d.opponent_score else d.challenger_score end
      else public.duel_score(o.id, d.format, d.start_date, d.end_date)
    end,
    d.winner_id, d.created_at, d.finished_at
  from public.friend_duels d
  join public.profiles o on o.id = case when d.challenger_id = uid then d.opponent_id else d.challenger_id end
  where d.challenger_id = uid or d.opponent_id = uid
  order by
    case d.status when 'pending' then 0 when 'active' then 1 else 2 end,
    coalesce(d.finished_at, d.accepted_at, d.created_at) desc
  limit 60;
end;
$$;

-- desfazer amizade também cancela duelos em aberto entre os dois
create or replace function public.remove_friendship(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friend_duels d
  where d.status in ('pending', 'active')
    and least(d.challenger_id, d.opponent_id) = least(auth.uid(), p_user_id)
    and greatest(d.challenger_id, d.opponent_id) = greatest(auth.uid(), p_user_id);

  delete from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(auth.uid(), p_user_id)
    and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p_user_id);
end;
$$;

-- permissões: só as RPCs públicas ficam executáveis por usuários logados
revoke all on function public.duel_score(uuid, text, date, date) from public, anon, authenticated;
revoke all on function public.duel_minutes(uuid, date, date) from public, anon, authenticated;
revoke all on function public.finalize_due_duels() from public, anon, authenticated;
revoke all on function public.create_duel(uuid, text, integer) from public, anon;
revoke all on function public.respond_duel(uuid, boolean) from public, anon;
revoke all on function public.cancel_duel(uuid) from public, anon;
revoke all on function public.get_friend_duels() from public, anon;
revoke all on function public.remove_friendship(uuid) from public, anon;
grant execute on function public.create_duel(uuid, text, integer) to authenticated;
grant execute on function public.respond_duel(uuid, boolean) to authenticated;
grant execute on function public.cancel_duel(uuid) to authenticated;
grant execute on function public.get_friend_duels() to authenticated;
grant execute on function public.remove_friendship(uuid) to authenticated;
