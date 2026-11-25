-- Teste de edição do plano de hoje (Área Treino, Etapa 1, Tarefa 2).
-- Bloco revertido. Esperado: um único erro "TESTE_OK plan_edit".
do $$
declare
  uid uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  nop uuid := gen_random_uuid();
  sp_today date := (now() at time zone 'America/Sao_Paulo')::date;
  ex1 uuid; ex2 uuid; ex_v uuid; ex_other uuid; ex_nop uuid; x uuid;
  it1 uuid; it2 uuid; it_other uuid; it_fut uuid; plan_me uuid;
  s0 smallint; s1 smallint; ex_now uuid; ins_now text;
  n int; c int; i int;
begin
  insert into auth.users (id, email) values
    (uid, 'teste-' || uid || '@exemplo.com'),
    (other, 'teste-' || other || '@exemplo.com'),
    (nop, 'teste-' || nop || '@exemplo.com');
  insert into public.user_instruments (user_id, instrument_id) values
    (uid, 'drums'), (other, 'drums'), (nop, 'drums');

  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Ex 1', uid, 'private') returning id into ex1;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Ex 2', uid, 'private') returning id into ex2;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('vocals', 'Ex voz', uid, 'private') returning id into ex_v;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Ex de outro', other, 'private') returning id into ex_other;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Ex sem plano', nop, 'private') returning id into ex_nop;

  -- usuário principal: cria o plano da semana
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  perform public.get_my_weekly_plan(false);
  select wp.id into plan_me from public.weekly_plans wp where wp.user_id = uid;

  -- adicionar, sem duplicar
  it1 := public.plan_add_item(ex1);
  assert it1 is not null, 'plan_add_item devolveu nulo';
  select count(*) into n from public.get_my_weekly_plan(false) p
    where p.item_id = it1 and p.day_date = sp_today and p.instrument_id = 'drums';
  assert n = 1, 'item novo nao aparece no plano de hoje';
  assert public.plan_add_item(ex1) = it1, 'segunda chamada nao devolveu o mesmo id';
  select count(*) into n from public.weekly_plan_items i
    where i.plan_id = plan_me and i.day_date = sp_today and i.exercise_id = ex1;
  assert n = 1, 'exercicio duplicado no dia';

  -- remover
  it2 := public.plan_add_item(ex2);
  perform public.plan_remove_item(it2);
  select count(*) into n from public.weekly_plan_items i where i.id = it2;
  assert n = 0, 'plan_remove_item nao removeu';
  it2 := public.plan_add_item(ex2);

  -- trocar: mantém slot, atualiza exercício e instrumento
  select i.slot into s0 from public.weekly_plan_items i where i.id = it2;
  perform public.plan_replace_item(it2, ex_v);
  select i.slot, i.exercise_id, i.instrument_id into s1, ex_now, ins_now
    from public.weekly_plan_items i where i.id = it2;
  assert s1 = s0, 'trocar mudou o slot';
  assert ex_now = ex_v and ins_now = 'vocals', 'trocar nao atualizou exercicio/instrumento';

  -- erros de remover/trocar: item de outro usuário
  perform set_config('request.jwt.claim.sub', other::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role', 'authenticated')::text, true);
  perform public.get_my_weekly_plan(false);
  it_other := public.plan_add_item(ex_other);
  assert it_other is not null, 'outro usuario nao conseguiu adicionar o proprio exercicio';

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);

  begin
    perform public.plan_remove_item(it_other);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'item_invalido', 'remover item alheio: veio ' || sqlerrm;
  end;
  begin
    perform public.plan_replace_item(it_other, ex1);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'item_invalido', 'trocar item alheio: veio ' || sqlerrm;
  end;
  begin
    perform public.plan_remove_item(gen_random_uuid());
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'item_invalido', 'remover item inexistente: veio ' || sqlerrm;
  end;
  begin
    perform public.plan_replace_item(gen_random_uuid(), ex1);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'item_invalido', 'trocar item inexistente: veio ' || sqlerrm;
  end;

  -- item de outro dia (amanhã) é intocável pelo "Hoje"
  insert into public.weekly_plan_items (plan_id, user_id, day_date, slot, instrument_id, exercise_id)
    values (plan_me, uid, sp_today + 1, 60, 'drums', ex1) returning id into it_fut;
  begin
    perform public.plan_remove_item(it_fut);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'item_invalido', 'remover item de outro dia: veio ' || sqlerrm;
  end;

  -- exercícios inválidos
  begin
    perform public.plan_add_item(ex_other);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'exercicio_invalido', 'adicionar privado alheio: veio ' || sqlerrm;
  end;
  begin
    perform public.plan_replace_item(it1, ex_other);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'exercicio_invalido', 'trocar por privado alheio: veio ' || sqlerrm;
  end;
  begin
    perform public.plan_replace_item(it_fut, ex2);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'item_invalido', 'trocar item de outro dia: veio ' || sqlerrm;
  end;
  begin
    perform public.plan_replace_item(it2, ex1);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'exercicio_invalido', 'trocar por exercicio ja presente hoje: veio ' || sqlerrm;
  end;

  -- usuário sem plano da semana
  perform set_config('request.jwt.claim.sub', nop::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', nop::text, 'role', 'authenticated')::text, true);
  begin
    perform public.plan_add_item(ex_nop);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'sem_plano', 'sem plano: veio ' || sqlerrm;
  end;

  -- limite de 12 itens no dia (usuário principal)
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  select count(*) into c from public.weekly_plan_items i where i.plan_id = plan_me and i.day_date = sp_today;
  for i in 1 .. (12 - c) loop
    insert into public.exercises (instrument_id, title, created_by, visibility)
      values ('drums', 'Lote ' || i, uid, 'private') returning id into x;
    perform public.plan_add_item(x);
  end loop;
  select count(*) into c from public.weekly_plan_items i where i.plan_id = plan_me and i.day_date = sp_today;
  assert c = 12, 'hoje deveria ter 12 itens, tem ' || c;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Lote 13', uid, 'private') returning id into x;
  begin
    perform public.plan_add_item(x);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'plano_cheio', '13o item: veio ' || sqlerrm;
  end;

  raise exception 'TESTE_OK plan_edit';
end $$;
