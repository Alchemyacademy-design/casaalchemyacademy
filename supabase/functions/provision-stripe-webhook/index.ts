import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const WEBHOOK_URL = 'https://omzwtfnqffseemrlylwu.supabase.co/functions/v1/stripe-webhook'
const EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'invoice.finalized',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  // Refunds / chargebacks — required so cancellations and refunds performed
  // inside the Stripe dashboard revoke access in our database.
  'charge.refunded',
  'charge.refund.updated',
  'charge.dispute.created',
  'charge.dispute.closed',
]

function form(params: Record<string, string | string[]>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((item) => usp.append(`${k}[]`, item))
    else usp.append(k, v)
  }
  return usp.toString()
}

async function stripe(path: string, key: string, init?: RequestInit) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(init?.headers || {}),
    },
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${JSON.stringify(body)}`)
  return body
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const key = Deno.env.get('STRIPE_SECRET_KEY')!
    if (!key) throw new Error('STRIPE_SECRET_KEY missing')

    const url = new URL(req.url)
    const inspectOnly = url.searchParams.get('mode') === 'inspect'

    const list = await stripe('/webhook_endpoints?limit=100', key)
    const existing = (list.data || []).filter((w: any) => w.url === WEBHOOK_URL)

    if (inspectOnly) {
      return new Response(
        JSON.stringify({
          endpoints: existing.map((w: any) => ({
            id: w.id,
            status: w.status,
            livemode: w.livemode,
            enabled_events: w.enabled_events,
            missing_events: EVENTS.filter((e) => !(w.enabled_events || []).includes(e) && !(w.enabled_events || []).includes('*')),
          })),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Update the existing endpoint in place. Deleting + recreating would
    // rotate the signing secret and break the live webhook until the new
    // secret is redeployed, so we never do that when one already exists.
    if (existing.length > 0) {
      const [primary, ...extra] = existing
      const updated = await stripe(`/webhook_endpoints/${primary.id}`, key, {
        method: 'POST',
        body: form({
          enabled_events: EVENTS,
          disabled: 'false',
          description: 'Lovable — members platform (auto-provisioned)',
        }),
      })
      for (const d of extra) {
        await stripe(`/webhook_endpoints/${d.id}`, key, { method: 'DELETE' })
      }
      return new Response(
        JSON.stringify({
          action: 'updated',
          id: updated.id,
          livemode: updated.livemode,
          status: updated.status,
          enabled_events: updated.enabled_events,
          removed: extra.map((d: any) => d.id),
          secret_rotated: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const created = await stripe('/webhook_endpoints', key, {
      method: 'POST',
      body: form({
        url: WEBHOOK_URL,
        enabled_events: EVENTS,
        description: 'Lovable — members platform (auto-provisioned)',
      }),
    })

    return new Response(
      JSON.stringify({
        action: 'created',
        id: created.id,
        livemode: created.livemode,
        secret: created.secret, // whsec_... must be stored as STRIPE_LIVE_WEBHOOK_SECRET
        enabled_events: created.enabled_events,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})