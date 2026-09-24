-- Just-in-Time Connector production schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null default '',
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id text primary key,
  name text not null,
  tier text not null unique check (tier in ('free','starter','pro','business')),
  price_monthly numeric(10,2) not null default 0,
  actions_limit integer not null check (actions_limit > 0),
  connections_limit integer not null check (connections_limit > 0),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  stripe_price_id text,
  usage_count_mode text not null default 'attempted' check (usage_count_mode in ('attempted','successful')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null check (status in ('active','canceled','past_due','trialing','incomplete','expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connections (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  endpoint_url text not null,
  http_method text not null check (http_method in ('GET','POST','PUT','PATCH','DELETE')),
  auth_type text not null check (auth_type in ('none','bearer','api_key','basic')),
  headers jsonb not null default '{}'::jsonb,
  query_params jsonb not null default '{}'::jsonb,
  timeout_ms integer not null default 8000 check (timeout_ms between 1000 and 15000),
  retry_count integer not null default 2 check (retry_count between 0 and 3),
  status text not null default 'active' check (status in ('active','paused','error')),
  last_tested_at timestamptz,
  last_test_status integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connection_credentials (
  id text primary key,
  connection_id text not null unique references public.connections(id) on delete cascade,
  secret_type text not null check (secret_type in ('bearer','api_key','basic')),
  encrypted_secret text not null,
  iv text not null,
  auth_tag text not null,
  masked_preview text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.transformations (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_id text references public.connections(id) on delete set null,
  name text not null,
  description text not null default '',
  mode text not null check (mode in ('visual','template','ai_prompt')),
  rules jsonb not null default '[]'::jsonb,
  template_json text,
  ai_system_instructions text,
  sample_input text not null default '',
  sample_output text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transformation_versions (
  id text primary key,
  transformation_id text not null references public.transformations(id) on delete cascade,
  version_num integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.requests (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  connection_id text not null references public.connections(id) on delete cascade,
  transformation_id text,
  action_type text not null check (action_type in ('web_dashboard','mcp_tool','api_key','test_run')),
  status text not null check (status in ('success','failed','timeout','blocked','retrying')),
  http_status integer,
  duration_ms integer not null default 0,
  endpoint_domain text not null default '',
  endpoint_path text not null default '',
  masked_request_payload text not null default '',
  safe_response_preview text not null default '',
  error_message text,
  idempotency_key text,
  correlation_id text not null,
  attempts_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);

create table if not exists public.request_attempts (
  id text primary key,
  request_id text not null references public.requests(id) on delete cascade,
  attempt_number integer not null,
  status text not null,
  http_status integer,
  error_message text,
  latency_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.usage (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  actions_count integer not null default 0,
  actions_limit integer not null,
  updated_at timestamptz not null default now(),
  unique(user_id, period_start)
);

create table if not exists public.usage_events (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id text not null references public.requests(id) on delete cascade,
  action_name text not null,
  consumed_units integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_clients (
  id text primary key,
  client_id text unique not null,
  client_secret_hash text,
  client_name text not null,
  redirect_uris jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_tokens (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null,
  token_hash text unique not null,
  token_type text not null default 'Bearer',
  scopes jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  blocked boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text unique not null,
  scopes jsonb not null default '[]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  is_revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id text not null,
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique(team_id,user_id)
);

create table if not exists public.support_tickets (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_actions (
  id text primary key,
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_user_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_connections_user on public.connections(user_id);
create index if not exists idx_transformations_user on public.transformations(user_id);
create index if not exists idx_requests_user_created on public.requests(user_id,created_at desc);
create index if not exists idx_security_user_created on public.security_events(user_id,created_at desc);
create index if not exists idx_usage_events_user_created on public.usage_events(user_id,created_at desc);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.connections enable row level security;
alter table public.connection_credentials enable row level security;
alter table public.transformations enable row level security;
alter table public.transformation_versions enable row level security;
alter table public.requests enable row level security;
alter table public.request_attempts enable row level security;
alter table public.usage enable row level security;
alter table public.usage_events enable row level security;
alter table public.oauth_clients enable row level security;
alter table public.oauth_tokens enable row level security;
alter table public.audit_logs enable row level security;
alter table public.security_events enable row level security;
alter table public.api_keys enable row level security;
alter table public.team_members enable row level security;
alter table public.support_tickets enable row level security;
alter table public.admin_actions enable row level security;
alter table public.system_settings enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

insert into public.plans (id,name,tier,price_monthly,actions_limit,connections_limit,features)
values
('plan_free','Free','free',0,25,1,'["Basic transformations","Request history","ChatGPT connection","Basic webhook support"]'),
('plan_starter','Starter','starter',5,500,10,'["Advanced transformations","Retries","Logs","ChatGPT MCP","API/webhook integrations"]'),
('plan_pro','Pro','pro',15,5000,50,'["Advanced transformations","Higher limits","Retries","Detailed logs","Multiple auth methods","Priority processing"]'),
('plan_business','Business','business',39,25000,200,'["Team support","Advanced security","Audit logs","Higher limits","Priority support","Advanced API controls"]')
on conflict (id) do update set
name=excluded.name,tier=excluded.tier,price_monthly=excluded.price_monthly,
actions_limit=excluded.actions_limit,connections_limit=excluded.connections_limit,features=excluded.features,updated_at=now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'name','');
  insert into public.profiles(id,email,name)
  values(new.id, new.email, v_name)
  on conflict (id) do update set email=excluded.email, name=coalesce(nullif(excluded.name,''),profiles.name), updated_at=now();
  insert into public.subscriptions(id,user_id,plan_id,status,current_period_start,current_period_end,provider)
  values(gen_random_uuid()::text,new.id,'plan_free','active',now(),now()+interval '1 month','manual')
  on conflict do nothing;
  insert into public.usage(id,user_id,period_start,period_end,actions_count,actions_limit)
  values(gen_random_uuid()::text,new.id,now(),now()+interval '1 month',0,25)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.reset_expired_usage()
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
      actions_limit=coalesce((select p.actions_limit from public.subscriptions s join public.plans p on p.id=s.plan_id where s.user_id=u.user_id and s.status in ('active','trialing') limit 1),25)
  where u.period_end <= now();
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
  perform public.reset_expired_usage();

  select u.actions_count,u.actions_limit into v_count,v_limit
  from public.usage u where u.user_id=p_user_id
  order by u.period_start desc limit 1 for update;

  if v_count is null then
    raise exception 'usage_not_initialized';
  end if;

  if v_count + p_units > v_limit then
    return query select false,v_count,v_limit;
    return;
  end if;

  update public.usage set actions_count=actions_count+p_units,updated_at=now()
  where user_id=p_user_id and period_start=(select max(period_start) from public.usage where user_id=p_user_id);

  insert into public.usage_events(id,user_id,request_id,action_name,consumed_units)
  values(gen_random_uuid()::text,p_user_id,p_request_id,p_action_name,p_units);

  return query select true,v_count+p_units,v_limit;
end;
$$;
