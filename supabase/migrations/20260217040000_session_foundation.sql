create extension if not exists pgcrypto;

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text,
  full_name text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  first_name text not null,
  age integer not null,
  grade text not null,
  subjects jsonb not null default '[]'::jsonb,
  profile_notes text,
  special_needs text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  status text not null check (status in ('active', 'paused', 'ended')),
  daily_context jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz
);

create table if not exists public.session_codes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_device_fingerprint text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.child_session_tokens (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  actor_type text not null check (actor_type in ('parent', 'child', 'assistant', 'system')),
  visibility_scope text not null check (visibility_scope in ('parent_only', 'child_and_parent')),
  content text not null,
  policy_flags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.overrides (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  enabled boolean not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.policy_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  event_type text not null,
  action_taken text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_children_parent_id on public.children(parent_id);
create index if not exists idx_sessions_parent_child_status on public.sessions(parent_id, child_id, status);
create index if not exists idx_messages_session_id_created_at on public.messages(session_id, created_at);
create index if not exists idx_session_codes_session_id_expires_at on public.session_codes(session_id, expires_at);
create index if not exists idx_policy_events_session_id_created_at on public.policy_events(session_id, created_at);
create index if not exists idx_child_session_tokens_session_id_expires_at on public.child_session_tokens(session_id, expires_at);

create unique index if not exists idx_one_active_session_per_child
  on public.sessions(child_id)
  where status = 'active';

alter table public.parents enable row level security;
alter table public.children enable row level security;
alter table public.sessions enable row level security;
alter table public.session_codes enable row level security;
alter table public.child_session_tokens enable row level security;
alter table public.messages enable row level security;
alter table public.overrides enable row level security;
alter table public.policy_events enable row level security;

create policy parents_select_self
  on public.parents
  for select
  using (auth.uid() = auth_user_id);

create policy parents_insert_self
  on public.parents
  for insert
  with check (auth.uid() = auth_user_id);

create policy parents_update_self
  on public.parents
  for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy children_parent_access
  on public.children
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

create policy sessions_parent_access
  on public.sessions
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

create policy session_codes_parent_access
  on public.session_codes
  for all
  using (
    session_id in (
      select s.id
      from public.sessions s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid()
    )
  )
  with check (
    session_id in (
      select s.id
      from public.sessions s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

create policy child_session_tokens_parent_access
  on public.child_session_tokens
  for all
  using (
    session_id in (
      select s.id
      from public.sessions s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid()
    )
  )
  with check (
    session_id in (
      select s.id
      from public.sessions s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

create policy messages_parent_access
  on public.messages
  for all
  using (
    session_id in (
      select s.id
      from public.sessions s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid()
    )
  )
  with check (
    session_id in (
      select s.id
      from public.sessions s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid()
    )
  );

create policy overrides_parent_access
  on public.overrides
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

create policy policy_events_parent_access
  on public.policy_events
  for all
  using (
    session_id in (
      select s.id
      from public.sessions s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid()
    )
  )
  with check (
    session_id in (
      select s.id
      from public.sessions s
      join public.parents p on p.id = s.parent_id
      where p.auth_user_id = auth.uid()
    )
  );
