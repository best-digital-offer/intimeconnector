create table if not exists public.oauth_authorization_codes (
  id text primary key default gen_random_uuid()::text,
  code_hash text unique not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  scope text not null default 'mcp',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_oauth_codes_expires on public.oauth_authorization_codes(expires_at);
alter table public.oauth_authorization_codes enable row level security;
