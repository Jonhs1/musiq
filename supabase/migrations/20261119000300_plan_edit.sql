-- Área Treino, Etapa 1: editar o plano de HOJE (adicionar, remover, trocar).
-- Só o dia de hoje (America/Sao_Paulo) pode ser alterado. Limite de 12 itens no dia.
-- Erros: exercicio_invalido, item_invalido, plano_cheio, sem_plano, tente_novamente.

-- Adiciona um exercício ao dia de hoje. Se já estiver no dia, devolve o item existente.
create or replace function public.plan_add_item(p_exercise uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_week_start date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
  v_ex public.exercises;
  v_plan uuid;
  v_item uuid;
  v_count int;
  v_slot smallint;
  v_attempt int := 0;
begin
  if uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  select * into v_ex from public.exercises where id = p_exercise;
  if not found or v_ex.deleted_at is not null or not public.can_see_exercise(v_ex, uid) then
    raise exception 'exercicio_invalido';
  end if;

  select wp.id into v_plan
    from public.weekly_plans wp
    where wp.user_id = uid and wp.week_start = v_week_start;
  if v_plan is null then
    raise exception 'sem_plano';
  end if;

  select i.id into v_item
    from public.weekly_plan_items i
    where i.plan_id = v_plan and i.day_date = v_today and i.exercise_id = p_exercise
    limit 1;
  if v_item is not null then
    return v_item;
  end if;

  select count(*) into v_count
    from public.weekly_plan_items i
    where i.plan_id = v_plan and i.day_date = v_today;
  if v_count >= 12 then
    raise exception 'plano_cheio';
  end if;

  -- a colisão de slot (duas inclusões simultâneas) é repetida; o usuário não vê erro de unicidade
  loop
    v_attempt := v_attempt + 1;
    select (coalesce(max(i.slot), 0) + 1)::smallint into v_slot
      from public.weekly_plan_items i
      where i.plan_id = v_plan and i.day_date = v_today;
    begin
      insert into public.weekly_plan_items (plan_id, user_id, day_date, slot, instrument_id, exercise_id)
        values (v_plan, uid, v_today, v_slot, v_ex.instrument_id, p_exercise)
        returning id into v_item;
      return v_item;
    exception when unique_violation then
      if v_attempt >= 3 then
        raise exception 'tente_novamente';
      end if;
    end;
  end loop;
end;
$$;

-- Remove um item de hoje do próprio usuário.
create or replace function public.plan_remove_item(p_item uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  delete from public.weekly_plan_items i
    where i.id = p_item and i.user_id = uid and i.day_date = v_today;
  if not found then
    raise exception 'item_invalido';
  end if;
end;
$$;

-- Troca o exercício de um item de hoje; mantém o slot.
create or replace function public.plan_replace_item(p_item uuid, p_exercise uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_plan uuid;
  v_ex public.exercises;
begin
  if uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  select i.plan_id into v_plan
    from public.weekly_plan_items i
    where i.id = p_item and i.user_id = uid and i.day_date = v_today;
  if not found then
    raise exception 'item_invalido';
  end if;

  select * into v_ex from public.exercises where id = p_exercise;
  if not found or v_ex.deleted_at is not null or not public.can_see_exercise(v_ex, uid) then
    raise exception 'exercicio_invalido';
  end if;

  if exists (
    select 1 from public.weekly_plan_items i
    where i.plan_id = v_plan and i.day_date = v_today
      and i.exercise_id = p_exercise and i.id <> p_item
  ) then
    raise exception 'exercicio_invalido';
  end if;

  update public.weekly_plan_items i
    set exercise_id = p_exercise, instrument_id = v_ex.instrument_id
    where i.id = p_item;
end;
$$;

revoke execute on function public.plan_add_item(uuid) from public, anon;
revoke execute on function public.plan_remove_item(uuid) from public, anon;
revoke execute on function public.plan_replace_item(uuid, uuid) from public, anon;
grant execute on function public.plan_add_item(uuid) to authenticated;
grant execute on function public.plan_remove_item(uuid) to authenticated;
grant execute on function public.plan_replace_item(uuid, uuid) to authenticated;
