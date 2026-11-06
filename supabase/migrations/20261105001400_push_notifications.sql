-- Notificações push: tokens + gatilhos que chamam a Expo Push API via pg_net
create extension if not exists pg_net with schema extensions;

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens(user_id);
alter table public.push_tokens enable row level security;
-- sem policies: acesso só via RPCs

create or replace function public.register_push_token(p_token text, p_platform text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_token is null or p_token !~ '^(Expo|Exponent)PushToken\[.+\]$' then raise exception 'invalid_token'; end if;
  insert into public.push_tokens(token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end $$;

create or replace function public.unregister_push_token(p_token text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end $$;

create or replace function public.send_push(p_user uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare payload jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', token, 'title', p_title, 'body', p_body, 'data', p_data,
    'sound', 'default', 'channelId', 'default', 'priority', 'high'))
  into payload from public.push_tokens where user_id = p_user;
  if payload is null then return; end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := payload,
    headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb);
exception when others then
  raise warning 'send_push failed: %', sqlerrm;
end $$;

create or replace function public.nick_of(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(nickname, ''), 'Alguém') from public.profiles where id = p_user
$$;

create or replace function public.trg_push_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.send_push(new.recipient_id, public.nick_of(new.sender_id),
    case new.kind when 'image' then '📷 Foto' when 'audio' then '🎤 Mensagem de áudio'
      else left(coalesce(new.body, ''), 140) end,
    jsonb_build_object('type', 'message', 'friendId', new.sender_id));
  return new;
end $$;
create trigger messages_push after insert on public.messages
  for each row execute function public.trg_push_message();

create or replace function public.trg_push_duel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.send_push(new.opponent_id, '⚔️ Novo desafio',
      public.nick_of(new.challenger_id) || ' te desafiou por ' || new.duration_days || ' dias!',
      jsonb_build_object('type', 'duel', 'friendId', new.challenger_id));
  elsif old.status = 'pending' and new.status = 'active' then
    perform public.send_push(new.challenger_id, '⚔️ Desafio aceito',
      public.nick_of(new.opponent_id) || ' aceitou seu desafio. Bora treinar!',
      jsonb_build_object('type', 'duel', 'friendId', new.opponent_id));
  elsif old.status <> 'finished' and new.status = 'finished' then
    perform public.send_push(new.challenger_id, '🏁 Desafio encerrado',
      case when new.winner_id is null then 'Deu empate!'
           when new.winner_id = new.challenger_id then 'Você venceu! 🤘' else 'Dessa vez não foi. Peça revanche!' end,
      jsonb_build_object('type', 'duel', 'friendId', new.opponent_id));
    perform public.send_push(new.opponent_id, '🏁 Desafio encerrado',
      case when new.winner_id is null then 'Deu empate!'
           when new.winner_id = new.opponent_id then 'Você venceu! 🤘' else 'Dessa vez não foi. Peça revanche!' end,
      jsonb_build_object('type', 'duel', 'friendId', new.challenger_id));
  end if;
  return new;
end $$;
create trigger duels_push after insert or update of status on public.friend_duels
  for each row execute function public.trg_push_duel();

create or replace function public.trg_push_friendship() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.send_push(new.addressee_id, '🤝 Pedido de amizade',
      public.nick_of(new.requester_id) || ' quer ser seu amigo no SnakeTune.',
      jsonb_build_object('type', 'friend_request'));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.send_push(new.requester_id, '🤝 Amizade aceita',
      public.nick_of(new.addressee_id) || ' aceitou seu pedido!',
      jsonb_build_object('type', 'friend_accepted', 'friendId', new.addressee_id));
  end if;
  return new;
end $$;
create trigger friendships_push after insert or update of status on public.friendships
  for each row execute function public.trg_push_friendship();

revoke all on function public.send_push(uuid,text,text,jsonb), public.nick_of(uuid),
  public.trg_push_message(), public.trg_push_duel(), public.trg_push_friendship() from public, anon, authenticated;
revoke all on function public.register_push_token(text,text), public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text,text), public.unregister_push_token(text) to authenticated;
