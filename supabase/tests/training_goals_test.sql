-- Teste de metas de treino (Área Treino, Etapa 1, Tarefa 1).
-- Bloco revertido: o raise final desfaz tudo.
-- Esperado: um único erro "TESTE_OK training_goals". Qualquer outro erro é falha.
do $$
declare
  uid uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  sp_today date := (now() at time zone 'America/Sao_Paulo')::date;
  sp_week date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
  ex uuid; ex_c uuid; ex_d uuid; ex_del uuid; ex_other uuid; ex_new uuid;
  gid uuid; gc uuid; gd uuid; gdel uuid; g_other uuid;
  rat numeric; bst smallint; st text; cmp timestamptz;
  n int; dw smallint; idle int; expected int; i int;
  r record;
begin
  -- fixtures como superusuário (antes de simular o login)
  insert into auth.users (id, email) values
    (uid, 'teste-' || uid || '@exemplo.com'),
    (other, 'teste-' || other || '@exemplo.com');
  insert into public.user_instruments (user_id, instrument_id) values (uid, 'drums'), (other, 'drums');

  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Teste BPM', uid, 'private') returning id into ex;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Teste constancia', uid, 'private') returning id into ex_c;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Teste 23:30', uid, 'private') returning id into ex_d;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Teste apagado', uid, 'private') returning id into ex_del;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Teste de outro', other, 'private') returning id into ex_other;

  -- simula login do usuário principal
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);

  -- A) criação e estado inicial
  gid := public.create_training_goal(ex, 'bpm', 130, 200, null);
  assert gid is not null, 'create_training_goal devolveu nulo';
  select count(*) into n from public.get_my_training_goals();
  assert n = 1, 'esperava 1 meta, veio ' || n;
  select g.ratio, g.best_bpm, g.status into rat, bst, st
    from public.get_my_training_goals() g where g.goal_id = gid;
  assert rat = 0 and bst = 130 and st = 'active', 'estado inicial errado';

  -- B) parâmetros inválidos de BPM
  for r in select * from (values (130, 130), (130, 500), (10, 200)) v(a, b) loop
    begin
      perform public.create_training_goal(ex, 'bpm', r.a, r.b, null);
      raise exception 'nao_falhou';
    exception when others then
      assert sqlerrm = 'meta_invalida', 'esperava meta_invalida para ' || r.a || '->' || r.b || ', veio ' || sqlerrm;
    end;
  end loop;

  -- C) duplicata ativa no mesmo exercício
  begin
    perform public.create_training_goal(ex, 'bpm', 130, 200, null);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'meta_duplicada', 'esperava meta_duplicada, veio ' || sqlerrm;
  end;

  -- C2) exercício de outro usuário (privado)
  begin
    perform public.create_training_goal(ex_other, 'bpm', 100, 150, null);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'exercicio_invalido', 'esperava exercicio_invalido, veio ' || sqlerrm;
  end;

  -- D) sessão sem bpm_max não muda o resultado; sessão com 165 sobe o progresso
  insert into public.practice_sessions (user_id, instrument_id, exercise_id, started_at, duration_seconds, bpm_start, bpm_max)
    values (uid, 'drums', ex, now(), 60, 130, null);
  select g.ratio, g.best_bpm, g.status into rat, bst, st
    from public.get_my_training_goals() g where g.goal_id = gid;
  assert rat = 0 and bst = 130 and st = 'active', 'sessao sem bpm_max mudou o resultado';

  insert into public.practice_sessions (user_id, instrument_id, exercise_id, started_at, duration_seconds, bpm_start, bpm_max)
    values (uid, 'drums', ex, now(), 60, 130, 165);
  select g.ratio, g.best_bpm, g.status into rat, bst, st
    from public.get_my_training_goals() g where g.goal_id = gid;
  assert abs(rat - 0.5) < 0.01 and bst = 165 and st = 'active', 'progresso 165 errado: ratio=' || rat || ' best=' || bst;

  -- E) meta de constância
  begin
    perform public.create_training_goal(ex_c, 'consistency', null, null, 0);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'meta_invalida', 'dias=0 deveria ser meta_invalida, veio ' || sqlerrm;
  end;
  begin
    perform public.create_training_goal(ex_c, 'consistency', null, null, 8);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'meta_invalida', 'dias=8 deveria ser meta_invalida, veio ' || sqlerrm;
  end;

  gc := public.create_training_goal(ex_c, 'consistency', null, null, 4);
  insert into public.practice_sessions (user_id, instrument_id, exercise_id, started_at, duration_seconds)
    values (uid, 'drums', ex_c, (sp_week + time '12:00') at time zone 'America/Sao_Paulo', 60);
  insert into public.practice_sessions (user_id, instrument_id, exercise_id, started_at, duration_seconds)
    values (uid, 'drums', ex_c, (sp_today + time '12:00') at time zone 'America/Sao_Paulo', 60);
  expected := case when sp_today = sp_week then 1 else 2 end;
  select g.days_done_week, g.ratio into dw, rat
    from public.get_my_training_goals() g where g.goal_id = gc;
  assert dw = expected and abs(rat - expected::numeric / 4) < 0.01,
    'constancia errada: dias=' || dw || ' ratio=' || rat || ' esperado=' || expected;

  -- F) sessão às 23:30 de Brasília conta como hoje (mesmo com UTC já virado)
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Teste 23:30 meta', uid, 'private') returning id into ex_d;
  gd := public.create_training_goal(ex_d, 'consistency', null, null, 7);
  insert into public.practice_sessions (user_id, instrument_id, exercise_id, started_at, duration_seconds)
    values (uid, 'drums', ex_d, (sp_today + time '23:30') at time zone 'America/Sao_Paulo', 60);
  select g.days_done_week, g.days_idle into dw, idle
    from public.get_my_training_goals() g where g.goal_id = gd;
  assert dw = 1 and idle = 0, 'sessao 23:30 nao conta como hoje: dias=' || dw || ' idle=' || idle;

  -- G) exercício apagado some da lista
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Teste apagado meta', uid, 'private') returning id into ex_del;
  gdel := public.create_training_goal(ex_del, 'bpm', 100, 150, null);
  update public.exercises set deleted_at = now() where id = ex_del;
  select count(*) into n from public.get_my_training_goals() g where g.goal_id = gdel;
  assert n = 0, 'meta de exercicio apagado apareceu na lista';

  -- H) concluir: 210 >= alvo 200
  insert into public.practice_sessions (user_id, instrument_id, exercise_id, started_at, duration_seconds, bpm_start, bpm_max)
    values (uid, 'drums', ex, now(), 60, 130, 210);
  select g.ratio, g.best_bpm, g.status, g.completed_at into rat, bst, st, cmp
    from public.get_my_training_goals() g where g.goal_id = gid;
  assert st = 'done' and rat = 1 and cmp is not null, 'meta nao foi marcada como concluida: status=' || st || ' ratio=' || rat;

  -- I) limite de 10 metas ativas
  select count(*) into n from public.training_goals where user_id = uid and status = 'active';
  for i in 1 .. (10 - n) loop
    insert into public.exercises (instrument_id, title, created_by, visibility)
      values ('drums', 'Lote ' || i, uid, 'private') returning id into ex_new;
    perform public.create_training_goal(ex_new, 'bpm', 100, 150, null);
  end loop;
  insert into public.exercises (instrument_id, title, created_by, visibility)
    values ('drums', 'Excedente', uid, 'private') returning id into ex_new;
  begin
    perform public.create_training_goal(ex_new, 'bpm', 100, 150, null);
    raise exception 'nao_falhou';
  exception when others then
    assert sqlerrm = 'limite_de_metas', 'esperava limite_de_metas, veio ' || sqlerrm;
  end;

  -- J) arquivar: própria meta some; meta alheia não muda
  perform public.archive_training_goal(gc);
  select count(*) into n from public.get_my_training_goals() g where g.goal_id = gc;
  assert n = 0, 'meta arquivada ainda aparece';

  perform set_config('request.jwt.claim.sub', other::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', other::text, 'role', 'authenticated')::text, true);
  g_other := public.create_training_goal(ex_other, 'bpm', 100, 150, null);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);

  perform public.archive_training_goal(g_other);
  select status into st from public.training_goals where id = g_other;
  assert st = 'active', 'archive_training_goal alterou meta alheia';

  -- K) RLS: leitura direta e RPC só enxergam as próprias metas
  perform set_config('role', 'authenticated', true);
  select count(*) into n from public.training_goals where user_id = other;
  assert n = 0, 'RLS vazou metas de outro usuário (select direto)';
  select count(*) into n from public.get_my_training_goals() g where g.goal_id = g_other;
  assert n = 0, 'RPC vazou meta de outro usuário';
  perform set_config('role', 'none', true);

  raise exception 'TESTE_OK training_goals';
end $$;
