-- 1) Shared duplicate detector: has this Stripe event id already been applied?
create or replace function private.stripe_event_already_applied(
  p_stripe_event_id text,
  p_stripe_subscription_id text default null,
  p_stripe_checkout_session_id text default null
) returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.last_stripe_event_id = p_stripe_event_id
      and (p_stripe_subscription_id is null or m.stripe_subscription_id = p_stripe_subscription_id)
  )
  or exists (
    select 1 from public.stripe_subscriptions s
    where s.last_stripe_event_id = p_stripe_event_id
      and (p_stripe_subscription_id is null or s.stripe_subscription_id = p_stripe_subscription_id)
  )
  or exists (
    select 1 from public.course_entitlements e
    where e.last_stripe_event_id = p_stripe_event_id
      and (
        (p_stripe_subscription_id is not null and e.stripe_subscription_id = p_stripe_subscription_id)
        or (p_stripe_checkout_session_id is not null and e.stripe_checkout_session_id = p_stripe_checkout_session_id)
      )
  )
  or exists (
    select 1 from public.stripe_payments p
    where p.last_stripe_event_id = p_stripe_event_id
      and (
        (p_stripe_subscription_id is not null and p.stripe_subscription_id = p_stripe_subscription_id)
        or (p_stripe_checkout_session_id is not null and p.stripe_checkout_session_id = p_stripe_checkout_session_id)
      )
  );
$$;

-- 2) Duplicate guard on subscription state changes
create or replace function private.apply_stripe_subscription_state(
  p_stripe_event_id text, p_stripe_event_created_at timestamptz, p_user_id uuid,
  p_stripe_subscription_id text, p_stripe_status text, p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_status public.membership_status;
begin
  if private.stripe_event_already_applied(p_stripe_event_id, p_stripe_subscription_id, null) then
    return jsonb_build_object('result', 'processed_ignored_duplicate');
  end if;

  v_status := private.map_stripe_subscription_status(p_stripe_status);
  if v_status is null then
    raise exception 'Unknown Stripe subscription status: %', p_stripe_status;
  end if;

  update public.stripe_subscriptions
  set status = p_stripe_status,
      user_id = coalesce(user_id, p_user_id),
      metadata = p_metadata,
      last_stripe_event_id = p_stripe_event_id,
      last_stripe_event_created_at = p_stripe_event_created_at,
      last_synced_at = now(),
      updated_at = now()
  where stripe_subscription_id = p_stripe_subscription_id
    and (last_stripe_event_created_at is null or p_stripe_event_created_at >= last_stripe_event_created_at);

  update public.memberships
  set status = v_status,
      metadata = p_metadata,
      last_stripe_event_id = p_stripe_event_id,
      last_stripe_event_created_at = p_stripe_event_created_at,
      last_synced_at = now(),
      updated_at = now()
  where stripe_subscription_id = p_stripe_subscription_id
    and (last_stripe_event_created_at is null or p_stripe_event_created_at >= last_stripe_event_created_at);

  if v_status <> 'active'::public.membership_status then
    update public.course_entitlements
    set active = false,
        metadata = p_metadata,
        last_stripe_event_id = p_stripe_event_id,
        last_stripe_event_created_at = p_stripe_event_created_at,
        last_synced_at = now(),
        updated_at = now()
    where stripe_subscription_id = p_stripe_subscription_id
      and (last_stripe_event_created_at is null or p_stripe_event_created_at >= last_stripe_event_created_at);
  end if;

  return jsonb_build_object('result', 'processed');
end
$function$;

-- 3) Duplicate guard on revocations (refund / dispute / cancellation)
create or replace function private.apply_stripe_access_revocation(
  p_stripe_event_id text, p_stripe_event_created_at timestamptz,
  p_stripe_subscription_id text, p_reason text, p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
begin
  if private.stripe_event_already_applied(p_stripe_event_id, p_stripe_subscription_id, null) then
    return jsonb_build_object('result', 'processed_ignored_duplicate');
  end if;

  update public.memberships
  set status = 'cancelled',
      metadata = p_metadata || jsonb_build_object('revocation_reason', p_reason),
      last_stripe_event_id = p_stripe_event_id,
      last_stripe_event_created_at = p_stripe_event_created_at,
      last_synced_at = now(),
      updated_at = now()
  where stripe_subscription_id = p_stripe_subscription_id
    and (last_stripe_event_created_at is null or p_stripe_event_created_at >= last_stripe_event_created_at);

  update public.course_entitlements
  set active = false,
      metadata = p_metadata || jsonb_build_object('revocation_reason', p_reason),
      last_stripe_event_id = p_stripe_event_id,
      last_stripe_event_created_at = p_stripe_event_created_at,
      last_synced_at = now(),
      updated_at = now()
  where stripe_subscription_id = p_stripe_subscription_id
    and (last_stripe_event_created_at is null or p_stripe_event_created_at >= last_stripe_event_created_at);

  return jsonb_build_object('result', 'processed');
end
$function$;

-- 4) Missing handler: one-time annual purchase (Payment Link / checkout in payment mode)
create or replace function private.apply_stripe_annual_payment(
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_user_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_customer_id text,
  p_stripe_price_id text,
  p_stripe_payment_intent_id text,
  p_amount integer,
  p_currency text,
  p_livemode boolean,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path to ''
as $function$
declare
  v_membership_id bigint;
  v_starts_at timestamptz := coalesce(p_stripe_event_created_at, now());
  v_ends_at timestamptz;
begin
  if p_stripe_checkout_session_id is null or p_stripe_checkout_session_id = '' then
    raise exception 'stripe_checkout_session_id is required';
  end if;
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  -- Idempotency: the same Stripe event (or the same checkout session) must
  -- never extend access twice, no matter how often Stripe redelivers it.
  if private.stripe_event_already_applied(p_stripe_event_id, null, p_stripe_checkout_session_id) then
    return jsonb_build_object('result', 'processed_ignored_duplicate');
  end if;

  if exists (
    select 1 from public.memberships
    where metadata->>'stripe_checkout_session_id' = p_stripe_checkout_session_id
  ) then
    return jsonb_build_object('result', 'processed_ignored_duplicate');
  end if;

  v_ends_at := v_starts_at + interval '12 months';

  select id into v_membership_id
  from public.memberships
  where user_id = p_user_id and plan_key = 'annual_member'::public.membership_plan_key
  order by ends_at desc
  limit 1
  for update;

  if v_membership_id is null then
    insert into public.memberships (
      user_id, plan_key, status, starts_at, ends_at, source, metadata,
      last_stripe_event_id, last_stripe_event_created_at, last_synced_at
    ) values (
      p_user_id, 'annual_member', 'active', v_starts_at, v_ends_at, 'stripe',
      p_metadata || jsonb_build_object('stripe_checkout_session_id', p_stripe_checkout_session_id),
      p_stripe_event_id, p_stripe_event_created_at, now()
    ) returning id into v_membership_id;
  else
    update public.memberships
    set status = 'active',
        starts_at = least(starts_at, v_starts_at),
        ends_at = greatest(ends_at, v_ends_at),
        source = 'stripe',
        metadata = p_metadata || jsonb_build_object('stripe_checkout_session_id', p_stripe_checkout_session_id),
        last_stripe_event_id = p_stripe_event_id,
        last_stripe_event_created_at = p_stripe_event_created_at,
        last_synced_at = now(),
        updated_at = now()
    where id = v_membership_id;
  end if;

  insert into public.stripe_customers (user_id, stripe_customer_id)
  values (p_user_id, p_stripe_customer_id)
  on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id
  ;

  insert into public.stripe_payments (
    user_id, stripe_payment_intent_id, stripe_checkout_session_id, amount, currency,
    status, paid_at, metadata, livemode, last_stripe_event_id, last_stripe_event_created_at, last_synced_at
  ) values (
    p_user_id, p_stripe_payment_intent_id, p_stripe_checkout_session_id, p_amount, p_currency,
    'paid', now(), p_metadata || jsonb_build_object('stripe_price_id', p_stripe_price_id),
    p_livemode, p_stripe_event_id, p_stripe_event_created_at, now()
  )
  on conflict (stripe_payment_intent_id) do update
  set status = 'paid',
      user_id = coalesce(public.stripe_payments.user_id, excluded.user_id),
      stripe_checkout_session_id = excluded.stripe_checkout_session_id,
      amount = excluded.amount,
      currency = excluded.currency,
      last_stripe_event_id = excluded.last_stripe_event_id,
      last_stripe_event_created_at = excluded.last_stripe_event_created_at,
      last_synced_at = now(),
      updated_at = now();

  update public.stripe_checkout_sessions
  set payment_status = 'paid',
      status = 'complete',
      user_id = coalesce(user_id, p_user_id),
      updated_at = now()
  where stripe_session_id = p_stripe_checkout_session_id;

  return jsonb_build_object('result', 'processed', 'membership_id', v_membership_id);
end
$function$;

create or replace function public.internal_apply_stripe_annual_payment(
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_user_id uuid,
  p_stripe_checkout_session_id text,
  p_stripe_customer_id text,
  p_stripe_price_id text,
  p_stripe_payment_intent_id text,
  p_amount integer,
  p_currency text,
  p_livemode boolean,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language sql security definer set search_path to ''
as $$
  select private.apply_stripe_annual_payment(
    p_stripe_event_id, p_stripe_event_created_at, p_user_id, p_stripe_checkout_session_id,
    p_stripe_customer_id, p_stripe_price_id, p_stripe_payment_intent_id, p_amount,
    p_currency, p_livemode, p_metadata
  );
$$;

revoke all on function public.internal_apply_stripe_annual_payment(text, timestamptz, uuid, text, text, text, text, integer, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.internal_apply_stripe_annual_payment(text, timestamptz, uuid, text, text, text, text, integer, text, boolean, jsonb) to service_role;