create or replace function public.internal_activate_validated_stripe_price(
  p_stripe_price_id text,
  p_expected_plan_key public.membership_plan_key,
  p_expected_currency text,
  p_expected_unit_amount integer,
  p_expected_recurring_interval text,
  p_expected_recurring_interval_count integer,
  p_expected_livemode boolean,
  p_expected_course_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_price public.stripe_prices%rowtype;
  v_default_count integer;
  v_lock_key text;
begin
  if p_stripe_price_id is null or btrim(p_stripe_price_id) = '' then
    raise exception 'stripe_price_id is required';
  end if;

  if p_expected_currency is null or lower(p_expected_currency) <> p_expected_currency then
    raise exception 'expected currency must be lowercase';
  end if;

  if p_expected_unit_amount is null or p_expected_unit_amount <= 0 then
    raise exception 'expected unit amount must be positive';
  end if;

  if p_expected_recurring_interval is null or p_expected_recurring_interval_count is null or p_expected_recurring_interval_count <= 0 then
    raise exception 'expected recurring interval and count are required';
  end if;

  v_lock_key := concat_ws(
    '|',
    p_expected_plan_key::text,
    coalesce(p_expected_course_id::text, '*'),
    p_expected_livemode::text,
    p_expected_currency
  );

  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  select *
    into v_price
  from public.stripe_prices
  where stripe_price_id = p_stripe_price_id
  for update;

  if not found then
    raise exception 'stripe price % not found', p_stripe_price_id;
  end if;

  if v_price.active then
    raise exception 'stripe price % must be inactive before default activation', p_stripe_price_id;
  end if;

  if v_price.is_checkout_default then
    raise exception 'stripe price % is already checkout default before activation', p_stripe_price_id;
  end if;

  if v_price.plan_key <> p_expected_plan_key then
    raise exception 'stripe price % plan mismatch', p_stripe_price_id;
  end if;

  if v_price.course_id is distinct from p_expected_course_id then
    raise exception 'stripe price % course mismatch', p_stripe_price_id;
  end if;

  if lower(v_price.currency) <> p_expected_currency then
    raise exception 'stripe price % currency mismatch', p_stripe_price_id;
  end if;

  if v_price.unit_amount <> p_expected_unit_amount then
    raise exception 'stripe price % amount mismatch', p_stripe_price_id;
  end if;

  if v_price.recurring_interval <> p_expected_recurring_interval then
    raise exception 'stripe price % recurring interval mismatch', p_stripe_price_id;
  end if;

  if v_price.recurring_interval_count <> p_expected_recurring_interval_count then
    raise exception 'stripe price % recurring interval count mismatch', p_stripe_price_id;
  end if;

  if v_price.livemode is distinct from p_expected_livemode then
    raise exception 'stripe price % livemode mismatch', p_stripe_price_id;
  end if;

  update public.stripe_prices
  set
    active = false,
    is_checkout_default = false,
    updated_at = now()
  where plan_key = p_expected_plan_key
    and livemode is not distinct from p_expected_livemode
    and lower(currency) = p_expected_currency
    and course_id is not distinct from p_expected_course_id
    and stripe_price_id <> p_stripe_price_id;

  update public.stripe_prices
  set
    active = true,
    is_checkout_default = true,
    updated_at = now()
  where stripe_price_id = p_stripe_price_id;

  select count(*)
    into v_default_count
  from public.stripe_prices
  where plan_key = p_expected_plan_key
    and livemode is not distinct from p_expected_livemode
    and lower(currency) = p_expected_currency
    and course_id is not distinct from p_expected_course_id
    and active = true
    and is_checkout_default = true;

  if v_default_count <> 1 then
    raise exception 'expected exactly one checkout default, found %', v_default_count;
  end if;

  return jsonb_build_object(
    'result', 'activated',
    'stripe_price_id', p_stripe_price_id,
    'plan_key', p_expected_plan_key::text,
    'course_id', p_expected_course_id,
    'livemode', p_expected_livemode,
    'currency', p_expected_currency
  );
end;
$$;

revoke all on function public.internal_activate_validated_stripe_price(
  text,
  public.membership_plan_key,
  text,
  integer,
  text,
  integer,
  boolean,
  bigint
) from public, anon, authenticated;

grant execute on function public.internal_activate_validated_stripe_price(
  text,
  public.membership_plan_key,
  text,
  integer,
  text,
  integer,
  boolean,
  bigint
) to service_role;
