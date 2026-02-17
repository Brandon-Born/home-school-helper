# DB Schema And RLS (Supabase)

## Goals
- Isolate household data by parent account.
- Prevent child clients from reading hidden parent guidance.
- Support auditable tutor interactions.

## Tables
1. `parents`
- `id uuid pk`
- `auth_user_id uuid unique not null`
- `created_at timestamptz default now()`

2. `children`
- `id uuid pk`
- `parent_id uuid not null references parents(id)`
- `first_name text not null`
- `age int not null`
- `grade text not null`
- `subjects jsonb not null default '[]'::jsonb`
- `profile_notes text`
- `special_needs text`
- `created_at timestamptz default now()`

3. `sessions`
- `id uuid pk`
- `child_id uuid not null references children(id)`
- `parent_id uuid not null references parents(id)`
- `status text not null check (status in ('active','ended','paused'))`
- `daily_context jsonb not null default '{}'::jsonb`
- `started_at timestamptz default now()`
- `ended_at timestamptz`

4. `session_codes`
- `id uuid pk`
- `session_id uuid not null references sessions(id)`
- `code_hash text not null unique`
- `expires_at timestamptz not null`
- `redeemed_at timestamptz`
- `redeemed_device_fingerprint text`

5. `messages`
- `id uuid pk`
- `session_id uuid not null references sessions(id)`
- `actor_type text not null check (actor_type in ('parent','child','assistant','system'))`
- `visibility_scope text not null check (visibility_scope in ('parent_only','child_and_parent'))`
- `content text not null`
- `policy_flags jsonb not null default '[]'::jsonb`
- `created_at timestamptz default now()`

6. `overrides`
- `id uuid pk`
- `session_id uuid not null references sessions(id)`
- `parent_id uuid not null references parents(id)`
- `enabled boolean not null`
- `expires_at timestamptz not null`
- `created_at timestamptz default now()`

7. `policy_events`
- `id uuid pk`
- `session_id uuid not null references sessions(id)`
- `event_type text not null`
- `action_taken text not null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz default now()`

## Indexes
- `children(parent_id)`
- `sessions(parent_id, child_id, status)`
- `messages(session_id, created_at)`
- `session_codes(session_id, expires_at)`
- `policy_events(session_id, created_at)`

## RLS Model
Enable RLS on all user-facing tables.

Parent access rule:
- Parent can access rows where `parent_id` maps to their `auth.uid()` through `parents.auth_user_id`.

Child session access rule:
- Child does not get broad DB access.
- Child uses scoped server-issued session token and server APIs for reads/writes.

Message visibility rule:
- Parent sees all messages in authorized sessions.
- Child can only read messages with `visibility_scope='child_and_parent'`.

## Example Parent Policy Pattern
```sql
create policy "parents_select_children"
on public.children
for select
using (
  parent_id in (
    select p.id from public.parents p where p.auth_user_id = auth.uid()
  )
);
```

## Migration Notes
- Keep SQL migrations in ordered files under `supabase/migrations/`.
- Every schema or policy change requires an ADR update and handoff log entry.
