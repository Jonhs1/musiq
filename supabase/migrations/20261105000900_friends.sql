-- Amizades: código de amigo, pedidos mútuos, busca, perfil do amigo e rankings entre amigos

-- ---------------------------------------------------------------- código de amigo
create or replace function public.gen_friend_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end;
$$;

alter table public.profiles add column if not exists friend_code text;
update public.profiles set friend_code = public.gen_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set not null;
alter table public.profiles alter column friend_code set default public.gen_friend_code();
create unique index if not exists profiles_friend_code_key on public.profiles (friend_code);

-- o código não pode ser alterado pelo próprio usuário
create or replace function public.profiles_lock_friend_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.friend_code := old.friend_code;
  return new;
end;
$$;
drop trigger if exists profiles_lock_friend_code on public.profiles;
create trigger profiles_lock_friend_code before update on public.profiles
  for each row execute function public.profiles_lock_friend_code();

-- ---------------------------------------------------------------- amizades
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);

alter table public.friendships enable row level security;
create policy "friendships: ler as próprias" on public.friendships
  for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));
-- sem políticas de escrita: tudo passa pelas funções abaixo

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- ---------------------------------------------------------------- busca
create or replace function public.search_users(p_query text)
returns table (user_id uuid, nickname text, avatar_url text, level integer, relation text, friendship_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (select btrim(coalesce(p_query, '')) as t)
  select p.id, p.nickname, p.avatar_url, p.level,
         case
           when f.id is null then 'none'
           when f.status = 'accepted' then 'friend'
           when f.requester_id = auth.uid() then 'sent'
           else 'received'
         end as relation,
         f.id
  from public.profiles p
  cross join q
  left join public.friendships f
    on least(f.requester_id, f.addressee_id) = least(p.id, auth.uid())
   and greatest(f.requester_id, f.addressee_id) = greatest(p.id, auth.uid())
  where length(q.t) >= 2
    and p.id <> auth.uid()
    and p.nickname is not null
    and (p.nickname ilike replace(replace(q.t, '%', ''), '_', '') || '%'
         or p.friend_code = upper(q.t))
  order by (p.friend_code = upper(q.t)) desc, p.nickname
  limit 15;
$$;

-- ---------------------------------------------------------------- pedidos
-- Retorna 'sent' (pedido enviado) ou 'accepted' (o outro já tinha pedido: viraram amigos)
create or replace function public.send_friend_request(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  existing public.friendships;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_user_id = me then raise exception 'cannot_add_self'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and nickname is not null) then
    raise exception 'user_not_found';
  end if;

  select * into existing from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(me, p_user_id)
    and greatest(f.requester_id, f.addressee_id) = greatest(me, p_user_id);

  if found then
    if existing.status = 'accepted' then raise exception 'already_friends'; end if;
    if existing.requester_id = me then raise exception 'already_sent'; end if;
    update public.friendships set status = 'accepted', responded_at = now() where id = existing.id;
    return 'accepted';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (me, p_user_id);
  return 'sent';
end;
$$;

create or replace function public.send_friend_request_by_code(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  select id into target from public.profiles where friend_code = upper(btrim(coalesce(p_code, '')));
  if target is null then raise exception 'user_not_found'; end if;
  return public.send_friend_request(target);
end;
$$;

create or replace function public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (
    select 1 from public.friendships
    where id = p_friendship_id and addressee_id = me and status = 'pending'
  ) then
    raise exception 'request_not_found';
  end if;

  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now() where id = p_friendship_id;
  else
    delete from public.friendships where id = p_friendship_id;
  end if;
end;
$$;

-- Desfaz amizade, cancela pedido enviado ou recusa pedido recebido
create or replace function public.remove_friendship(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(auth.uid(), p_user_id)
    and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p_user_id);
$$;

-- ---------------------------------------------------------------- listas
create or replace function public.get_friends()
returns table (user_id uuid, nickname text, avatar_url text, level integer, xp integer,
               streak_days integer, last_practice_date date, friends_since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nickname, p.avatar_url, p.level, p.xp, p.streak_days, p.last_practice_date,
         coalesce(f.responded_at, f.created_at)
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  order by p.nickname;
$$;

create or replace function public.get_friend_requests()
returns table (friendship_id uuid, direction text, user_id uuid, nickname text, avatar_url text,
               level integer, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id,
         case when f.addressee_id = auth.uid() then 'incoming' else 'outgoing' end,
         p.id, p.nickname, p.avatar_url, p.level, f.created_at
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.status = 'pending'
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  order by f.created_at desc;
$$;

-- ---------------------------------------------------------------- perfil do amigo
create or replace function public.get_friend_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  result jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_user_id <> me and not public.are_friends(me, p_user_id) then
    raise exception 'not_friends';
  end if;

  select jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'full_name', p.full_name,
    'avatar_url', p.avatar_url,
    'xp', p.xp,
    'level', p.level,
    'streak_days', p.streak_days,
    'total_practice_seconds', p.total_practice_seconds,
    'friends_since', (
      select coalesce(f.responded_at, f.created_at) from public.friendships f
      where f.status = 'accepted'
        and least(f.requester_id, f.addressee_id) = least(me, p_user_id)
        and greatest(f.requester_id, f.addressee_id) = greatest(me, p_user_id)
    ),
    'instruments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'instrument_id', ui.instrument_id,
               'name', i.name,
               'is_primary', ui.is_primary,
               'experience_level', ui.experience_level,
               'xp', coalesce(s.xp, 0))
             order by ui.is_primary desc, i.name)
      from public.user_instruments ui
      join public.instruments i on i.id = ui.instrument_id
      left join public.user_instrument_stats s
        on s.user_id = ui.user_id and s.instrument_id = ui.instrument_id
      where ui.user_id = p.id
    ), '[]'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'achievement_id', a.id, 'name', a.name, 'unlocked_at', ua.unlocked_at)
             order by ua.unlocked_at desc)
      from public.user_achievements ua
      join public.achievements a on a.id = ua.achievement_id
      where ua.user_id = p.id
    ), '[]'::jsonb)
  ) into result
  from public.profiles p
  where p.id = p_user_id and p.nickname is not null;

  if result is null then raise exception 'user_not_found'; end if;
  return result;
end;
$$;

-- ---------------------------------------------------------------- rankings entre amigos
create or replace function public.get_friends_leaderboard()
returns table (rank_position bigint, user_id uuid, nickname text, avatar_url text, xp integer, level integer)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by p.xp desc, p.created_at) as rank_position,
         p.id, p.nickname, p.avatar_url, p.xp, p.level
  from public.profiles p
  where p.nickname is not null
    and (p.id = auth.uid() or public.are_friends(auth.uid(), p.id))
  order by p.xp desc, p.created_at;
$$;

create or replace function public.get_friends_instrument_leaderboard(p_instrument text)
returns table (rank_position bigint, user_id uuid, nickname text, avatar_url text, xp integer,
               score integer, inactive_days integer, last_practiced_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by l.score desc, l.xp desc, l.user_id) as rank_position,
         l.user_id, l.nickname, l.avatar_url, l.xp, l.score, l.inactive_days, l.last_practiced_at
  from public.get_instrument_leaderboard(p_instrument, 100) l
  where l.user_id = auth.uid() or public.are_friends(auth.uid(), l.user_id)
  order by l.score desc, l.xp desc, l.user_id;
$$;

-- ---------------------------------------------------------------- permissões
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'gen_friend_code()', 'profiles_lock_friend_code()', 'are_friends(uuid,uuid)',
    'search_users(text)', 'send_friend_request(uuid)', 'send_friend_request_by_code(text)',
    'respond_friend_request(uuid,boolean)', 'remove_friendship(uuid)', 'get_friends()',
    'get_friend_requests()', 'get_friend_profile(uuid)', 'get_friends_leaderboard()',
    'get_friends_instrument_leaderboard(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
  end loop;
end $$;

grant execute on function
  public.are_friends(uuid, uuid),
  public.search_users(text),
  public.send_friend_request(uuid),
  public.send_friend_request_by_code(text),
  public.respond_friend_request(uuid, boolean),
  public.remove_friendship(uuid),
  public.get_friends(),
  public.get_friend_requests(),
  public.get_friend_profile(uuid),
  public.get_friends_leaderboard(),
  public.get_friends_instrument_leaderboard(text)
to authenticated;
