# Stripe Live Closure Report — Alchemy Academy

**Status:** `READY_FOR_SECRET_ENTRY`
(After secrets are pasted in Supabase Functions Settings and validated:
`SECRETS_CONFIGURED_LIVE_DISABLED` → `READY_FOR_CONTROLLED_LIVE_TEST` → `LIVE_VALIDATED`)

## Canonical products / prices (Stripe live)

| Plan key            | Product                     | Price                                | Currency | Amount  | Recurring          | Mode         |
| ------------------- | --------------------------- | ------------------------------------ | -------- | ------- | ------------------ | ------------ |
| `monthly_member`    | `prod_UYpfuiZ9vyi86D`       | `price_1TZhzqK9GJLTk49TMLXE5mpu`     | aud      | 9 900   | month / 1          | subscription |
| `annual_member`     | `prod_UYpYjAVuppRhis`       | `price_1TZhtrK9GJLTk49TgcjXU3VU`     | aud      | 70 800  | one-time           | payment      |
| `individual_course` | `prod_UiwxdgrcqKGV5q`       | `price_1TjV3NK9GJLTk49T3X0aKpmq`     | aud      | 15 900  | month / 3          | subscription |

All three are already inserted in `public.stripe_prices` by migrations
`20260620130000_map_existing_stripe_offers.sql` and
`20260620131000_enable_existing_annual_one_time_access.sql`
(`livemode=true`, `active=true`, `is_checkout_default=true`, `course_id=null`).
No new product or price was created. No existing record was deleted.
Historical prices in `stripe_prices` retain `is_checkout_default=false`.

## Files changed in this pass

- `supabase/functions/stripe-webhook/index.ts` — removed the duplicated
  annual-checkout path. The webhook now only verifies signature, claims
  idempotently, delegates to `processBillingEvent` in
  `supabase/functions/_shared/billing-core.ts`, and finalises status.
- `supabase/functions/billing-config-status/index.ts` — expanded to expose
  every indicator listed in Etapa 8 (`stripeSecretConfigured`,
  `stripeWebhookSecretConfigured`, `stripeExpectedLivemode`,
  `stripeLiveEnabled`, `{monthly,annual,individual}PriceMapped`,
  `{monthly,annual,individual}PriceTermsValid`, `webhookFunctionActive`,
  `checkoutFunctionActive`, `lastWebhookStatus`, `lastWebhookAt`,
  `failedWebhookCount`, `billingReady`). Booleans only — no secret value,
  prefix, length, or fragment is returned anywhere.
- `src/manus/pages/admin/AdminDiagnostics.tsx` — surfaces every new field in
  `/admin/diagnostics`.

## Hardcoded Stripe Price IDs in code

Search across `src/` and `supabase/functions/` returns **zero** references
to `price_1...` IDs. Only historical migration files and this report
mention them, which is the documented source-of-truth path.

## Duplicate logic removed

`processAnnualCheckout` previously lived in `stripe-webhook/index.ts` AND
in `_shared/billing-core.ts` (`applyAnnualCheckoutPayment`, called from
`processBillingEvent`). The webhook now calls only `processBillingEvent`;
annual handling has a single implementation in `billing-core.ts`.

## Database synchronisation

No schema change. No table, column, enum, policy, or RLS was touched. The
canonical rows were already present from earlier migrations. The new
diagnostic validates them on every page load using the canonical attributes
(`plan_key + livemode=true + active=true + is_checkout_default=true +
course_id IS NULL` + amount/interval/currency match).

## Secrets expected in Supabase Functions Settings

Names only — values must be pasted in the Supabase secrets UI, never in
code, chat, repo, or logs.

| Secret                       | Required | Notes                                            |
| ---------------------------- | -------- | ------------------------------------------------ |
| `STRIPE_SECRET_KEY`          | yes      | `sk_live_…` or `rk_live_…` for production        |
| `STRIPE_WEBHOOK_SECRET`      | yes      | `whsec_…` from the live webhook endpoint         |
| `STRIPE_EXPECTED_LIVEMODE`   | yes      | `true` in production                             |
| `STRIPE_LIVE_ENABLED`        | yes      | keep `false` until Etapa 11 controlled test      |
| `CHECKOUT_ALLOWED_ORIGIN`    | yes      | published origin                                 |
| `CHECKOUT_SUCCESS_URL`       | yes      | `/payment/success`                               |
| `CHECKOUT_CANCEL_URL`        | yes      | `/payment/cancel`                                |

Optional, advisory (used only for env↔DB cross-check, never required):
`STRIPE_LIVE_ANNUAL_PRICE_ID`, `STRIPE_LIVE_MONTHLY_PRICE_ID`,
`STRIPE_LIVE_COURSE_PRICE_ID`.

## Webhook endpoint

`https://omzwtfnqffseemrlylwu.supabase.co/functions/v1/stripe-webhook`

Subscribe in Stripe Dashboard → Developers → Webhooks → live mode:

```
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
charge.refunded
charge.dispute.created
charge.dispute.closed
```

## Tests executed in this pass

| Command           | Exit | Notes                                                 |
| ----------------- | ---- | ----------------------------------------------------- |
| `bun run typecheck` | 0  | clean                                                 |
| `bun run test`      | 0  | 78 tests / 8 files (incl. 28 billing-runtime cases)   |
| `bun run build`     | 0  | clean                                                 |
| `bun run lint`      | 1  | 37 pre-existing problems (25 errors, 12 warnings); zero net-new in this pass |

Edge Functions deployed: `stripe-webhook`, `billing-config-status`.

## Controlled live test (Etapa 11) — pending

Pending the user pasting the 7 secrets above in Supabase. Then:

1. Confirm `/admin/diagnostics` shows `Billing ready: yes`.
2. Flip `STRIPE_LIVE_ENABLED=true`.
3. Run a controlled monthly purchase; verify `stripe_customers`,
   `stripe_checkout_sessions`, `stripe_subscriptions`, `stripe_payments`,
   `memberships` rows.
4. Run a controlled annual purchase; verify 12-month access window.
5. Individual-course test stays as "configured, operational test pending"
   while no course is `published`.
6. Refund the controlled tests and verify revocation.

## Rollback

Flip `STRIPE_LIVE_ENABLED=false` in Supabase secrets. `create-checkout-session`
immediately returns HTTP 503 `BILLING_LIVE_DISABLED` and no Stripe call is
made. No DB record is rolled back automatically — the controlled test
records remain for audit.

## Pendências

- Paste live secrets in Supabase (manual, user action).
- Configure the live webhook in Stripe Dashboard with the URL and 11 events above (manual, user action).
- Run the controlled live tests of Etapa 11 (manual, after diagnostics shows `Billing ready: yes`).
- The 37 lint findings predate this work and are out of scope here.

## Manual actions still needed (2)

1. **In Supabase → Functions → Settings → Secrets**, paste the 7 names
   listed above. Keep `STRIPE_LIVE_ENABLED=false`.
2. **In Stripe Dashboard (live) → Developers → Webhooks**, add the endpoint
   `https://omzwtfnqffseemrlylwu.supabase.co/functions/v1/stripe-webhook`
   with the 11 events listed, copy the `whsec_…`, and paste it into
   `STRIPE_WEBHOOK_SECRET`.

Then ping me to flip `STRIPE_LIVE_ENABLED=true` and run the controlled tests.
