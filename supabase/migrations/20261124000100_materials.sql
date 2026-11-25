-- Área Treino, Etapa 2 (Tarefa 1): materiais importados, cota diária e gravação atômica.
-- Só texto no banco: nenhum arquivo é guardado.
-- Erros: material_invalido, limite_diario, nao_autenticado, exercicio_invalido (vindo de plan_add_item).

-- ---------------------------------------------------------------------------
-- Helpers internos (não chamados pelo app)
-- ---------------------------------------------------------------------------

-- Chave de comparação de títulos: minúsculas, sem acento (cobre o português), espaços colapsados.
create or replace function public.material_title_key(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(lower(btrim(coalesce(t, ''))),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '\s+', ' ', 'g')
$$;

-- Texto opcional: nulo ou vazio vira null; corta no máximo de caracteres.
create or replace function public.material_text(j jsonb, maxlen integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text;
begin
  if j is null or jsonb_typeof(j) = 'null' then
    return null;
  end if;
  if jsonb_typeof(j) <> 'string' then
    raise exception 'material_invalido';
  end if;
  s := btrim(j #>> '{}');
  if s = '' then
    return null;
  end if;
  return left(s, maxlen);
end;
$$;

-- Inteiro opcional dentro de uma faixa; fora da faixa ou não inteiro → material_invalido.
create or replace function public.material_int(j jsonb, lo integer, hi integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  n numeric;
begin
  if j is null or jsonb_typeof(j) = 'null' then
    return null;
  end if;
  if jsonb_typeof(j) <> 'number' then
    raise exception 'material_invalido';
  end if;
  n := (j #>> '{}')::numeric;
  if n <> trunc(n) or n < lo or n > hi then
    raise exception 'material_invalido';
  end if;
  return n::integer;
end;
$$;

revoke execute on function public.material_title_key(text) from public, anon, authenticated;
revoke execute on function public.material_text(jsonb, integer) from public, anon, authenticated;
revoke execute on function public.material_int(jsonb, integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.training_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  instrument_id text not null references public.instruments (id),
  level text,
  general_rules jsonb not null default '[]'::jsonb,
  routine jsonb,
  created_at timestamptz not null default now()
);

alter table public.training_materials enable row level security;

create policy training_materials_select_own on public.training_materials
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.training_materials from anon, public;
revoke insert, update, delete, truncate on public.training_materials from authenticated;
grant select on public.training_materials to authenticated;

alter table public.exercises
  add column material_id uuid references public.training_materials (id) on delete cascade,
  add column pattern text,
  add column time_signature text,
  add column bpm_range_min smallint,
  add column bpm_range_max smallint,
  add column source_page smallint,
  add column sort_order smallint,
  add column progress_step_bpm smallint,
  add column progress_every_seconds smallint;

create index exercises_material_id_idx on public.exercises (material_id);

-- Exercício de material é sempre privado, não importa quem altere (update_exercise ou update direto).
create or replace function public.exercises_material_privacy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.material_id is not null then
    new.visibility := 'private';
  end if;
  return new;
end;
$$;

create trigger exercises_material_privacy
  before insert or update on public.exercises
  for each row execute function public.exercises_material_privacy();

-- Cota: uma linha por usuário e dia (fuso de São Paulo). Sem políticas: só funções acessam.
create table public.import_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  count smallint not null default 0 check (count >= 0),
  primary key (user_id, day)
);

alter table public.import_usage enable row level security;
revoke all on public.import_usage from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Cota
-- ---------------------------------------------------------------------------

-- Consome uma importação de hoje. Devolve quantas restam. Acima do limite → limite_diario.
create or replace function public.consume_import_quota(p_limit integer default 3)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  used smallint;
begin
  if uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  insert into public.import_usage as u (user_id, day, count)
    values (uid, today, 1)
    on conflict (user_id, day) do update
      set count = u.count + 1
      where u.count < p_limit
    returning u.count into used;

  if used is null then
    raise exception 'limite_diario';
  end if;
  return p_limit - used;
end;
$$;

-- Devolve uma importação de hoje (falha da IA ou da validação não deve gastar cota).
create or replace function public.refund_import_quota()
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  update public.import_usage u
    set count = greatest(u.count - 1, 0)
    where u.user_id = uid and u.day = today;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gravação atômica do material revisado
-- ---------------------------------------------------------------------------

-- p_material: { title, instrument_id, level, general_rules[], routine{}|null, exercises[1..40] }.
-- Qualquer erro aborta a transação inteira (nada fica salvo pela metade).
create or replace function public.save_imported_material(p_material jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  v_title text;
  v_instrument text;
  v_level text;
  v_rules jsonb := '[]'::jsonb;
  v_rule jsonb;
  v_rule_text text;
  v_rule_step integer;
  v_rule_every integer;
  v_step integer;
  v_every integer;
  v_routine jsonb := null;
  v_routine_title text;
  v_routine_min integer;
  v_order jsonb;
  v_exs jsonb;
  ex jsonb;
  v_material_id uuid;
  v_ex_id uuid;
  v_ids uuid[] := '{}';
  v_idx integer := 0;
  v_ex_title text;
  v_desc text;
  v_obj text;
  v_pattern text;
  v_sig text;
  v_diff integer;
  v_rec integer;
  v_rmin integer;
  v_rmax integer;
  v_dur integer;
  v_page integer;
begin
  if uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;
  if p_material is null or jsonb_typeof(p_material) <> 'object' then
    raise exception 'material_invalido';
  end if;

  -- material
  v_title := public.material_text(p_material->'title', 121);
  if v_title is null or char_length(v_title) > 120 then
    raise exception 'material_invalido';
  end if;

  v_instrument := nullif(p_material->>'instrument_id', '');
  if v_instrument is null or not exists (select 1 from public.instruments i where i.id = v_instrument) then
    raise exception 'material_invalido';
  end if;

  v_level := public.material_text(p_material->'level', 40);

  -- regras gerais (até 20) e primeira regra de progressão
  if p_material ? 'general_rules' and jsonb_typeof(p_material->'general_rules') = 'array' then
    if jsonb_array_length(p_material->'general_rules') > 20 then
      raise exception 'material_invalido';
    end if;
    for v_rule in select value from jsonb_array_elements(p_material->'general_rules') loop
      if jsonb_typeof(v_rule) <> 'object' then
        raise exception 'material_invalido';
      end if;
      v_rule_text := public.material_text(v_rule->'texto', 400);
      if v_rule_text is null then
        raise exception 'material_invalido';
      end if;
      v_rule_step := public.material_int(v_rule->'passo_bpm', 1, 100);
      v_rule_every := public.material_int(v_rule->'a_cada_segundos', 1, 3600);
      v_rules := v_rules || jsonb_build_array(jsonb_build_object(
        'texto', v_rule_text, 'passo_bpm', v_rule_step, 'a_cada_segundos', v_rule_every));
      if v_step is null and v_rule_step is not null and v_rule_every is not null then
        v_step := v_rule_step;
        v_every := v_rule_every;
      end if;
    end loop;
  elsif p_material ? 'general_rules' and jsonb_typeof(p_material->'general_rules') <> 'null' then
    raise exception 'material_invalido';
  end if;

  -- rotina (opcional)
  if p_material->'routine' is not null and jsonb_typeof(p_material->'routine') = 'object' then
    v_routine_title := public.material_text(p_material->'routine'->'titulo', 120);
    v_routine_min := public.material_int(p_material->'routine'->'duracao_total_minutos', 1, 600);
    v_order := '[]'::jsonb;
    if jsonb_typeof(p_material->'routine'->'ordem') = 'array' then
      if jsonb_array_length(p_material->'routine'->'ordem') > 40 then
        raise exception 'material_invalido';
      end if;
      for v_rule in select value from jsonb_array_elements(p_material->'routine'->'ordem') loop
        v_rule_text := public.material_text(v_rule, 120);
        if v_rule_text is not null then
          v_order := v_order || jsonb_build_array(v_rule_text);
        end if;
      end loop;
    end if;
    v_routine := jsonb_build_object(
      'titulo', v_routine_title,
      'duracao_total_minutos', v_routine_min,
      'ordem', v_order);
  end if;

  -- exercícios (1 a 40)
  v_exs := p_material->'exercises';
  if v_exs is null or jsonb_typeof(v_exs) <> 'array'
     or jsonb_array_length(v_exs) < 1 or jsonb_array_length(v_exs) > 40 then
    raise exception 'material_invalido';
  end if;

  insert into public.training_materials (user_id, title, instrument_id, level, general_rules, routine)
    values (uid, v_title, v_instrument, v_level, v_rules, v_routine)
    returning id into v_material_id;

  for ex in select value from jsonb_array_elements(v_exs) loop
    if jsonb_typeof(ex) <> 'object' then
      raise exception 'material_invalido';
    end if;

    v_ex_title := public.material_text(ex->'title', 121);
    if v_ex_title is null or char_length(v_ex_title) > 120 then
      raise exception 'material_invalido';
    end if;

    v_desc := public.material_text(ex->'description', 1000);
    v_obj := public.material_text(ex->'objective', 300);
    v_pattern := public.material_text(ex->'pattern', 200);
    v_sig := public.material_text(ex->'time_signature', 10);
    v_diff := public.material_int(ex->'difficulty', 1, 5);
    v_rec := public.material_int(ex->'recommended_bpm', 20, 400);
    v_rmin := public.material_int(ex->'bpm_range_min', 20, 400);
    v_rmax := public.material_int(ex->'bpm_range_max', 20, 400);
    v_dur := public.material_int(ex->'duration_minutes', 1, 180);
    v_page := public.material_int(ex->'source_page', 1, 999);

    if (v_rmin is null) <> (v_rmax is null) or (v_rmin is not null and v_rmin >= v_rmax) then
      raise exception 'material_invalido';
    end if;

    -- sem BPM recomendado, usa o início da faixa
    if v_rec is null then
      v_rec := v_rmin;
    end if;

    insert into public.exercises (
      instrument_id, title, description, objective, difficulty, recommended_bpm, duration_minutes,
      created_by, visibility, material_id, pattern, time_signature, bpm_range_min, bpm_range_max,
      source_page, sort_order, progress_step_bpm, progress_every_seconds)
    values (
      v_instrument, v_ex_title, v_desc, v_obj, v_diff, v_rec, v_dur,
      uid, 'private', v_material_id, v_pattern, v_sig, v_rmin, v_rmax,
      v_page, v_idx, v_step, v_every)
    returning id into v_ex_id;

    v_ids := v_ids || v_ex_id;
    v_idx := v_idx + 1;
  end loop;

  return jsonb_build_object('material_id', v_material_id, 'exercise_ids', to_jsonb(v_ids));
end;
$$;

-- Apaga o material; os exercícios e metas dele somem; sessões de prática ficam (exercise_id nulo).
create or replace function public.delete_training_material(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  delete from public.training_materials m
    where m.id = p_id and m.user_id = uid;
  if not found then
    raise exception 'material_invalido';
  end if;
end;
$$;

-- Adiciona à lista de hoje, na ordem da rotina, os exercícios do material cujo título bate.
-- Interrompe no plano cheio. Devolve quantos foram adicionados.
create or replace function public.add_material_routine_to_today(p_material uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  rt jsonb;
  nm text;
  ex_id uuid;
  added integer := 0;
begin
  if uid is null then
    raise exception 'nao_autenticado' using errcode = '28000';
  end if;

  select m.routine into rt
    from public.training_materials m
    where m.id = p_material and m.user_id = uid;
  if not found then
    raise exception 'material_invalido';
  end if;

  if rt is null or jsonb_typeof(rt->'ordem') <> 'array' then
    return 0;
  end if;

  -- garante o plano da semana antes de editar o dia
  perform public.get_my_weekly_plan(false);

  for nm in select value #>> '{}' from jsonb_array_elements(rt->'ordem') with ordinality as o(value, pos) order by pos loop
    select e.id into ex_id
      from public.exercises e
      where e.material_id = p_material
        and e.deleted_at is null
        and public.material_title_key(e.title) = public.material_title_key(nm)
      order by e.sort_order
      limit 1;
    if ex_id is null then
      continue;
    end if;

    if exists (
      select 1 from public.weekly_plan_items i
      join public.weekly_plans wp on wp.id = i.plan_id
      where wp.user_id = uid and i.day_date = today and i.exercise_id = ex_id
    ) then
      continue;
    end if;

    begin
      perform public.plan_add_item(ex_id);
      added := added + 1;
    exception when others then
      if sqlerrm = 'plano_cheio' then
        exit;
      elsif sqlerrm = 'exercicio_invalido' then
        null;
      else
        raise;
      end if;
    end;
  end loop;

  return added;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------------

revoke execute on function public.consume_import_quota(integer) from public, anon;
revoke execute on function public.refund_import_quota() from public, anon;
revoke execute on function public.save_imported_material(jsonb) from public, anon;
revoke execute on function public.delete_training_material(uuid) from public, anon;
revoke execute on function public.add_material_routine_to_today(uuid) from public, anon;
grant execute on function public.consume_import_quota(integer) to authenticated;
grant execute on function public.refund_import_quota() to authenticated;
grant execute on function public.save_imported_material(jsonb) to authenticated;
grant execute on function public.delete_training_material(uuid) to authenticated;
grant execute on function public.add_material_routine_to_today(uuid) to authenticated;
