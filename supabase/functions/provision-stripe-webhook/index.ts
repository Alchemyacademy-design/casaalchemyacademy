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

    // Find and disable duplicates pointing to our URL
    const list = await stripe('/webhook_endpoints?limit=100', key)
    const duplicates = (list.data || []).filter((w: any) => w.url === WEBHOOK_URL)
    for (const d of duplicates) {
      await stripe(`/webhook_endpoints/${d.id}`, key, { method: 'DELETE' })
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
        id: created.id,
        livemode: created.livemode,
        secret: created.secret, // whsec_...
        removed: duplicates.map((d: any) => d.id),
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