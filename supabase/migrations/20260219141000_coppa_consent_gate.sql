alter table public.parents
  add column if not exists coppa_consent_status text not null default 'pending',
  add column if not exists coppa_consent_updated_at timestamptz,
  add column if not exists coppa_policy_version text,
  add column if not exists coppa_consent_method text;

alter table public.parents
  drop constraint if exists parents_coppa_consent_status_check;

alter table public.parents
  add constraint parents_coppa_consent_status_check
  check (coppa_consent_status in ('pending', 'granted', 'revoked'));

create table if not exists public.parent_consents (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  status text not null check (status in ('granted', 'revoked')),
  method text not null,
  policy_version text not null,
  policy_url text not null default '/privacy',
  actor_parent_id uuid references public.parents(id) on delete set null,
  client_address text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_parent_consents_parent_created_at
  on public.parent_consents(parent_id, created_at desc);

alter table public.parent_consents enable row level security;

create policy parent_consents_parent_access
  on public.parent_consents
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
