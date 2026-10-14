insert into public.stripe_products (stripe_product_id, name, active)
values ('prod_VR9NPGPhPthJBG', 'The path to a colourful life', true)
on conflict (stripe_product_id) do nothing;

update public.stripe_prices
set active = false, is_checkout_default = false, updated_at = now()
where id = 7;

update public.stripe_prices
set currency = 'usd', unit_amount = 15900, recurring_interval = null, recurring_interval_count = null,
    plan_key = 'individual_course', course_id = 12, stripe_product_id = 'prod_UiwxdgrcqKGV5q',
    livemode = true, active = true, is_checkout_default = true, updated_at = now()
where id = 2 and stripe_price_id = 'price_1TjV3NK9GJLTk49T3X0aKpmq';

insert into public.stripe_prices (stripe_price_id, stripe_product_id, plan_key, course_id, currency, unit_amount,
  recurring_interval, recurring_interval_count, livemode, active, is_checkout_default)
values ('price_1UQH5CK9GJLTk49Ti2zWxbEJ', 'prod_VR9NPGPhPthJBG', 'individual_course', 1, 'usd', 39900,
  null, null, true, true, true)
on conflict (stripe_price_id) do nothing;

create or replace function public.get_individual_course_prices()
returns table(course_id bigint, title text, cover_image_path text, unit_amount integer, currency text)
language sql stable security definer set search_path to ''
as $$
  select c.id, c.title, c.cover_image_path, p.unit_amount, p.currency
  from public.stripe_prices p
  join public.courses c on c.id = p.course_id
  where p.plan_key = 'individual_course' and p.active = true and p.is_checkout_default = true
    and p.livemode = true and p.recurring_interval is null and p.currency = 'usd'
    and c.status = 'published' and c.archived_at is null
  order by c.sort_order asc, c.id asc
$$;
grant execute on function public.get_individual_course_prices() to anon, authenticated;

CREATE OR REPLACE FUNCTION private.apply_stripe_course_payment(p_stripe_event_id text, p_stripe_event_created_at timestamp with time zone, p_user_id uuid, p_course_id bigint, p_stripe_checkout_session_id text, p_stripe_customer_id text, p_stripe_price_id text, p_stripe_payment_intent_id text, p_amount integer, p_currency text, p_livemode boolean, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_event_at timestamptz := coalesce(p_stripe_event_created_at, now());
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_entitlement_id bigint;
  v_latest_end timestamptz;
begin
  if p_stripe_checkout_session_id is null or p_stripe_checkout_session_id = '' then
    raise exception 'stripe_checkout_session_id is required';
  end if;
  if p_user_id is null then raise exception 'user_id is required'; end if;
  if p_course_id is null then raise exception 'course_id is required'; end if;

  if private.stripe_event_already_applied(p_stripe_event_id, null, p_stripe_checkout_session_id) then
    return jsonb_build_object('result', 'processed_ignored_duplicate');
  end if;
  if exists (
    select 1 from public.course_entitlements
    where stripe_checkout_session_id = p_stripe_checkout_session_id and course_id = p_course_id
  ) then
    return jsonb_build_object('result', 'processed_ignored_duplicate');
  end if;

  -- Stack the new 6 months after any active access to this course.
  select max(ends_at) into v_latest_end
  from public.course_entitlements
  where user_id = p_user_id and course_id = p_course_id and active = true and ends_at > now();

  v_starts_at := greatest(v_event_at, coalesce(v_latest_end, v_event_at));
  v_ends_at := v_starts_at + interval '6 months';

  insert into public.course_entitlements (
    user_id, course_id, source, starts_at, ends_at, active, metadata,
    stripe_price_id, stripe_checkout_session_id, last_stripe_event_id,
    last_stripe_event_created_at, last_synced_at
  ) values (
    p_user_id, p_course_id, 'stripe', v_starts_at, v_ends_at, true,
    p_metadata || jsonb_build_object('access_type', 'individual_course_one_time', 'access_months', 6),
    p_stripe_price_id, p_stripe_checkout_session_id, p_stripe_event_id,
    p_stripe_event_created_at, now()
  ) returning id into v_entitlement_id;

  if p_stripe_customer_id is not null and p_stripe_customer_id <> '' then
    insert into public.stripe_customers (user_id, stripe_customer_id)
    values (p_user_id, p_stripe_customer_id)
    on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id;
  end if;

  insert into public.stripe_payments (
    user_id, stripe_payment_intent_id, stripe_checkout_session_id, amount, currency,
    status, paid_at, metadata, livemode, last_stripe_event_id, last_stripe_event_created_at, last_synced_at
  ) values (
    p_user_id, p_stripe_payment_intent_id, p_stripe_checkout_session_id, p_amount, p_currency,
    'paid', now(),
    p_metadata || jsonb_build_object('stripe_price_id', p_stripe_price_id, 'course_id', p_course_id),
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
  set payment_status = 'paid', status = 'complete', user_id = coalesce(user_id, p_user_id), updated_at = now()
  where stripe_session_id = p_stripe_checkout_session_id;

  return jsonb_build_object('result', 'processed', 'entitlement_id', v_entitlement_id, 'ends_at', v_ends_at);
end
$function$;