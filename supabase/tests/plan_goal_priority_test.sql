-- Teste de prioridade das metas na geração do plano (Área Treino, Etapa 1, Tarefa 3).
-- Bloco revertido. Esperado: um único erro "TESTE_OK plan_goal_priority".
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  uc uuid := gen_random_uuid();
  sp_today date := (now() at time zone 'America/Sao_Paulo')::date;
  sp_end date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date + 5;
  e_a uuid; e_b1 uuid; e_b2 uuid; e_b3 uuid; e_c uuid; x uuid;
  bad int; n int; i int;
begin
  insert into auth.users (id, email) values
    (ua, 'teste-' || ua || '@exemplo.com'),
    (ub, 'teste-' || ub || '@exemplo.com'),
    (uc, 'teste-' || uc || '@exemplo.com');
  insert into public.user_instruments (user_id, instrument_id) values
    (ua, 'drums'), (ub, 'drums'), (uc, 'drums');

  -- caso 1: uma meta ativa entra no slot 1 em todos os dias gerados
  perform set_config('request.jwt.claim.sub', ua::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ua::text, 'role', 'authenticated')::text, true);
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Meta A', ua, 'private') returning id into e_a;
  for i in 1 .. 3 loop
    insert into public.exercises (instrument_id, title, created_by, visibility)
      values ('drums', 'Outro A ' || i, ua, 'private') returning id into x;
  end loop;
  perform public.create_training_goal(e_a, 'bpm', 130, 200, null);
  perform public.get_my_weekly_plan(true);

  select count(*) into bad
    from generate_series(sp_today, sp_end, interval '1 day') g
    where not exists (
      select 1 from public.weekly_plan_items wi
      join public.weekly_plans wp on wp.id = wi.plan_id
      where wp.user_id = ua and wi.day_date = g::date and wi.slot = 1 and wi.exercise_id = e_a
    );
  assert bad = 0, 'caso 1: meta fora do slot 1 em ' || bad || ' dia(s)';

  -- caso 2: três metas ativas; só as duas de maior prioridade entram (slots 1 e 2)
  -- prioridade: mais dias sem praticar (nunca = maior) e depois menor progresso
  perform set_config('request.jwt.claim.sub', ub::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', ub::text, 'role', 'authenticated')::text, true);
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'B nunca', ub, 'private') returning id into e_b1;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'B tres dias', ub, 'private') returning id into e_b2;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'B ontem', ub, 'private') returning id into e_b3;
  perform public.create_training_goal(e_b1, 'bpm', 100, 150, null);
  perform public.create_training_goal(e_b2, 'bpm', 100, 150, null);
  perform public.create_training_goal(e_b3, 'bpm', 100, 150, null);
  insert into public.practice_sessions (user_id, instrument_id, exercise_id, started_at, duration_seconds)
    values (ub, 'drums', e_b2, (sp_today - 3 + time '12:00') at time zone 'America/Sao_Paulo', 60);
  insert into public.practice_sessions (user_id, instrument_id, exercise_id, started_at, duration_seconds)
    values (ub, 'drums', e_b3, (sp_today - 1 + time '12:00') at time zone 'America/Sao_Paulo', 60);
  perform public.get_my_weekly_plan(true);

  select count(*) into bad
    from generate_series(sp_today, sp_end, interval '1 day') g
    where not exists (
      select 1 from public.weekly_plan_items wi
      join public.weekly_plans wp on wp.id = wi.plan_id
      where wp.user_id = ub and wi.day_date = g::date and wi.slot = 1 and wi.exercise_id = e_b1
    )
    or not exists (
      select 1 from public.weekly_plan_items wi
      join public.weekly_plans wp on wp.id = wi.plan_id
      where wp.user_id = ub and wi.day_date = g::date and wi.slot = 2 and wi.exercise_id = e_b2
    );
  assert bad = 0, 'caso 2: ordem de prioridade errada em ' || bad || ' dia(s)';

  -- caso 3: usuário sem metas continua recebendo plano em todos os dias
  perform set_config('request.jwt.claim.sub', uc::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uc::text, 'role', 'authenticated')::text, true);
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'C', uc, 'private') returning id into e_c;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'C2', uc, 'private') returning id into x;
  perform public.get_my_weekly_plan(true);

  select count(*) into bad
    from generate_series(sp_today, sp_end, interval '1 day') g
    where not exists (
      select 1 from public.weekly_plan_items wi
      join public.weekly_plans wp on wp.id = wi.plan_id
      where wp.user_id = uc and wi.day_date = g::date
    );
  assert bad = 0, 'caso 3: usuario sem metas ficou sem plano em ' || bad || ' dia(s)';

  raise exception 'TESTE_OK plan_goal_priority';
end $$;
