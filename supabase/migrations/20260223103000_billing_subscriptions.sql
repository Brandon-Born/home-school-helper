create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  provider text not null,
  provider_customer_id text not null,
  provider_subscription_id text,
  provider_price_id text,
  status text not null default 'incomplete',
  trial_start_at timestamptz,
  trial_end_at timestamptz,
  current_period_start_at timestamptz,
  current_period_end_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  last_webhook_event_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_provider_check;

alter table public.billing_subscriptions
  add constraint billing_subscriptions_provider_check
  check (provider in ('stripe'));

create unique index if not exists uq_billing_subscriptions_parent_provider
  on public.billing_subscriptions(parent_id, provider);

create unique index if not exists uq_billing_subscriptions_provider_subscription
  on public.billing_subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;

create index if not exists idx_billing_subscriptions_parent_updated
  on public.billing_subscriptions(parent_id, updated_at desc);

alter table public.billing_subscriptions enable row level security;

create policy billing_subscriptions_parent_read
  on public.billing_subscriptions
  for select
  using (
    parent_id in (
      select p.id from public.parents p where p.auth_user_id = auth.uid()
    )
  );

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  processed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.billing_webhook_events
  drop constraint if exists billing_webhook_events_provider_check;

alter table public.billing_webhook_events
  add constraint billing_webhook_events_provider_check
  check (provider in ('stripe'));

create unique index if not exists uq_billing_webhook_events_provider_event
  on public.billing_webhook_events(provider, provider_event_id);

create index if not exists idx_billing_webhook_events_created_at
  on public.billing_webhook_events(created_at desc);

alter table public.billing_webhook_events enable row level security;
