-- Edição de instrumentos do perfil, de forma atômica:
-- recebe a lista final [{instrument_id, is_primary, experience_level}], remove os que saíram,
-- troca o principal e grava os níveis. Roda com os direitos do próprio usuário (RLS continua valendo).
-- O histórico de sessões, o XP por instrumento e o ranking são mantidos ao remover um instrumento.
create or replace function public.set_my_instruments(p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  primaries integer;
begin
  if uid is null then
    raise exception 'Usuário não autenticado.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Escolha pelo menos um instrumento.';
  end if;

  select count(*) into primaries
  from jsonb_to_recordset(p_items) as x(instrument_id text, is_primary boolean, experience_level text)
  where coalesce(x.is_primary, false);
  if primaries <> 1 then
    raise exception 'Escolha exatamente um instrumento principal.';
  end if;

  delete from public.user_instruments ui
  where ui.user_id = uid
    and ui.instrument_id not in (
      select x.instrument_id
      from jsonb_to_recordset(p_items) as x(instrument_id text)
      where x.instrument_id is not null
    );

  update public.user_instruments ui set is_primary = false
  where ui.user_id = uid and ui.is_primary;

  insert into public.user_instruments (user_id, instrument_id, is_primary, experience_level)
  select uid, x.instrument_id, coalesce(x.is_primary, false), coalesce(x.experience_level, 'beginner')
  from jsonb_to_recordset(p_items) as x(instrument_id text, is_primary boolean, experience_level text)
  on conflict (user_id, instrument_id) do update
  set is_primary = excluded.is_primary,
      experience_level = excluded.experience_level;
end;
$$;
revoke execute on function public.set_my_instruments(jsonb) from public, anon;
grant execute on function public.set_my_instruments(jsonb) to authenticated;
