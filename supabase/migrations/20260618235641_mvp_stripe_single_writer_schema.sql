create schema if not exists private;

alter table public.stripe_prices
  add column if not exists recurring_interval_count integer,
  add column if not exists livemode boolean,
  add column if not exists is_checkout_default boolean not null default false;

update public.stripe_prices
set recurring_interval_count = nullif(metadata ->> 'stripe_interval_count', '')::integer
where recurring_interval is not null
  and recurring_interval_count is null
  and (metadata ->> 'stripe_interval_count') ~ '^[0-9]+$';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stripe_prices_recurring_interval_count_check'
      and conrelid = 'public.stripe_prices'::regclass
  ) then
    alter table public.stripe_prices
      add constraint stripe_prices_recurring_interval_count_check
      check (((recurring_interval is null and recurring_interval_count is null) or (recurring_interval is not null and recurring_interval_count is not null and recurring_interval_count > 0))) not valid;
  end if;
end $$;

alter table public.stripe_webhook_events
  add column if not exists status text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_lease_expires_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists ignored_reason text,
  add column if not exists livemode boolean,
  add column if not exists stripe_event_created_at timestamptz;

update public.stripe_webhook_events
set status = case
  when processed = true then 'processed'
  when processed = false and coalesce(error, '') = '' then 'received'
  else 'failed_retryable'
end
where status is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stripe_webhook_events_status_check'
      and conrelid = 'public.stripe_webhook_events'::regclass
  ) then
    alter table public.stripe_webhook_events
      add constraint stripe_webhook_events_status_check
      check (status in ('received','processing','processed','processed_ignored','processed_ignored_stale','failed_retryable','failed_permanent'));
  end if;
end $$;

alter table public.stripe_webhook_events
  alter column status set default 'received',
  alter column status set not null;

alter table public.course_entitlements
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists last_stripe_event_id text,
  add column if not exists last_stripe_event_created_at timestamptz,
  add column if not exists last_synced_at timestamptz;

alter table public.memberships
  add column if not exists last_stripe_event_id text,
  add column if not exists last_stripe_event_created_at timestamptz,
  add column if not exists last_synced_at timestamptz;

alter table public.stripe_subscriptions
  add column if not exists last_stripe_event_id text,
  add column if not exists last_stripe_event_created_at timestamptz,
  add column if not exists last_synced_at timestamptz,
  add column if not exists livemode boolean;

alter table public.stripe_payments
  add column if not exists stripe_subscription_id text,
  add column if not exists last_stripe_event_id text,
  add column if not exists last_stripe_event_created_at timestamptz,
  add column if not exists last_synced_at timestamptz,
  add column if not exists livemode boolean;

create table if not exists public.checkout_rate_limits (
  user_id uuid not null,
  window_start timestamptz not null,
  attempt_count integer not null default 0,
  last_idempotency_key text,
  last_checkout_session_id text,
  updated_at timestamptz not null default now(),
  primary key (user_id, window_start)
);

alter table public.checkout_rate_limits enable row level security;
revoke all on public.checkout_rate_limits from anon, authenticated;

create unique index if not exists stripe_prices_default_plan_unique
on public.stripe_prices (plan_key, livemode, currency)
where active = true and is_checkout_default = true and course_id is null;

create unique index if not exists stripe_prices_default_course_unique
on public.stripe_prices (plan_key, course_id, livemode, currency)
where active = true and is_checkout_default = true and course_id is not null;

create unique index if not exists course_entitlements_subscription_course_unique
on public.course_entitlements (stripe_subscription_id, course_id)
where stripe_subscription_id is not null;

create unique index if not exists stripe_payments_invoice_unique
on public.stripe_payments (stripe_invoice_id)
where stripe_invoice_id is not null;

create unique index if not exists stripe_payments_charge_unique
on public.stripe_payments (stripe_charge_id)
where stripe_charge_id is not null;

create index if not exists stripe_webhook_events_recovery_idx
on public.stripe_webhook_events (status, processing_lease_expires_at, attempt_count, created_at);
