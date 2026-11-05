-- Se o usuário já praticou antes de o desafio do período ser criado,
-- o desafio nasce concluído e o bônus de XP é pago imediatamente (uma única vez).
create or replace function public.get_my_challenges()
returns setof public.user_challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  week_start date := date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date;
  per text;
  p_start date;
  p_end date;
  t public.challenge_templates%rowtype;
  inst_id text;
  inst_name text;
  prog integer;
  inserted integer;
begin
  if uid is null then
    return;
  end if;

  foreach per in array array['daily', 'weekly'] loop
    if per = 'daily' then
      p_start := today; p_end := today;
    else
      p_start := week_start; p_end := week_start + 6;
    end if;

    if not exists (
      select 1 from public.user_challenges
      where user_id = uid and period = per and period_start = p_start
    ) then
      select * into t from public.challenge_templates where period = per order by random() limit 1;

      inst_id := null;
      inst_name := null;
      if t.uses_instrument then
        select ui.instrument_id into inst_id
        from public.user_instruments ui
        where ui.user_id = uid
        order by random() limit 1;
        if inst_id is null then
          select i.id into inst_id from public.instruments i order by random() limit 1;
        end if;
        select i.name into inst_name from public.instruments i where i.id = inst_id;
      end if;

      prog := least(t.target, public.compute_challenge_progress(uid, inst_id, p_start, p_end));

      insert into public.user_challenges (
        user_id, template_id, period, period_start, period_end, instrument_id,
        title, description, progress, target, xp_reward, completed_at
      ) values (
        uid, t.id, per, p_start, p_end, inst_id,
        replace(t.title, '{instrument}', coalesce(inst_name, '')),
        replace(t.description, '{instrument}', coalesce(inst_name, '')),
        prog, t.target, t.xp_reward,
        case when prog >= t.target then now() else null end
      )
      on conflict (user_id, period, period_start) do nothing;
      get diagnostics inserted = row_count;

      if inserted = 1 and prog >= t.target and t.xp_reward > 0 then
        update public.profiles
        set xp = xp + t.xp_reward,
            level = floor(sqrt((xp + t.xp_reward) / 100.0))::int + 1
        where id = uid;
      end if;
    end if;
  end loop;

  return query
    select * from public.user_challenges
    where user_id = uid
      and ((period = 'daily' and period_start = today) or (period = 'weekly' and period_start = week_start))
    order by period;
end;
$$;
