-- MUSIQ: schema inicial (perfis, instrumentos, exercícios, sessões, XP, conquistas)

-- ============ Funções utilitárias ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  nickname text unique,
  avatar_url text,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_practice_date date,
  total_practice_seconds bigint not null default 0 check (total_practice_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nickname_length check (nickname is null or char_length(nickname) between 3 and 20)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Cria o perfil automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ============ instruments ============
create table public.instruments (
  id text primary key,
  name text not null,
  sort_order smallint not null default 0
);

insert into public.instruments (id, name, sort_order) values
  ('drums', 'Bateria', 1),
  ('guitar', 'Guitarra', 2),
  ('bass', 'Baixo', 3),
  ('piano', 'Piano', 4);

create table public.user_instruments (
  user_id uuid not null references public.profiles (id) on delete cascade,
  instrument_id text not null references public.instruments (id),
  is_primary boolean not null default false,
  experience_level text not null default 'beginner'
    check (experience_level in ('beginner', 'intermediate', 'advanced')),
  created_at timestamptz not null default now(),
  primary key (user_id, instrument_id)
);

create unique index user_instruments_one_primary
  on public.user_instruments (user_id) where is_primary;
create index user_instruments_instrument_idx on public.user_instruments (instrument_id);

-- ============ exercises ============
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  instrument_id text not null references public.instruments (id),
  title text not null,
  description text,
  objective text,
  difficulty smallint not null default 1 check (difficulty between 1 and 5),
  recommended_bpm smallint check (recommended_bpm between 20 and 400),
  duration_minutes smallint check (duration_minutes > 0),
  created_by uuid references public.profiles (id) on delete cascade, -- null = exercício do sistema
  created_at timestamptz not null default now()
);

create index exercises_instrument_idx on public.exercises (instrument_id);
create index exercises_created_by_idx on public.exercises (created_by);

-- ============ practice_sessions ============
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(), -- o app pode gerar o id (sincronização offline idempotente)
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  instrument_id text not null references public.instruments (id),
  exercise_id uuid references public.exercises (id) on delete set null,
  started_at timestamptz not null default now(),
  duration_seconds integer not null check (duration_seconds between 0 and 43200),
  bpm_start smallint check (bpm_start between 20 and 400),
  bpm_max smallint check (bpm_max between 20 and 400),
  notes text,
  xp_earned integer not null default 0,
  created_at timestamptz not null default now()
);

create index practice_sessions_user_started_idx
  on public.practice_sessions (user_id, started_at desc);
create index practice_sessions_instrument_idx on public.practice_sessions (instrument_id);
create index practice_sessions_exercise_idx on public.practice_sessions (exercise_id);

-- XP calculado no servidor (o cliente não define): 20 XP a cada 10 min, máx. 200 por sessão
create or replace function public.practice_sessions_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.xp_earned := least((new.duration_seconds / 600) * 20, 200);
  return new;
end;
$$;

create trigger practice_sessions_before_insert
before insert on public.practice_sessions
for each row execute function public.practice_sessions_before_insert();

-- Atualiza XP, nível, tempo total e sequência do perfil
create or replace function public.practice_sessions_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_day date := (new.started_at at time zone 'America/Sao_Paulo')::date;
  p public.profiles%rowtype;
  new_streak integer;
begin
  select * into p from public.profiles where id = new.user_id for update;

  new_streak := p.streak_days;
  if p.last_practice_date is null or session_day > p.last_practice_date then
    if p.last_practice_date is not null and session_day = p.last_practice_date + 1 then
      new_streak := p.streak_days + 1;
    else
      new_streak := 1;
    end if;
    p.last_practice_date := session_day;
  end if;

  update public.profiles
  set xp = p.xp + new.xp_earned,
      level = floor(sqrt((p.xp + new.xp_earned) / 100.0))::int + 1,
      total_practice_seconds = p.total_practice_seconds + new.duration_seconds,
      streak_days = new_streak,
      last_practice_date = p.last_practice_date
  where id = new.user_id;

  -- Conquista "Primeiro Passo"
  insert into public.user_achievements (user_id, achievement_id)
  values (new.user_id, 'first_step')
  on conflict do nothing;

  return new;
end;
$$;

create trigger practice_sessions_after_insert
after insert on public.practice_sessions
for each row execute function public.practice_sessions_after_insert();

revoke execute on function public.practice_sessions_after_insert() from public, anon, authenticated;
revoke execute on function public.practice_sessions_before_insert() from public, anon, authenticated;

-- ============ achievements ============
create table public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  xp_reward integer not null default 0,
  is_secret boolean not null default false
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create index user_achievements_achievement_idx on public.user_achievements (achievement_id);

insert into public.achievements (id, name, description, xp_reward, is_secret) values
  ('first_step', 'Primeiro Passo', 'Complete o primeiro treino.', 0, false),
  ('discipline', 'Disciplina', 'Pratique por 7 dias consecutivos.', 100, false),
  ('tireless', 'Incansável', 'Acumule 10 horas de prática.', 100, false),
  ('speedster', 'Velocista', 'Supere um recorde de BPM com qualidade.', 40, false),
  ('rhythm_master', 'Mestre do Ritmo', 'Complete 50 exercícios rítmicos.', 150, false),
  ('perfectionist', 'Perfeccionista', 'Atinja o critério de precisão em 10 exercícios.', 150, false),
  ('multi_instrumentalist', 'Multinstrumentista', 'Pratique 3 instrumentos diferentes.', 100, false),
  ('centenary', 'Centenário', 'Complete 100 sessões de treino.', 200, false);

-- ============ Ranking ============
create or replace function public.get_leaderboard(max_rows integer default 50)
returns table (rank_position bigint, user_id uuid, nickname text, avatar_url text, xp integer, level integer)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by p.xp desc, p.created_at) as rank_position,
         p.id, p.nickname, p.avatar_url, p.xp, p.level
  from public.profiles p
  where p.nickname is not null
  order by p.xp desc, p.created_at
  limit least(greatest(max_rows, 1), 100);
$$;

revoke execute on function public.get_leaderboard(integer) from public, anon;
grant execute on function public.get_leaderboard(integer) to authenticated;

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.instruments enable row level security;
alter table public.user_instruments enable row level security;
alter table public.exercises enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

create policy "profiles: ler o próprio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: atualizar o próprio" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- XP, nível e sequência só mudam via triggers: o app só edita estes campos
revoke update on public.profiles from authenticated;
grant update (full_name, nickname, avatar_url) on public.profiles to authenticated;

create policy "instruments: leitura" on public.instruments
  for select to authenticated using (true);

create policy "user_instruments: ler os próprios" on public.user_instruments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "user_instruments: inserir os próprios" on public.user_instruments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_instruments: atualizar os próprios" on public.user_instruments
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_instruments: apagar os próprios" on public.user_instruments
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "exercises: ler do sistema e próprios" on public.exercises
  for select to authenticated using (created_by is null or created_by = (select auth.uid()));
create policy "exercises: criar próprios" on public.exercises
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "exercises: atualizar próprios" on public.exercises
  for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "exercises: apagar próprios" on public.exercises
  for delete to authenticated using (created_by = (select auth.uid()));

create policy "sessions: ler as próprias" on public.practice_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "sessions: inserir as próprias" on public.practice_sessions
  for insert to authenticated with check (user_id = (select auth.uid()));
-- sem update/delete: sessões são histórico imutável (XP já foi creditado)

create policy "achievements: leitura" on public.achievements
  for select to authenticated using (true);

create policy "user_achievements: ler as próprias" on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()));
-- inserção apenas via triggers/funções do servidor

-- ============ Storage: fotos de perfil ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: enviar na própria pasta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: atualizar na própria pasta" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: apagar na própria pasta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
