# DB Schema And RLS (Supabase)

## Goals
- Isolate household data by parent account.
- Prevent child clients from reading hidden parent guidance.
- Support auditable tutor interactions.

## Tables
1. `parents`
- `id uuid pk`
- `auth_user_id uuid unique not null`
- `email text`
- `full_name text`
- `onboarding_completed boolean default false`
- `coppa_consent_status text not null default 'pending'` (`pending` | `granted` | `revoked`)
- `coppa_consent_updated_at timestamptz`
- `coppa_policy_version text`
- `coppa_consent_method text`
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
- partial unique index enforcing one active session per child

4. `session_codes`
- `id uuid pk`
- `session_id uuid not null references sessions(id)`
- `code_hash text not null unique`
- `expires_at timestamptz not null`
- `redeemed_at timestamptz`
- `redeemed_device_fingerprint text`
- `created_at timestamptz default now()`

5. `child_session_tokens`
- `id uuid pk`
- `session_id uuid not null references sessions(id)`
- `child_id uuid not null references children(id)`
- `token_hash text not null unique`
- `expires_at timestamptz not null`
- `revoked_at timestamptz`
- `created_at timestamptz default now()`

6. `messages`
- `id uuid pk`
- `session_id uuid not null references sessions(id)`
- `actor_type text not null check (actor_type in ('parent','child','assistant','system'))`
- `visibility_scope text not null check (visibility_scope in ('parent_only','child_and_parent'))`
- `content text not null`
- `policy_flags jsonb not null default '[]'::jsonb`
- `created_at timestamptz default now()`

7. `overrides`
- `id uuid pk`
- `session_id uuid not null references sessions(id)`
- `parent_id uuid not null references parents(id)`
- `enabled boolean not null`
- `expires_at timestamptz not null`
- `created_at timestamptz default now()`

8. `policy_events`
- `id uuid pk`
- `session_id uuid not null references sessions(id)`
- `event_type text not null`
- `action_taken text not null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz default now()`

9. `parent_consents`
- `id uuid pk`
- `parent_id uuid not null references parents(id)`
- `status text not null` (`granted` | `revoked`)
- `method text not null`
- `policy_version text not null`
- `policy_url text not null`
- `actor_parent_id uuid references parents(id)`
- `client_address text`
- `user_agent text`
- `created_at timestamptz default now()`

10. `privacy_requests`
- `id uuid pk`
- `parent_id uuid not null references parents(id)`
- `actor_parent_id uuid references parents(id)`
- `request_type text not null` (`export` | `delete`)
- `status text not null` (`queued` | `processing` | `completed` | `failed`)
- `reason text`
- `error_message text`
- `client_address text`
- `user_agent text`
- `result_json jsonb not null default '{}'::jsonb`
- `requested_at timestamptz default now()`
- `completed_at timestamptz`

11. `billing_subscriptions`
- `id uuid pk`
- `parent_id uuid not null references parents(id)`
- `provider text not null` (`stripe`)
- `provider_customer_id text not null`
- `provider_subscription_id text`
- `provider_price_id text`
- `status text not null`
- `trial_start_at timestamptz`
- `trial_end_at timestamptz`
- `current_period_start_at timestamptz`
- `current_period_end_at timestamptz`
- `cancel_at_period_end boolean not null default false`
- `canceled_at timestamptz`
- `last_webhook_event_id text`
- `last_webhook_event_created_at timestamptz`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

12. `billing_webhook_events`
- `id uuid pk`
- `provider text not null` (`stripe`)
- `provider_event_id text not null`
- `event_type text not null`
- `processed_at timestamptz`
- `payload jsonb not null`
- `created_at timestamptz default now()`

## Indexes
- `children(parent_id)`
- `sessions(parent_id, child_id, status)`
- `messages(session_id, created_at)`
- `session_codes(session_id, expires_at)`
- `child_session_tokens(session_id, expires_at)`
- `policy_events(session_id, created_at)`
- `parent_consents(parent_id, created_at desc)`
- `privacy_requests(parent_id, requested_at desc)`
- `billing_subscriptions(parent_id, updated_at desc)`
- `billing_webhook_events(provider, provider_event_id)` unique

## RLS Model
Enable RLS on all user-facing tables.

Parent access rule:
- Parent can access rows where `parent_id` maps to their `auth.uid()` through `parents.auth_user_id`.

Child session access rule:
- Child does not get broad DB access.
- Child uses scoped server-issued session token and server APIs for reads/writes.

Message visibility rule:
- Parent sees all messages in authorized sessions.
- Child receives only `visibility_scope='child_and_parent'` data through server APIs.

## Example Parent Policy Pattern
```sql
create policy parents_select_self
on public.parents
for select
using (auth.uid() = auth_user_id);
```

## Migration Notes
- SQL migrations are under `/Users/bborn/home-school-helper/supabase/migrations/`.
- Current core migrations:
  - `20260217040000_session_foundation.sql`
  - `20260217193000_transcript_retention.sql` (adds 30-day transcript purge function + daily `pg_cron` schedule)
  - `20260219141000_coppa_consent_gate.sql` (adds consent state columns + `parent_consents` audit table)
  - `20260219193000_privacy_requests.sql` (adds privacy export/delete request tracking table + RLS)
  - `20260223103000_billing_subscriptions.sql` (adds Stripe-backed billing subscription state + webhook event ledger)
- Every schema or policy change requires docs and handoff updates.
