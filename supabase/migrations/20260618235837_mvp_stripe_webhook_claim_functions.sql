create or replace function private.map_stripe_subscription_status(p_status text)
returns public.membership_status
language sql
stable
set search_path = ''
as $$
  select case p_status
    when 'active' then 'active'::public.membership_status
    when 'trialing' then 'trialing'::public.membership_status
    when 'past_due' then 'past_due'::public.membership_status
    when 'unpaid' then 'past_due'::public.membership_status
    when 'incomplete' then 'past_due'::public.membership_status
    when 'paused' then 'past_due'::public.membership_status
    when 'canceled' then 'cancelled'::public.membership_status
    when 'cancelled' then 'cancelled'::public.membership_status
    when 'incomplete_expired' then 'expired'::public.membership_status
    else null
  end
$$;

revoke all on function private.map_stripe_subscription_status(text) from public, anon, authenticated;
grant execute on function private.map_stripe_subscription_status(text) to service_role;

create or replace function private.claim_stripe_webhook_event(
  p_stripe_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_stripe_event_created_at timestamptz,
  p_livemode boolean,
  p_lease_seconds integer default 600,
  p_max_attempts integer default 5
)
returns table(result text, webhook_event_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_status text;
  v_attempts integer;
  v_lease_expired boolean;
begin
  if p_stripe_event_id is null or p_stripe_event_id = '' then
    raise exception 'stripe_event_id is required';
  end if;

  insert into public.stripe_webhook_events (
    stripe_event_id, event_type, payload, processed, status,
    processing_started_at, processing_lease_expires_at, attempt_count,
    stripe_event_created_at, livemode, error, last_error, ignored_reason
  ) values (
    p_stripe_event_id, p_event_type, p_payload, false, 'processing',
    now(), now() + make_interval(secs => p_lease_seconds), 1,
    p_stripe_event_created_at, p_livemode, null, null, null
  )
  on conflict (stripe_event_id) do nothing
  returning id into v_id;

  if v_id is not null then
    result := 'claimed'; webhook_event_id := v_id; return next; return;
  end if;

  select id, status, attempt_count, coalesce(processing_lease_expires_at < now(), true)
  into v_id, v_status, v_attempts, v_lease_expired
  from public.stripe_webhook_events
  where stripe_event_id = p_stripe_event_id
  for update;

  if v_status in ('processed', 'processed_ignored', 'processed_ignored_stale') then
    result := 'already_processed'; webhook_event_id := v_id; return next; return;
  end if;

  if v_attempts >= p_max_attempts then
    update public.stripe_webhook_events
    set status = 'failed_permanent', processed = true, processed_at = now(),
        error = coalesce(error, 'retry exhausted'),
        last_error = coalesce(last_error, 'retry exhausted')
    where id = v_id;
    result := 'retry_exhausted'; webhook_event_id := v_id; return next; return;
  end if;

  if v_status = 'processing' and not v_lease_expired then
    result := 'already_processing'; webhook_event_id := v_id; return next; return;
  end if;

  update public.stripe_webhook_events
  set event_type = p_event_type,
      payload = p_payload,
      status = 'processing',
      processed = false,
      processing_started_at = now(),
      processing_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_count = attempt_count + 1,
      stripe_event_created_at = coalesce(stripe_event_created_at, p_stripe_event_created_at),
      livemode = coalesce(livemode, p_livemode),
      error = null,
      last_error = null,
      ignored_reason = null
  where id = v_id;

  result := case when v_status = 'processing' then 'reclaimed_after_timeout' else 'claimed' end;
  webhook_event_id := v_id;
  return next;
end
$$;

revoke all on function private.claim_stripe_webhook_event(text, text, jsonb, timestamptz, boolean, integer, integer) from public, anon, authenticated;
grant execute on function private.claim_stripe_webhook_event(text, text, jsonb, timestamptz, boolean, integer, integer) to service_role;

create or replace function private.mark_stripe_webhook_event(
  p_stripe_event_id text,
  p_status text,
  p_error text default null,
  p_ignored_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('processed','processed_ignored','processed_ignored_stale','failed_retryable','failed_permanent') then
    raise exception 'Invalid webhook terminal status: %', p_status;
  end if;

  update public.stripe_webhook_events
  set status = p_status,
      processed = p_status in ('processed', 'processed_ignored', 'processed_ignored_stale', 'failed_permanent'),
      processed_at = case when p_status in ('processed', 'processed_ignored', 'processed_ignored_stale', 'failed_permanent') then now() else null end,
      processing_started_at = null,
      processing_lease_expires_at = null,
      error = p_error,
      last_error = p_error,
      ignored_reason = p_ignored_reason
  where stripe_event_id = p_stripe_event_id;
end
$$;

revoke all on function private.mark_stripe_webhook_event(text, text, text, text) from public, anon, authenticated;
grant execute on function private.mark_stripe_webhook_event(text, text, text, text) to service_role;

create or replace function public.internal_claim_stripe_webhook_event(
  p_stripe_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_stripe_event_created_at timestamptz,
  p_livemode boolean,
  p_lease_seconds integer default 600,
  p_max_attempts integer default 5
)
returns table(result text, webhook_event_id bigint)
language sql
security definer
set search_path = ''
as $$
  select * from private.claim_stripe_webhook_event(
    p_stripe_event_id, p_event_type, p_payload, p_stripe_event_created_at,
    p_livemode, p_lease_seconds, p_max_attempts
  );
$$;

create or replace function public.internal_mark_stripe_webhook_event(
  p_stripe_event_id text,
  p_status text,
  p_error text default null,
  p_ignored_reason text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.mark_stripe_webhook_event(p_stripe_event_id, p_status, p_error, p_ignored_reason);
$$;

revoke all on function public.internal_claim_stripe_webhook_event(text, text, jsonb, timestamptz, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.internal_mark_stripe_webhook_event(text, text, text, text) from public, anon, authenticated;
grant execute on function public.internal_claim_stripe_webhook_event(text, text, jsonb, timestamptz, boolean, integer, integer) to service_role;
grant execute on function public.internal_mark_stripe_webhook_event(text, text, text, text) to service_role;
