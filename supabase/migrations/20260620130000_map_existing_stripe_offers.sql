insert into public.stripe_products (
  stripe_product_id,
  name,
  active,
  metadata
) values
  ('prod_UYpfuiZ9vyi86D', 'Alchemy Academy 1 Month Access', true, '{"source":"existing_stripe_catalog"}'::jsonb),
  ('prod_UiwxdgrcqKGV5q', 'Individual Course', true, '{"source":"existing_stripe_catalog"}'::jsonb),
  ('prod_UYpYjAVuppRhis', 'Alchemy Academy 1 Year Subscription', true, '{"source":"existing_stripe_catalog"}'::jsonb)
on conflict (stripe_product_id) do update set
  name = excluded.name,
  active = true,
  metadata = public.stripe_products.metadata || excluded.metadata,
  updated_at = now();

insert into public.stripe_prices (
  stripe_price_id,
  stripe_product_id,
  plan_key,
  course_id,
  currency,
  unit_amount,
  recurring_interval,
  recurring_interval_count,
  active,
  livemode,
  is_checkout_default,
  metadata
) values
  (
    'price_1TZhzqK9GJLTk49TMLXE5mpu',
    'prod_UYpfuiZ9vyi86D',
    'monthly_member'::public.membership_plan_key,
    null,
    'aud',
    9900,
    'month',
    1,
    true,
    true,
    true,
    '{"source":"existing_stripe_catalog"}'::jsonb
  ),
  (
    'price_1TjV3NK9GJLTk49T3X0aKpmq',
    'prod_UiwxdgrcqKGV5q',
    'individual_course'::public.membership_plan_key,
    null,
    'aud',
    15900,
    'month',
    3,
    true,
    true,
    true,
    '{"source":"existing_stripe_catalog","course_selected_at_checkout":true}'::jsonb
  ),
  (
    'price_1TZhtrK9GJLTk49TgcjXU3VU',
    'prod_UYpYjAVuppRhis',
    'annual_member'::public.membership_plan_key,
    null,
    'aud',
    70800,
    null,
    null,
    true,
    true,
    true,
    '{"source":"existing_stripe_catalog","access_months":12}'::jsonb
  )
on conflict (stripe_price_id) do update set
  stripe_product_id = excluded.stripe_product_id,
  plan_key = excluded.plan_key,
  course_id = excluded.course_id,
  currency = excluded.currency,
  unit_amount = excluded.unit_amount,
  recurring_interval = excluded.recurring_interval,
  recurring_interval_count = excluded.recurring_interval_count,
  active = true,
  livemode = excluded.livemode,
  is_checkout_default = true,
  metadata = public.stripe_prices.metadata || excluded.metadata,
  updated_at = now();
