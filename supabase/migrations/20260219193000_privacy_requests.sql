create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  actor_parent_id uuid references public.parents(id) on delete set null,
  request_type text not null check (request_type in ('export', 'delete')),
  status text not null check (status in ('queued', 'processing', 'completed', 'failed')),
  reason text,
  error_message text,
  client_address text,
  user_agent text,
  result_json jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index if not exists idx_privacy_requests_parent_requested
  on public.privacy_requests(parent_id, requested_at desc);

alter table public.privacy_requests enable row level security;

create policy privacy_requests_parent_access
  on public.privacy_requests
  for all
  using (
    parent_id in (
      select p.id from public.parents p where p.auth_user_id = auth.uid()
    )
  )
  with check (
    parent_id in (
      select p.id from public.parents p where p.auth_user_id = auth.uid()
    )
  );
