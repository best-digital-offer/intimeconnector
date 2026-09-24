-- Harden usage reservation: reject invalid units and reset only the requesting user's expired period.
create or replace function public.reset_expired_usage_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.usage u
  set actions_count=0,
      period_start=now(),
      period_end=now()+interval '1 month',
      updated_at=now(),
      actions_limit=coalesce((
        select p.actions_limit
        from public.subscriptions s
        join public.plans p on p.id=s.plan_id
        where s.user_id=u.user_id and s.status in ('active','trialing')
        order by s.updated_at desc
        limit 1
      ),25)
  where u.user_id=p_user_id and u.period_end <= now();
end;
$$;

create or replace function public.reserve_usage(
  p_user_id uuid,
  p_request_id text,
  p_action_name text,
  p_units integer default 1
)
returns table(allowed boolean, actions_count integer, actions_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if p_units is null or p_units <= 0 or p_units > 100 then
    raise exception 'invalid_usage_units';
  end if;

  perform public.reset_expired_usage_for_user(p_user_id);

  select u.actions_count,u.actions_limit into v_count,v_limit
  from public.usage u
  where u.user_id=p_user_id
  order by u.period_start desc
  limit 1
  for update;

  if v_count is null then
    raise exception 'usage_not_initialized';
  end if;

  if v_count + p_units > v_limit then
    return query select false,v_count,v_limit;
    return;
  end if;

  update public.usage
  set actions_count=actions_count+p_units,updated_at=now()
  where user_id=p_user_id
    and period_start=(select max(period_start) from public.usage where user_id=p_user_id);

  insert into public.usage_events(id,user_id,request_id,action_name,consumed_units)
  values(gen_random_uuid()::text,p_user_id,p_request_id,p_action_name,p_units);

  return query select true,v_count+p_units,v_limit;
end;
$$;
