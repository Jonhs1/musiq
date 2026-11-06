-- Funções da comunidade de exercícios (toda escrita passa por aqui)

-- Validação compartilhada (uso interno)
create or replace function public.check_exercise_fields(
  p_title text, p_description text, p_objective text,
  p_difficulty smallint, p_bpm smallint, p_duration smallint, p_visibility text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_title is null or char_length(btrim(p_title)) < 3 or char_length(btrim(p_title)) > 60 then
    raise exception 'invalid_title';
  end if;
  if char_length(coalesce(p_description, '')) > 600 or char_length(coalesce(p_objective, '')) > 200 then
    raise exception 'invalid_text';
  end if;
  if p_difficulty is null or p_difficulty < 1 or p_difficulty > 5 then
    raise exception 'invalid_difficulty';
  end if;
  if p_bpm is not null and (p_bpm < 20 or p_bpm > 400) then
    raise exception 'invalid_bpm';
  end if;
  if p_duration is not null and (p_duration < 1 or p_duration > 120) then
    raise exception 'invalid_duration';
  end if;
  if p_visibility is null or p_visibility not in ('private', 'friends', 'public') then
    raise exception 'invalid_visibility';
  end if;
end $$;

create or replace function public.create_exercise(
  p_instrument text, p_title text, p_description text, p_objective text,
  p_difficulty smallint, p_bpm smallint, p_duration smallint, p_visibility text
) returns public.exercises
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  result public.exercises;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.instruments where id = p_instrument) then
    raise exception 'invalid_instrument';
  end if;
  perform public.check_exercise_fields(p_title, p_description, p_objective, p_difficulty, p_bpm, p_duration, p_visibility);

  if (select count(*) from public.exercises where created_by = me and deleted_at is null) >= 20 then
    raise exception 'limit_total';
  end if;
  if (select count(*) from public.exercises
        where created_by = me
          and (created_at at time zone 'America/Sao_Paulo')::date = today) >= 10 then
    raise exception 'limit_daily';
  end if;

  insert into public.exercises
    (instrument_id, title, description, objective, difficulty, recommended_bpm, duration_minutes, created_by, visibility)
  values
    (p_instrument, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
     nullif(btrim(coalesce(p_objective, '')), ''), p_difficulty, p_bpm, p_duration, me, p_visibility)
  returning * into result;
  return result;
end $$;

create or replace function public.update_exercise(
  p_id uuid, p_title text, p_description text, p_objective text,
  p_difficulty smallint, p_bpm smallint, p_duration smallint, p_visibility text
) returns public.exercises
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cur public.exercises;
  result public.exercises;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into cur from public.exercises where id = p_id;
  if not found or not public.can_see_exercise(cur, me) then raise exception 'not_found'; end if;
  if cur.created_by is distinct from me then raise exception 'not_owner'; end if;
  perform public.check_exercise_fields(p_title, p_description, p_objective, p_difficulty, p_bpm, p_duration, p_visibility);

  update public.exercises
     set title = btrim(p_title),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         objective = nullif(btrim(coalesce(p_objective, '')), ''),
         difficulty = p_difficulty,
         recommended_bpm = p_bpm,
         duration_minutes = p_duration,
         visibility = p_visibility
   where id = p_id
   returning * into result;
  return result;
end $$;

create or replace function public.delete_exercise(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cur public.exercises;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into cur from public.exercises where id = p_id;
  if not found or not public.can_see_exercise(cur, me) then raise exception 'not_found'; end if;
  if cur.created_by is distinct from me then raise exception 'not_owner'; end if;
  update public.exercises set deleted_at = now() where id = p_id;
end $$;

-- Curtir: remover a curtida é sempre permitido; adicionar exige que o exercício seja visível
create or replace function public.toggle_like(p_id uuid)
returns table (liked boolean, likes_count integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  cur public.exercises;
  removed integer;
  total integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.exercise_likes where user_id = me and exercise_id = p_id;
  get diagnostics removed = row_count;
  if removed > 0 then
    update public.exercises set likes_count = greatest(likes_count - 1, 0)
     where id = p_id returning likes_count into total;
    return query select false, coalesce(total, 0);
    return;
  end if;
  select * into cur from public.exercises where id = p_id;
  if not found or not public.can_see_exercise(cur, me) then raise exception 'not_found'; end if;
  insert into public.exercise_likes (user_id, exercise_id) values (me, p_id);
  update public.exercises set likes_count = likes_count + 1
   where id = p_id returning likes_count into total;
  return query select true, total;
end $$;

create or replace function public.toggle_favorite(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cur public.exercises;
  removed integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  delete from public.exercise_favorites where user_id = me and exercise_id = p_id;
  get diagnostics removed = row_count;
  if removed > 0 then return false; end if;
  select * into cur from public.exercises where id = p_id;
  if not found or not public.can_see_exercise(cur, me) then raise exception 'not_found'; end if;
  insert into public.exercise_favorites (user_id, exercise_id) values (me, p_id);
  return true;
end $$;

create or replace function public.report_exercise(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  cur public.exercises;
  added integer;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into cur from public.exercises where id = p_id;
  if not found or not public.can_see_exercise(cur, me) then raise exception 'not_found'; end if;
  if cur.created_by is null then raise exception 'cannot_report_official'; end if;
  if cur.created_by = me then raise exception 'cannot_report_own'; end if;

  insert into public.exercise_reports (user_id, exercise_id, reason)
  values (me, p_id, left(btrim(coalesce(p_reason, '')), 200))
  on conflict do nothing;
  get diagnostics added = row_count;
  if added > 0 then
    update public.exercises
       set reports_count = reports_count + 1,
           hidden = (reports_count + 1 >= 3)
     where id = p_id;
  end if;
end $$;

create or replace function public.get_community_exercises(
  p_instrument text default null,
  p_scope text default 'explore',
  p_order text default 'recent',
  p_limit integer default 30,
  p_offset integer default 0
) returns table (
  id uuid, instrument_id text, title text, description text, objective text,
  difficulty smallint, recommended_bpm smallint, duration_minutes smallint,
  visibility text, likes_count integer, created_by uuid,
  creator_nickname text, creator_avatar_url text,
  liked_by_me boolean, favorited_by_me boolean, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_scope not in ('explore', 'favorites', 'mine') then raise exception 'invalid_scope'; end if;

  return query
  select e.id, e.instrument_id, e.title, e.description, e.objective,
         e.difficulty, e.recommended_bpm, e.duration_minutes,
         e.visibility, e.likes_count, e.created_by,
         pr.nickname, pr.avatar_url,
         exists (select 1 from public.exercise_likes l where l.exercise_id = e.id and l.user_id = me),
         exists (select 1 from public.exercise_favorites f where f.exercise_id = e.id and f.user_id = me),
         e.created_at
  from public.exercises e
  left join public.profiles pr on pr.id = e.created_by
  where public.can_see_exercise(e, me)
    and (p_instrument is null or e.instrument_id = p_instrument)
    and case p_scope
          when 'explore'   then e.created_by is not null and e.created_by <> me
          when 'mine'      then e.created_by = me
          else exists (select 1 from public.exercise_favorites f2 where f2.exercise_id = e.id and f2.user_id = me)
        end
  order by
    case when p_order = 'likes' then e.likes_count end desc nulls last,
    e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(0, coalesce(p_offset, 0));
end $$;

revoke execute on function public.check_exercise_fields(text, text, text, smallint, smallint, smallint, text) from public, anon, authenticated;
revoke execute on function
  public.create_exercise(text, text, text, text, smallint, smallint, smallint, text),
  public.update_exercise(uuid, text, text, text, smallint, smallint, smallint, text),
  public.delete_exercise(uuid),
  public.toggle_like(uuid),
  public.toggle_favorite(uuid),
  public.report_exercise(uuid, text),
  public.get_community_exercises(text, text, text, integer, integer)
from public, anon;
grant execute on function
  public.create_exercise(text, text, text, text, smallint, smallint, smallint, text),
  public.update_exercise(uuid, text, text, text, smallint, smallint, smallint, text),
  public.delete_exercise(uuid),
  public.toggle_like(uuid),
  public.toggle_favorite(uuid),
  public.report_exercise(uuid, text),
  public.get_community_exercises(text, text, text, integer, integer)
to authenticated;
