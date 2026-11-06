-- Chat 1:1 entre amigos: texto, foto e áudio, com tempo real e não lidas

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('text', 'image', 'audio')),
  body text check (body is null or char_length(body) <= 2000),
  media_path text,
  media_duration_ms integer check (media_duration_ms is null or media_duration_ms between 0 and 300000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id),
  check (kind <> 'text' or (body is not null and char_length(btrim(body)) > 0)),
  check (kind = 'text' or media_path is not null)
);
create index if not exists messages_pair_idx
  on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);
create index if not exists messages_unread_idx
  on public.messages (recipient_id) where read_at is null;

alter table public.messages enable row level security;
create policy "messages: ler as próprias" on public.messages
  for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
-- sem políticas de escrita: tudo passa pelas funções abaixo

alter publication supabase_realtime add table public.messages;

-- ------------------------------------------------------------ enviar
create or replace function public.send_message(
  p_recipient uuid,
  p_kind text,
  p_body text default null,
  p_media_path text default null,
  p_duration_ms integer default null
)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  result public.messages;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not public.are_friends(me, p_recipient) then raise exception 'not_friends'; end if;

  if p_kind = 'text' then
    if p_body is null or char_length(btrim(p_body)) = 0 then raise exception 'empty_message'; end if;
    p_media_path := null;
    p_duration_ms := null;
  elsif p_kind in ('image', 'audio') then
    if p_media_path is null or p_media_path not like (me::text || '/' || p_recipient::text || '/%') then
      raise exception 'invalid_media';
    end if;
  else
    raise exception 'invalid_kind';
  end if;

  insert into public.messages (sender_id, recipient_id, kind, body, media_path, media_duration_ms)
  values (me, p_recipient, p_kind, nullif(btrim(coalesce(p_body, '')), ''), p_media_path, p_duration_ms)
  returning * into result;
  return result;
end;
$$;

-- ------------------------------------------------------------ ler
create or replace function public.get_messages(p_friend uuid, p_before timestamptz default null, p_limit integer default 40)
returns setof public.messages
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.are_friends(auth.uid(), p_friend) then raise exception 'not_friends'; end if;
  return query
    select m.* from public.messages m
    where ((m.sender_id = auth.uid() and m.recipient_id = p_friend)
        or (m.sender_id = p_friend and m.recipient_id = auth.uid()))
      and (p_before is null or m.created_at < p_before)
    order by m.created_at desc
    limit least(greatest(p_limit, 1), 100);
end;
$$;

create or replace function public.mark_conversation_read(p_friend uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages set read_at = now()
  where recipient_id = auth.uid() and sender_id = p_friend and read_at is null;
$$;

-- Lista de conversas: todos os amigos, com a última mensagem e as não lidas
create or replace function public.get_conversations()
returns table (friend_id uuid, nickname text, avatar_url text, last_kind text, last_body text,
               last_sender_id uuid, last_at timestamptz, unread_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nickname, p.avatar_url, lm.kind, lm.body, lm.sender_id, lm.created_at,
         (select count(*)::int from public.messages u
          where u.recipient_id = auth.uid() and u.sender_id = p.id and u.read_at is null)
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  left join lateral (
    select m.kind, m.body, m.sender_id, m.created_at from public.messages m
    where (m.sender_id = auth.uid() and m.recipient_id = p.id)
       or (m.sender_id = p.id and m.recipient_id = auth.uid())
    order by m.created_at desc limit 1
  ) lm on true
  where f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  order by lm.created_at desc nulls last, p.nickname;
$$;

do $$
declare fn text;
begin
  foreach fn in array array[
    'send_message(uuid,text,text,text,integer)', 'get_messages(uuid,timestamptz,integer)',
    'mark_conversation_read(uuid)', 'get_conversations()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- ------------------------------------------------------------ mídia (fotos e áudios)
-- Caminho do arquivo: {remetente}/{destinatário}/{arquivo}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
              'audio/aac', 'audio/mpeg', 'audio/3gpp', 'audio/webm', 'audio/wav'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "chat-media: enviar para amigo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.are_friends((select auth.uid()), ((storage.foldername(name))[2])::uuid)
  );

create policy "chat-media: ler os da conversa" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or (storage.foldername(name))[2] = (select auth.uid())::text)
  );
