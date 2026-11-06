-- Detalhe de um exercício (oficial ou da comunidade) com criador, curtida e favorito do usuário
create or replace function public.get_exercise(p_id uuid)
returns table (
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
  where e.id = p_id and public.can_see_exercise(e, me);
end $$;

revoke execute on function public.get_exercise(uuid) from public, anon;
grant execute on function public.get_exercise(uuid) to authenticated;
