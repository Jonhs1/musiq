-- Teste de materiais importados (Área Treino, Etapa 2, Tarefa 1).
-- Bloco revertido. Esperado: um único erro "TESTE_OK materials".
do $$
declare
  uid uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  yday date := (now() at time zone 'America/Sao_Paulo')::date - 1;
  fixture jsonb := '{
    "title": "Apostila Teste",
    "instrument_id": "drums",
    "level": "intermediario",
    "general_rules": [
      {"texto": "Aquecer 20 min", "passo_bpm": null, "a_cada_segundos": null},
      {"texto": "Subir devagar", "passo_bpm": 5, "a_cada_segundos": 30}
    ],
    "routine": {"titulo": "Rotina", "duracao_total_minutos": 20, "ordem": ["Aquecimento", "Alternância contínua", "Inexistente"]},
    "exercises": [
      {"title": "Aquecimento", "description": "Base", "objective": null, "difficulty": 1,
       "recommended_bpm": null, "bpm_range_min": null, "bpm_range_max": null,
       "duration_minutes": 5, "pattern": null, "time_signature": "4/4", "source_page": 1},
      {"title": "Alternância contínua", "description": null, "objective": null, "difficulty": 2,
       "recommended_bpm": null, "bpm_range_min": 60, "bpm_range_max": 80,
       "duration_minutes": 5, "pattern": "D E D E", "time_signature": "4/4", "source_page": 2}
    ]
  }';
  res jsonb; mat uuid; ex1 uuid; ex2 uuid; pl record; n int; added int; s1 int; s2 int; st text; c record;
  big jsonb;
begin
  insert into auth.users (id, email) values
    (uid, 'teste-' || uid || '@exemplo.com'),
    (other, 'teste-' || other || '@exemplo.com');
  -- sem user_instruments: o plano automático fica vazio e não interfere na rotina

  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);

  -- 1) cota: uso de ontem não conta; 3 por dia; 4ª recusada; devolução libera
  insert into public.import_usage (user_id, day, count) values (uid, yday, 3);
  assert public.consume_import_quota(3) = 2, 'cota 1';
  assert public.consume_import_quota(3) = 1, 'cota 2';
  assert public.consume_import_quota(3) = 0, 'cota 3';
  begin
    perform public.consume_import_quota(3);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'limite_diario', 'cota 4: ' || sqlerrm;
  end;
  perform public.refund_import_quota();
  assert public.consume_import_quota(3) = 0, 'devolucao nao liberou a cota';

  -- 2) gravação do material de fixture reduzido
  res := public.save_imported_material(fixture);
  mat := (res->>'material_id')::uuid;
  assert mat is not null, 'sem material_id';
  assert jsonb_array_length(res->'exercise_ids') = 2, 'esperava 2 exercicios';
  ex1 := (res->'exercise_ids'->>0)::uuid;
  ex2 := (res->'exercise_ids'->>1)::uuid;

  select e.created_by, e.visibility, e.material_id, e.recommended_bpm, e.sort_order,
         e.progress_step_bpm, e.progress_every_seconds
    into c from public.exercises e where e.id = ex2;
  assert c.created_by = uid and c.visibility = 'private' and c.material_id = mat, 'ex2: dono/privacidade/vinculo';
  assert c.recommended_bpm = 60, 'recomendado deveria vir da faixa (60)';
  assert c.sort_order = 1 and c.progress_step_bpm = 5 and c.progress_every_seconds = 30, 'ex2: ordem/progressao';

  select e.sort_order, e.progress_step_bpm into s1, n from public.exercises e where e.id = ex1;
  assert s1 = 0 and n = 5, 'ex1: ordem/progressao';

  -- 3) rejeições (material_invalido)
  big := jsonb_build_object('title', 'Lote', 'instrument_id', 'drums',
    'exercises', (select jsonb_agg(jsonb_build_object('title', 'e' || g)) from generate_series(1, 41) g));
  for pl in select p from (values
    ('{"title":"","instrument_id":"drums","exercises":[{"title":"a"}]}'::jsonb),
    ('{"title":"' || repeat('x', 121) || '","instrument_id":"drums","exercises":[{"title":"a"}]}')::jsonb),
    ('{"title":"T","instrument_id":"ukulele","exercises":[{"title":"a"}]}'::jsonb),
    ('{"title":"T","instrument_id":"drums","exercises":[]}'::jsonb),
    ('{"title":"T","instrument_id":"drums","exercises":[{"title":""}]}'::jsonb),
    ('{"title":"T","instrument_id":"drums","exercises":[{"title":"a","recommended_bpm":10}]}'::jsonb),
    ('{"title":"T","instrument_id":"drums","exercises":[{"title":"a","bpm_range_min":80,"bpm_range_max":60}]}'::jsonb),
    ('{"title":"T","instrument_id":"drums","exercises":[{"title":"a","difficulty":6}]}'::jsonb),
    (big)
  ) v(p) loop
    begin
      perform public.save_imported_material(pl.p);
      raise exception 'nao_falhou';
    exception when others then
      assert sqlerrm = 'material_invalido', 'esperava material_invalido, veio ' || sqlerrm;
    end;
  end loop;

  -- 4) privacidade: update_exercise não deixa público; update direto também não
  begin
    perform public.update_exercise(ex1, 'Aquecimento', 'Base', null, 1::smallint, null, 5::smallint, 'public');
  exception when others then
    null;
  end;
  select e.visibility into st from public.exercises e where e.id = ex1;
  assert st = 'private', 'update_exercise deixou exercicio de material publico';
  update public.exercises set visibility = 'public' where id = ex2;
  select e.visibility into st from public.exercises e where e.id = ex2;
  assert st = 'private', 'update direto deixou exercicio de material publico';

  -- 5) rotina para hoje: ordem da rotina, sem duplicar, ignora nome inexistente
  added := public.add_material_routine_to_today(mat);
  assert added = 2, 'rotina deveria adicionar 2, adicionou ' || added;
  select i.slot into s1 from public.weekly_plan_items i where i.exercise_id = ex1 and i.day_date = (now() at time zone 'America/Sao_Paulo')::date;
  select i.slot into s2 from public.weekly_plan_items i where i.exercise_id = ex2 and i.day_date = (now() at time zone 'America/Sao_Paulo')::date;
  assert s1 < s2, 'ordem da rotina nao respeitada';
  assert public.add_material_routine_to_today(mat) = 0, 'rotina duplicou itens';

  -- 6) outro usuário: não lê, não adiciona, não apaga
  perform set_config('request.jwt.claim.sub', other::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.training_materials m where m.id = mat;
  assert n = 0, 'RLS vazou material alheio';
  perform set_config('role', 'none', true);
  begin
    perform public.add_material_routine_to_today(mat);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'material_invalido', 'rotina alheia: ' || sqlerrm;
  end;
  begin
    perform public.delete_training_material(mat);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'material_invalido', 'apagar alheio: ' || sqlerrm;
  end;

  -- 7) apagar: exercícios somem; sessão de prática fica com exercise_id nulo; metas somem
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  insert into public.practice_sessions (user_id, instrument_id, exercise_id, started_at, duration_seconds)
    values (uid, 'drums', ex1, now(), 60);
  perform public.create_training_goal(ex2, 'bpm', 60, 80, null);
  perform public.delete_training_material(mat);
  select count(*) into n from public.exercises e where e.material_id = mat;
  assert n = 0, 'exercicios do material nao foram apagados';
  select count(*) into n from public.practice_sessions p where p.user_id = uid and p.exercise_id is null;
  assert n = 1, 'sessao de pratica deveria ficar com exercise_id nulo';
  select count(*) into n from public.training_goals g where g.user_id = uid;
  assert n = 0, 'metas do material deveriam sumir';

  raise exception 'TESTE_OK materials';
end $$;
