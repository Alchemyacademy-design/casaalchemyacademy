
-- Products
INSERT INTO public.stripe_products (stripe_product_id, name, active, metadata)
VALUES
  ('prod_UYpfuiZ9vyi86D', 'Alchemy Academy 1 Month Access', true, '{}'::jsonb),
  ('prod_UYpYjAVuppRhis', 'Alchemy Academy 1 Year Subscription', true, '{}'::jsonb),
  ('prod_UiwxdgrcqKGV5q', 'Individual Course', true, '{}'::jsonb)
ON CONFLICT (stripe_product_id) DO UPDATE
  SET name = EXCLUDED.name, active = EXCLUDED.active, updated_at = now();

-- Ensure only one checkout default per (plan_key, livemode, currency, course_id)
UPDATE public.stripe_prices
   SET active = false, is_checkout_default = false, updated_at = now()
 WHERE plan_key IN ('monthly_member','annual_member','individual_course');

-- monthly_member: $99 AUD / month, recurring
INSERT INTO public.stripe_prices (
  stripe_price_id, stripe_product_id, plan_key, course_id, currency,
  unit_amount, recurring_interval, recurring_interval_count,
  active, is_checkout_default, livemode, metadata
) VALUES (
  'price_1TZhzqK9GJLTk49TMLXE5mpu', 'prod_UYpfuiZ9vyi86D', 'monthly_member', NULL, 'aud',
  9900, 'month', 1, true, true, true, '{}'::jsonb
)
ON CONFLICT (stripe_price_id) DO UPDATE
  SET stripe_product_id = EXCLUDED.stripe_product_id,
      plan_key = EXCLUDED.plan_key,
      course_id = EXCLUDED.course_id,
      currency = EXCLUDED.currency,
      unit_amount = EXCLUDED.unit_amount,
      recurring_interval = EXCLUDED.recurring_interval,
      recurring_interval_count = EXCLUDED.recurring_interval_count,
      active = true,
      is_checkout_default = true,
      livemode = true,
      updated_at = now();

-- annual_member: $708 AUD one-time
INSERT INTO public.stripe_prices (
  stripe_price_id, stripe_product_id, plan_key, course_id, currency,
  unit_amount, recurring_interval, recurring_interval_count,
  active, is_checkout_default, livemode, metadata
) VALUES (
  'price_1TZhtrK9GJLTk49TgcjXU3VU', 'prod_UYpYjAVuppRhis', 'annual_member', NULL, 'aud',
  70800, NULL, NULL, true, true, true, '{}'::jsonb
)
ON CONFLICT (stripe_price_id) DO UPDATE
  SET stripe_product_id = EXCLUDED.stripe_product_id,
      plan_key = EXCLUDED.plan_key,
      course_id = EXCLUDED.course_id,
      currency = EXCLUDED.currency,
      unit_amount = EXCLUDED.unit_amount,
      recurring_interval = NULL,
      recurring_interval_count = NULL,
      active = true,
      is_checkout_default = true,
      livemode = true,
      updated_at = now();

-- individual_course: $159 AUD every 3 months (update existing row)
UPDATE public.stripe_prices
   SET stripe_product_id = 'prod_UiwxdgrcqKGV5q',
       currency = 'aud',
       unit_amount = 15900,
       recurring_interval = 'month',
       recurring_interval_count = 3,
       active = true,
       is_checkout_default = true,
       livemode = true,
       updated_at = now()
 WHERE stripe_price_id = 'price_1TjV3NK9GJLTk49T3X0aKpmq';
