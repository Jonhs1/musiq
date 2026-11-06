-- Perfil de qualquer usuário: dados básicos para todos; dados privados só para amigos e o próprio.
create or replace function public.get_user_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  f public.friendships;
  rel text;
  full_view boolean;
  result jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  if p_user_id = me then
    rel := 'self';
  else
    select * into f from public.friendships x
    where least(x.requester_id, x.addressee_id) = least(me, p_user_id)
      and greatest(x.requester_id, x.addressee_id) = greatest(me, p_user_id);
    rel := case
      when not found then 'none'
      when f.status = 'accepted' then 'friend'
      when f.requester_id = me then 'sent'
      else 'received'
    end;
  end if;
  full_view := rel in ('self', 'friend');

  select jsonb_build_object(
    'id', p.id,
    'nickname', p.nickname,
    'avatar_url', p.avatar_url,
    'xp', p.xp,
    'level', p.level,
    'streak_days', p.streak_days,
    'relation', rel,
    'friendship_id', f.id,
    'full_name', case when full_view then p.full_name end,
    'total_practice_seconds', case when full_view then p.total_practice_seconds end,
    'friends_since', case when rel = 'friend' then coalesce(f.responded_at, f.created_at) end,
    'achievements_count', (select count(*) from public.user_achievements ua where ua.user_id = p.id),
    'achievements', case when full_view then coalesce((
      select jsonb_agg(jsonb_build_object(
               'achievement_id', a.id, 'name', a.name, 'unlocked_at', ua.unlocked_at)
             order by ua.unlocked_at desc)
      from public.user_achievements ua
      join public.achievements a on a.id = ua.achievement_id
      where ua.user_id = p.id
    ), '[]'::jsonb) else '[]'::jsonb end,
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
    ), '[]'::jsonb)
  ) into result
  from public.profiles p
  where p.id = p_user_id and p.nickname is not null;

  if result is null then raise exception 'user_not_found'; end if;
  return result;
end;
$$;

revoke all on function public.get_user_profile(uuid) from public, anon;
grant execute on function public.get_user_profile(uuid) to authenticated;
