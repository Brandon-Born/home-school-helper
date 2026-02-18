alter table public.sessions
  add column if not exists active_join_code text,
  add column if not exists active_join_code_expires_at timestamptz;

create table if not exists public.rate_limit_buckets (
  scope text not null,
  client_address text not null,
  key_suffix text not null default '-',
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (scope, client_address, key_suffix)
);

create index if not exists idx_rate_limit_buckets_reset_at
  on public.rate_limit_buckets(reset_at);

alter table public.rate_limit_buckets enable row level security;

create or replace function public.acquire_rate_limit_slot(
  p_scope text,
  p_client_address text,
  p_key_suffix text,
  p_max_requests integer,
  p_window_ms integer
)
returns table(allowed boolean, request_count integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope text := coalesce(nullif(trim(p_scope), ''), 'unknown_scope');
  v_client text := coalesce(nullif(trim(p_client_address), ''), 'unknown_client');
  v_suffix text := coalesce(nullif(trim(p_key_suffix), ''), '-');
  v_max integer := greatest(coalesce(p_max_requests, 1), 1);
  v_window_ms integer := greatest(coalesce(p_window_ms, 1000), 1000);
  v_now timestamptz := timezone('utc', now());
  v_row public.rate_limit_buckets%rowtype;
begin
  insert into public.rate_limit_buckets as buckets (
    scope,
    client_address,
    key_suffix,
    count,
    reset_at,
    updated_at
  )
  values (
    v_scope,
    v_client,
    v_suffix,
    1,
    v_now + ((v_window_ms || ' milliseconds')::interval),
    v_now
  )
  on conflict (scope, client_address, key_suffix)
  do update
    set count = case
      when buckets.reset_at <= v_now then 1
      else buckets.count + 1
    end,
    reset_at = case
      when buckets.reset_at <= v_now then v_now + ((v_window_ms || ' milliseconds')::interval)
      else buckets.reset_at
    end,
    updated_at = v_now
  returning * into v_row;

  allowed := v_row.count <= v_max;
  request_count := v_row.count;
  reset_at := v_row.reset_at;
  return next;
end;
$$;

revoke all on function public.acquire_rate_limit_slot(text, text, text, integer, integer) from public;
revoke all on function public.acquire_rate_limit_slot(text, text, text, integer, integer) from anon;
revoke all on function public.acquire_rate_limit_slot(text, text, text, integer, integer) from authenticated;
grant execute on function public.acquire_rate_limit_slot(text, text, text, integer, integer) to service_role;
