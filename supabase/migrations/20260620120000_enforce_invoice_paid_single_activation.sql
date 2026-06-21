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
  v_access_revoked boolean := false;
begin
  v_status := private.map_stripe_subscription_status(
    p_stripe_status
  );

  if v_status is null then
    raise exception
      'Unknown Stripe subscription status: %',
      p_stripe_status;
  end if;

  update public.stripe_subscriptions
  set status = p_stripe_status,
      user_id = coalesce(user_id, p_user_id),
      metadata = p_metadata,
      last_stripe_event_id = p_stripe_event_id,
      last_stripe_event_created_at =
        p_stripe_event_created_at,
      last_synced_at = now(),
      updated_at = now()
  where stripe_subscription_id =
          p_stripe_subscription_id
    and (
      last_stripe_event_created_at is null
      or p_stripe_event_created_at >=
         last_stripe_event_created_at
    );

  /*
   * Eventos customer.subscription.* podem registrar o
   * estado da assinatura, mas nunca ativar ou reativar
   * acesso.
   *
   * Somente private.apply_stripe_invoice_paid pode definir
   * memberships e entitlements como ativos.
   */
  if v_status in (
    'past_due'::public.membership_status,
    'cancelled'::public.membership_status,
    'expired'::public.membership_status
  ) then
    update public.memberships
    set status = v_status,
        metadata = p_metadata,
        last_stripe_event_id = p_stripe_event_id,
        last_stripe_event_created_at =
          p_stripe_event_created_at,
        last_synced_at = now(),
        updated_at = now()
    where stripe_subscription_id =
            p_stripe_subscription_id
      and (
        last_stripe_event_created_at is null
        or p_stripe_event_created_at >=
           last_stripe_event_created_at
      );

    update public.course_entitlements
    set active = false,
        metadata = p_metadata,
        last_stripe_event_id = p_stripe_event_id,
        last_stripe_event_created_at =
          p_stripe_event_created_at,
        last_synced_at = now(),
        updated_at = now()
    where stripe_subscription_id =
            p_stripe_subscription_id
      and (
        last_stripe_event_created_at is null
        or p_stripe_event_created_at >=
           last_stripe_event_created_at
      );

    v_access_revoked := true;
  end if;

  return jsonb_build_object(
    'result',
    case
      when v_access_revoked
        then 'processed_access_revoked'
      else 'processed_state_only'
    end,
    'access_activated',
    false
  );
end
$$;

revoke all on function
  private.apply_stripe_subscription_state(
    text,
    timestamptz,
    uuid,
    text,
    text,
    jsonb
  )
from public, anon, authenticated;

grant execute on function
  private.apply_stripe_subscription_state(
    text,
    timestamptz,
    uuid,
    text,
    text,
    jsonb
  )
to service_role;

