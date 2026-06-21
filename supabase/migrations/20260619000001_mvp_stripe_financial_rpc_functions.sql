create or replace function private.apply_stripe_invoice_paid(
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_user_id uuid,
  p_plan_key public.membership_plan_key,
  p_course_id bigint,
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_stripe_price_id text,
  p_subscription_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_stripe_invoice_id text,
  p_stripe_payment_intent_id text,
  p_amount integer,
  p_currency text,
  p_livemode boolean,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mapped_status public.membership_status;
  v_membership_id bigint;
  v_existing_event_created_at timestamptz;
  v_existing_entitlement_event_created_at timestamptz;
begin
  if p_stripe_subscription_id is null or p_stripe_subscription_id = '' then
    raise exception 'stripe_subscription_id is required';
  end if;

  v_mapped_status := private.map_stripe_subscription_status(p_subscription_status);
  if v_mapped_status is null then
    raise exception 'Unknown Stripe subscription status: %', p_subscription_status;
  end if;
  if v_mapped_status <> 'active'::public.membership_status then
    raise exception 'invoice.paid cannot activate non-active subscription status: %', p_subscription_status;
  end if;

  select last_stripe_event_created_at into v_existing_event_created_at
  from public.memberships
  where stripe_subscription_id = p_stripe_subscription_id
  for update;

  if v_existing_event_created_at is not null and p_stripe_event_created_at < v_existing_event_created_at then
    return jsonb_build_object('result', 'processed_ignored_stale', 'membership_id', null);
  end if;

  select id into v_membership_id
  from public.memberships
  where stripe_subscription_id = p_stripe_subscription_id
  for update;

  if v_membership_id is null then
    insert into public.memberships (
      user_id, plan_key, status, starts_at, ends_at, stripe_subscription_id,
      source, metadata, last_stripe_event_id, last_stripe_event_created_at, last_synced_at
    ) values (
      p_user_id, p_plan_key, 'active', p_current_period_start, p_current_period_end,
      p_stripe_subscription_id, 'stripe', p_metadata, p_stripe_event_id,
      p_stripe_event_created_at, now()
    ) returning id into v_membership_id;
  else
    update public.memberships
    set user_id = p_user_id,
        plan_key = p_plan_key,
        status = 'active',
        starts_at = least(starts_at, p_current_period_start),
        ends_at = greatest(ends_at, p_current_period_end),
        metadata = p_metadata,
        last_stripe_event_id = p_stripe_event_id,
        last_stripe_event_created_at = p_stripe_event_created_at,
        last_synced_at = now(),
        updated_at = now()
    where id = v_membership_id;
  end if;

  insert into public.stripe_subscriptions (
    user_id, membership_id, stripe_subscription_id, stripe_customer_id, stripe_price_id,
    status, current_period_start, current_period_end, cancel_at_period_end, metadata,
    livemode, last_stripe_event_id, last_stripe_event_created_at, last_synced_at
  ) values (
    p_user_id, v_membership_id, p_stripe_subscription_id, p_stripe_customer_id,
    p_stripe_price_id, p_subscription_status, p_current_period_start, p_current_period_end,
    coalesce(p_cancel_at_period_end, false), p_metadata, p_livemode, p_stripe_event_id,
    p_stripe_event_created_at, now()
  ) on conflict (stripe_subscription_id) do update set
    user_id = excluded.user_id,
    membership_id = excluded.membership_id,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_price_id = excluded.stripe_price_id,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    metadata = excluded.metadata,
    livemode = excluded.livemode,
    last_stripe_event_id = excluded.last_stripe_event_id,
    last_stripe_event_created_at = excluded.last_stripe_event_created_at,
    last_synced_at = now(),
    updated_at = now()
  where public.stripe_subscriptions.last_stripe_event_created_at is null
     or excluded.last_stripe_event_created_at >= public.stripe_subscriptions.last_stripe_event_created_at;

  if p_stripe_payment_intent_id is not null and p_stripe_payment_intent_id <> '' then
    insert into public.stripe_payments (
      user_id, stripe_payment_intent_id, stripe_invoice_id, stripe_subscription_id,
      amount, currency, status, paid_at, metadata, livemode,
      last_stripe_event_id, last_stripe_event_created_at, last_synced_at
    ) values (
      p_user_id, p_stripe_payment_intent_id, p_stripe_invoice_id, p_stripe_subscription_id,
      p_amount, p_currency, 'paid', now(), p_metadata, p_livemode,
      p_stripe_event_id, p_stripe_event_created_at, now()
    ) on conflict (stripe_payment_intent_id) do update set
      user_id = excluded.user_id,
      stripe_invoice_id = excluded.stripe_invoice_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      amount = excluded.amount,
      currency = excluded.currency,
      status = excluded.status,
      paid_at = coalesce(public.stripe_payments.paid_at, excluded.paid_at),
      metadata = excluded.metadata,
      livemode = excluded.livemode,
      last_stripe_event_id = excluded.last_stripe_event_id,
      last_stripe_event_created_at = excluded.last_stripe_event_created_at,
      last_synced_at = now(),
      updated_at = now();
  elsif p_stripe_invoice_id is not null and p_stripe_invoice_id <> '' then
    insert into public.stripe_payments (
      user_id, stripe_invoice_id, stripe_subscription_id, amount, currency, status,
      paid_at, metadata, livemode, last_stripe_event_id, last_stripe_event_created_at, last_synced_at
    ) values (
      p_user_id, p_stripe_invoice_id, p_stripe_subscription_id, p_amount, p_currency,
      'paid', now(), p_metadata, p_livemode, p_stripe_event_id, p_stripe_event_created_at, now()
    ) on conflict (stripe_invoice_id) where stripe_invoice_id is not null do update set
      user_id = excluded.user_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      amount = excluded.amount,
      currency = excluded.currency,
      status = excluded.status,
      paid_at = coalesce(public.stripe_payments.paid_at, excluded.paid_at),
      metadata = excluded.metadata,
      livemode = excluded.livemode,
      last_stripe_event_id = excluded.last_stripe_event_id,
      last_stripe_event_created_at = excluded.last_stripe_event_created_at,
      last_synced_at = now(),
      updated_at = now();
  end if;

  if p_plan_key = 'individual_course'::public.membership_plan_key then
    if p_course_id is null then
      raise exception 'course_id is required for individual_course';
    end if;

    select last_stripe_event_created_at into v_existing_entitlement_event_created_at
    from public.course_entitlements
    where stripe_subscription_id = p_stripe_subscription_id and course_id = p_course_id
    for update;

    if v_existing_entitlement_event_created_at is not null and p_stripe_event_created_at < v_existing_entitlement_event_created_at then
      return jsonb_build_object('result', 'processed_ignored_stale', 'membership_id', v_membership_id);
    end if;

    insert into public.course_entitlements (
      user_id, course_id, source, starts_at, ends_at, active, metadata,
      stripe_subscription_id, stripe_price_id, last_stripe_event_id,
      last_stripe_event_created_at, last_synced_at
    ) values (
      p_user_id, p_course_id, 'stripe', p_current_period_start, p_current_period_end,
      true, p_metadata, p_stripe_subscription_id, p_stripe_price_id, p_stripe_event_id,
      p_stripe_event_created_at, now()
    ) on conflict (stripe_subscription_id, course_id) where stripe_subscription_id is not null do update set
      user_id = excluded.user_id,
      starts_at = least(public.course_entitlements.starts_at, excluded.starts_at),
      ends_at = greatest(public.course_entitlements.ends_at, excluded.ends_at),
      active = true,
      metadata = excluded.metadata,
      stripe_price_id = excluded.stripe_price_id,
      last_stripe_event_id = excluded.last_stripe_event_id,
      last_stripe_event_created_at = excluded.last_stripe_event_created_at,
      last_synced_at = now(),
      updated_at = now();
  end if;

  return jsonb_build_object('result', 'processed', 'membership_id', v_membership_id);
end
$$;

revoke all on function private.apply_stripe_invoice_paid(text, timestamptz, uuid, public.membership_plan_key, bigint, text, text, text, text, timestamptz, timestamptz, boolean, text, text, integer, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function private.apply_stripe_invoice_paid(text, timestamptz, uuid, public.membership_plan_key, bigint, text, text, text, text, timestamptz, timestamptz, boolean, text, text, integer, text, boolean, jsonb) to service_role;

create or replace function private.apply_stripe_subscription_state(
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_user_id uuid,
  p_stripe_subscription_id text,
  p_stripe_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.membership_status;
begin
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
$$;

revoke all on function private.apply_stripe_subscription_state(text, timestamptz, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function private.apply_stripe_subscription_state(text, timestamptz, uuid, text, text, jsonb) to service_role;

create or replace function private.apply_stripe_access_revocation(
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_stripe_subscription_id text,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
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
$$;

revoke all on function private.apply_stripe_access_revocation(text, timestamptz, text, text, jsonb) from public, anon, authenticated;
grant execute on function private.apply_stripe_access_revocation(text, timestamptz, text, text, jsonb) to service_role;
