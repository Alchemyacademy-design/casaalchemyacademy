do $$
begin
  if exists (
    select 1
    from public.stripe_payments
    where stripe_checkout_session_id is not null
    group by stripe_checkout_session_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate stripe_checkout_session_id rows exist in public.stripe_payments; resolve them before applying this migration';
  end if;
end
$$;

create unique index if not exists stripe_payments_checkout_session_unique
on public.stripe_payments (stripe_checkout_session_id)
where stripe_checkout_session_id is not null;

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
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_id bigint;
  v_existing_event_created_at timestamptz;
  v_checkout_created_at timestamptz;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_access_key text := 'checkout:' || p_stripe_checkout_session_id;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if coalesce(p_stripe_event_id, '') = '' then
    raise exception 'stripe event id is required';
  end if;

  if p_stripe_event_created_at is null then
    raise exception 'stripe event created_at is required';
  end if;

  if coalesce(p_stripe_checkout_session_id, '') = '' then
    raise exception 'checkout session is required';
  end if;

  if p_stripe_price_id <> 'price_1TZhtrK9GJLTk49TgcjXU3VU' then
    raise exception 'unexpected annual Stripe Price';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'paid amount must be positive';
  end if;

  if lower(coalesce(p_currency, '')) <> 'aud' then
    raise exception 'annual payment must use AUD';
  end if;

  if not exists (
    select 1
    from public.stripe_prices
    where stripe_price_id = p_stripe_price_id
      and plan_key = 'annual_member'::public.membership_plan_key
      and course_id is null
      and lower(currency) = 'aud'
      and unit_amount = 70800
      and recurring_interval is null
      and recurring_interval_count is null
      and livemode = p_livemode
      and active = true
      and is_checkout_default = true
  ) then
    raise exception 'Stripe Price is not the configured annual one-time offer';
  end if;

  select created_at
    into v_checkout_created_at
  from public.stripe_checkout_sessions
  where stripe_session_id = p_stripe_checkout_session_id;

  v_starts_at := coalesce(v_checkout_created_at, p_stripe_event_created_at, now());
  v_ends_at := v_starts_at + interval '12 months';

  select id, last_stripe_event_created_at
    into v_membership_id, v_existing_event_created_at
  from public.memberships
  where stripe_subscription_id = v_access_key
  for update;

  if v_existing_event_created_at is not null
     and p_stripe_event_created_at < v_existing_event_created_at then
    return jsonb_build_object(
      'result', 'processed_ignored_stale',
      'membership_id', v_membership_id,
      'ends_at', v_ends_at
    );
  end if;

  if v_membership_id is null then
    insert into public.memberships (
      user_id,
      plan_key,
      status,
      starts_at,
      ends_at,
      stripe_subscription_id,
      source,
      metadata,
      last_stripe_event_id,
      last_stripe_event_created_at,
      last_synced_at
    ) values (
      p_user_id,
      'annual_member',
      'active',
      v_starts_at,
      v_ends_at,
      v_access_key,
      'stripe',
      p_metadata || jsonb_build_object(
        'stripe_checkout_session_id', p_stripe_checkout_session_id,
        'access_type', 'annual_one_time'
      ),
      p_stripe_event_id,
      p_stripe_event_created_at,
      now()
    )
    returning id into v_membership_id;
  else
    update public.memberships
    set user_id = p_user_id,
        plan_key = 'annual_member',
        status = 'active',
        starts_at = least(starts_at, v_starts_at),
        ends_at = greatest(ends_at, v_ends_at),
        source = 'stripe',
        metadata = p_metadata || jsonb_build_object(
          'stripe_checkout_session_id', p_stripe_checkout_session_id,
          'access_type', 'annual_one_time'
        ),
        last_stripe_event_id = p_stripe_event_id,
        last_stripe_event_created_at = p_stripe_event_created_at,
        last_synced_at = now(),
        updated_at = now()
    where id = v_membership_id;
  end if;

  insert into public.stripe_checkout_sessions (
    stripe_session_id,
    user_id,
    stripe_customer_id,
    stripe_price_id,
    status,
    payment_status,
    mode,
    metadata,
    updated_at
  ) values (
    p_stripe_checkout_session_id,
    p_user_id,
    p_stripe_customer_id,
    p_stripe_price_id,
    'complete',
    'paid',
    'payment',
    p_metadata,
    now()
  )
  on conflict (stripe_session_id) do update set
    user_id = excluded.user_id,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_price_id = excluded.stripe_price_id,
    status = 'complete',
    payment_status = 'paid',
    mode = 'payment',
    metadata = excluded.metadata,
    updated_at = now();

  insert into public.stripe_payments (
    user_id,
    stripe_payment_intent_id,
    stripe_checkout_session_id,
    stripe_subscription_id,
    amount,
    currency,
    status,
    paid_at,
    metadata,
    livemode,
    last_stripe_event_id,
    last_stripe_event_created_at,
    last_synced_at,
    updated_at
  ) values (
    p_user_id,
    p_stripe_payment_intent_id,
    p_stripe_checkout_session_id,
    v_access_key,
    p_amount,
    lower(p_currency),
    'paid',
    v_starts_at,
    p_metadata,
    p_livemode,
    p_stripe_event_id,
    p_stripe_event_created_at,
    now(),
    now()
  )
  on conflict (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null
  do update set
    user_id = excluded.user_id,
    stripe_payment_intent_id = coalesce(
      excluded.stripe_payment_intent_id,
      public.stripe_payments.stripe_payment_intent_id
    ),
    stripe_subscription_id = excluded.stripe_subscription_id,
    amount = excluded.amount,
    currency = excluded.currency,
    status = 'paid',
    paid_at = coalesce(public.stripe_payments.paid_at, excluded.paid_at),
    metadata = excluded.metadata,
    livemode = excluded.livemode,
    last_stripe_event_id = excluded.last_stripe_event_id,
    last_stripe_event_created_at = excluded.last_stripe_event_created_at,
    last_synced_at = now(),
    updated_at = now();

  return jsonb_build_object(
    'result', 'processed',
    'access_activated', true,
    'membership_id', v_membership_id,
    'starts_at', v_starts_at,
    'ends_at', v_ends_at
  );
end
$$;

revoke all on function private.apply_stripe_annual_payment(
  text,
  timestamptz,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  boolean,
  jsonb
) from public, anon, authenticated;

grant execute on function private.apply_stripe_annual_payment(
  text,
  timestamptz,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  boolean,
  jsonb
) to service_role;

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
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_stripe_annual_payment(
    p_stripe_event_id,
    p_stripe_event_created_at,
    p_user_id,
    p_stripe_checkout_session_id,
    p_stripe_customer_id,
    p_stripe_price_id,
    p_stripe_payment_intent_id,
    p_amount,
    p_currency,
    p_livemode,
    p_metadata
  );
$$;

revoke all on function public.internal_apply_stripe_annual_payment(
  text,
  timestamptz,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  boolean,
  jsonb
) from public, anon, authenticated;

grant execute on function public.internal_apply_stripe_annual_payment(
  text,
  timestamptz,
  uuid,
  text,
  text,
  text,
  text,
  integer,
  text,
  boolean,
  jsonb
) to service_role;

