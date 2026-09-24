create table if not exists public.billing_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
alter table public.billing_webhook_events enable row level security;
