create extension if not exists pg_cron with schema extensions;

create or replace function public.purge_expired_messages(retention_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if retention_days < 1 then
    raise exception 'retention_days must be >= 1';
  end if;

  delete from public.messages
  where created_at < timezone('utc', now()) - make_interval(days => retention_days);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_messages(integer) from public;
grant execute on function public.purge_expired_messages(integer) to service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'purge-expired-messages'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'purge-expired-messages',
    '13 3 * * *',
    $$select public.purge_expired_messages(30);$$
  );
end;
$$;
