create or replace function public.internal_apply_stripe_invoice_paid(
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
language sql
security definer
set search_path = ''
as $$
  select private.apply_stripe_invoice_paid(
    p_stripe_event_id, p_stripe_event_created_at, p_user_id, p_plan_key, p_course_id,
    p_stripe_subscription_id, p_stripe_customer_id, p_stripe_price_id, p_subscription_status,
    p_current_period_start, p_current_period_end, p_cancel_at_period_end,
    p_stripe_invoice_id, p_stripe_payment_intent_id, p_amount, p_currency,
    p_livemode, p_metadata
  );
$$;

create or replace function public.internal_apply_stripe_subscription_state(
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_user_id uuid,
  p_stripe_subscription_id text,
  p_stripe_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_stripe_subscription_state(
    p_stripe_event_id, p_stripe_event_created_at, p_user_id,
    p_stripe_subscription_id, p_stripe_status, p_metadata
  );
$$;

create or replace function public.internal_apply_stripe_access_revocation(
  p_stripe_event_id text,
  p_stripe_event_created_at timestamptz,
  p_stripe_subscription_id text,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_stripe_access_revocation(
    p_stripe_event_id, p_stripe_event_created_at, p_stripe_subscription_id,
    p_reason, p_metadata
  );
$$;

revoke all on function public.internal_apply_stripe_invoice_paid(text, timestamptz, uuid, public.membership_plan_key, bigint, text, text, text, text, timestamptz, timestamptz, boolean, text, text, integer, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.internal_apply_stripe_subscription_state(text, timestamptz, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.internal_apply_stripe_access_revocation(text, timestamptz, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.internal_apply_stripe_invoice_paid(text, timestamptz, uuid, public.membership_plan_key, bigint, text, text, text, text, timestamptz, timestamptz, boolean, text, text, integer, text, boolean, jsonb) to service_role;
grant execute on function public.internal_apply_stripe_subscription_state(text, timestamptz, uuid, text, text, jsonb) to service_role;
grant execute on function public.internal_apply_stripe_access_revocation(text, timestamptz, text, text, jsonb) to service_role;
