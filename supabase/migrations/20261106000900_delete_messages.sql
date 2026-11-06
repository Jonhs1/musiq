-- Apagar mensagens (para os dois): o remetente apaga a própria mensagem; fica o aviso "Mensagem apagada".
alter table public.messages add column if not exists deleted_at timestamptz;

-- conteúdo só é obrigatório enquanto a mensagem não foi apagada
alter table public.messages drop constraint messages_check1;
alter table public.messages drop constraint messages_check2;
alter table public.messages add constraint messages_text_body_check
  check (deleted_at is not null or kind <> 'text' or (body is not null and char_length(btrim(body)) > 0));
alter table public.messages add constraint messages_media_path_check
  check (deleted_at is not null or kind = 'text' or media_path is not null);

-- Devolve o caminho do arquivo (foto/áudio) para o app removê-lo do armazenamento; null se não havia ou já estava apagada
create or replace function public.delete_message(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  m public.messages;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into m from public.messages
  where id = p_id and (sender_id = me or recipient_id = me);
  if not found then raise exception 'not_found'; end if;
  if m.sender_id <> me then raise exception 'not_owner'; end if;
  if m.deleted_at is not null then return null; end if;

  update public.messages
  set deleted_at = now(), body = null, media_path = null, media_duration_ms = null
  where id = p_id;
  return m.media_path;
end;
$$;
revoke all on function public.delete_message(uuid) from public, anon;
grant execute on function public.delete_message(uuid) to authenticated;

-- o remetente pode remover o próprio arquivo do armazenamento
create policy "chat-media: apagar os próprios" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- lista de conversas: indica se a última mensagem foi apagada
drop function public.get_conversations();
create function public.get_conversations()
returns table (friend_id uuid, nickname text, avatar_url text, last_kind text, last_body text,
               last_sender_id uuid, last_at timestamptz, unread_count integer, last_deleted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nickname, p.avatar_url, lm.kind, lm.body, lm.sender_id, lm.created_at,
         (select count(*)::int from public.messages u
          where u.recipient_id = auth.uid() and u.sender_id = p.id
            and u.read_at is null and u.deleted_at is null),
         coalesce(lm.deleted_at is not null, false)
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  left join lateral (
    select m.kind, m.body, m.sender_id, m.created_at, m.deleted_at from public.messages m
    where (m.sender_id = auth.uid() and m.recipient_id = p.id)
       or (m.sender_id = p.id and m.recipient_id = auth.uid())
    order by m.created_at desc limit 1
  ) lm on true
  where f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  order by lm.created_at desc nulls last, p.nickname;
$$;
revoke all on function public.get_conversations() from public, anon;
grant execute on function public.get_conversations() to authenticated;
