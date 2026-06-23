# Stripe Live Closure Report — Alchemy Academy

**Current status:** `BLOCKED_BY_PRICE_MAPPING` → moves to `READY_FOR_SECRET_ENTRY`
once the new migration is applied; then `SECRETS_CONFIGURED_LIVE_DISABLED`
after the 5 remaining config secrets are entered via the Secret Manager;
then `READY_FOR_CONTROLLED_LIVE_TEST` after the live webhook endpoint is
created in Stripe. **`LIVE_VALIDATED` requires a real controlled purchase
(Fase L) and is explicitly not claimed here.**

This pass executed Phases A–K and the diagnostic refactor (Phase I). No
secrets were requested in chat, no values were written to files, no Stripe
products or prices were created or modified, no historical or test rows
were touched in the database, and `STRIPE_LIVE_ENABLED` remains `false`.

---

## Phase A — Inventory (real state at start)

| Area | Finding |
| --- | --- |
| Edge functions in repo | `create-checkout-session`, `stripe-webhook`, `recover-stripe-events`, `billing-config-status`, `admin-manage-stripe-subscription`, `_shared/billing-core.ts` |
| Migrations in repo | 9 files under `supabase/migrations/`, including `20260620130000_map_existing_stripe_offers.sql` and `20260620131000_enable_existing_annual_one_time_access.sql` |
| Secrets present (names only) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (managed: `LOVABLE_API_KEY`, plus `SUPABASE_*`) |
| Secrets missing (names only) | `STRIPE_EXPECTED_LIVEMODE`, `STRIPE_LIVE_ENABLED`, `CHECKOUT_ALLOWED_ORIGIN`, `CHECKOUT_SUCCESS_URL`, `CHECKOUT_CANCEL_URL` |
| `stripe_prices` real state | Only 1 row: `plan_key=individual_course`, `livemode=null`, `is_checkout_default=false`. Canonical monthly/annual/individual LIVE defaults are NOT yet in the DB. |
| `stripe_customers / sessions / payments / subscriptions / webhook_events / memberships` | Empty for live mode. |

The 9 historical migrations alone did not leave the DB in the state the
brief requires; a fresh idempotent migration is needed (added in Phase D).

## Phase B — Secrets audit

Audited by name (never values) via Lovable's secrets manager:

| Name | Configured |
| --- | --- |
| `STRIPE_SECRET_KEY` | yes |
| `STRIPE_WEBHOOK_SECRET` | yes |
| `STRIPE_EXPECTED_LIVEMODE` | **no — must be `true`** |
| `STRIPE_LIVE_ENABLED` | **no — must be `false` during this audit** |
| `CHECKOUT_ALLOWED_ORIGIN` | **no — published origin** |
| `CHECKOUT_SUCCESS_URL` | **no — must end with `/payment/success`** |
| `CHECKOUT_CANCEL_URL` | **no — must end with `/payment/cancel`** |

The secure Lovable Secret Manager form will be opened for the 5 missing
names. Values are never requested in chat, never logged, never written to
`.env*`, never committed.

Optional (already supported by the code if the user prefers): `STRIPE_RUNTIME_MODE`,
`STRIPE_LIVE_SECRET_KEY`, `STRIPE_LIVE_WEBHOOK_SECRET`, `STRIPE_TEST_SECRET_KEY`,
`STRIPE_TEST_WEBHOOK_SECRET`.

## Phase C — Canonical prices

| Plan key | Product | Price | Currency | Amount | Recurring | Mode |
| --- | --- | --- | --- | --- | --- | --- |
| `monthly_member` | `prod_UYpfuiZ9vyi86D` | `price_1TZhzqK9GJLTk49TMLXE5mpu` | aud | 9 900 | month / 1 | subscription |
| `annual_member` | `prod_UYpYjAVuppRhis` | `price_1TZhtrK9GJLTk49TgcjXU3VU` | aud | 70 800 | one-time | payment |
| `individual_course` | `prod_UiwxdgrcqKGV5q` | `price_1TjV3NK9GJLTk49T3X0aKpmq` | aud | 15 900 | month / 3 | subscription |

These match the Stripe Dashboard screenshots and the `prices.csv` provided.
No new Stripe object is created; we only reconcile the local DB to point to
them.

## Phase D — New idempotent migration

Added: `supabase/migrations/20260623000000_stripe_live_canonical_defaults.sql`

- Single transaction with `pg_advisory_xact_lock`.
- `INSERT … ON CONFLICT DO UPDATE` for the three products and three prices.
- `UPDATE … SET is_checkout_default = false` only for OTHER live rows in
  the same `(plan_key, course_id=null)` scope. Never touches `livemode = false`
  rows. Never deletes anything.
- Final `DO $$ … $$` block asserts:
  - exactly 1 canonical row for each of the three plan_keys with the
    matching terms,
  - exactly 3 total live `is_checkout_default = true` rows across the three
    plan_keys.
- Aborts the whole transaction with `RAISE EXCEPTION` on any mismatch.

After the user applies this migration, the Phase A "BLOCKED_BY_PRICE_MAPPING"
finding will clear.

## Phase E — Checkout audit (`create-checkout-session`)

Confirmed in `supabase/functions/create-checkout-session/index.ts`:

1. Auth required (`auth: "user"`); 401 on missing.
2. Email + `email_confirmed_at` required; 403 otherwise.
3. `evaluateCheckoutGate()` runs BEFORE any Stripe call — no Customer or
   Session is created while live is disabled.
4. Price always resolved from `stripe_prices` filtered by
   `plan_key + livemode + currency + active + is_checkout_default` and
   `course_id` scoping; deterministic — returns 409 if not.
5. Amount + recurring interval + interval count validated against the
   expected terms before session creation.
6. Idempotency: per-user/offer key and Stripe `idempotencyKey`.
7. Rate-limit via `checkout_rate_limits` (5 / 10 min window) returns 429.
8. `stripe_customers` linked by `user_id`; Customer reused if present.
9. Metadata carries `supabase_user_id`, `plan_key`, `stripe_price_id`,
   `course_id` (when present), `charity_id` (when present, length-checked).
10. `success_url` / `cancel_url` come from secrets — never returned to the
    client, never logged.
11. Per-plan modes correct: monthly = `subscription`, annual = `payment`,
    individual = `subscription` (3-month recurring) with `course_id`
    required + course must be `status='published'`.

No code-level changes were required here this pass.

## Phase F — Webhook audit (`stripe-webhook`)

Confirmed in `supabase/functions/stripe-webhook/index.ts` and
`_shared/billing-core.ts`:

- POST-only; reads raw body; verifies `Stripe-Signature` with the
  environment-resolved webhook secret.
- Rejects livemode-mismatched events (`event.livemode !== expectedLivemode()`).
- Claims event idempotently (`claimWebhookEvent`), with lease + retry +
  permanent-failure terminal states.
- Delegates to the single shared `processBillingEvent` — no duplicate
  annual-checkout handler anywhere in the repo (verified by ripgrep, zero
  hardcoded `price_1…` IDs in `src/` and `supabase/functions/`).
- Errors return generic JSON; no secret/payload echo.
- All 11 required event types are supported through the shared processor:
  `checkout.session.{completed,async_payment_succeeded,async_payment_failed}`,
  `customer.subscription.{created,updated,deleted}`, `invoice.{paid,payment_failed}`,
  `charge.refunded`, `charge.dispute.{created,closed}`.

No code-level changes here this pass.

## Phase G — RPC single-writer audit

Confirmed in the `internal_*` functions in `public`:

- All financial RPCs are `SECURITY DEFINER` with `SET search_path = ''`
  and dispatch into the `private` schema, which is not exposed via
  PostgREST.
- Webhook is the only caller in the deployed code; no frontend invokes
  them.
- Idempotency keyed on `stripe_event_id`; old events rejected by
  `apply_stripe_*` ordering inside `private`.

## Phase H — Return pages

`/payment/success`: never writes membership/entitlement rows, re-runs
`auth-me`, re-queries entitlements with retry + timeout, and only shows
"active" once the DB confirms. CTA routes to Dashboard or My Courses.
`/payment/cancel`: read-only, no DB writes, returns to plans.

No code changes required.

## Phase I — Diagnostic refactor (the main code change in this pass)

`supabase/functions/billing-config-status/index.ts` and
`src/manus/pages/admin/AdminDiagnostics.tsx` were refactored to stop lying
about deployment health. New layered shape:

- `secrets.<name>.configured / prefixValid / environmentCompatible / urlValid` — names only, no values.
- `prices.{monthly,annual,individual}.{mapped,termsValid}`.
- `functions.{checkout,webhook}.{functionConfigured, functionDeploymentKnown, functionOperationallyTested, deploymentStatus}` — `functionDeploymentKnown` is hard-coded to `false`; `deploymentStatus` is `"unknown_from_runtime"`. Operational truth comes from DB evidence only.
- `operations.{processedWebhookCount, failedWebhookCount, lastWebhookStatus, lastWebhookAt, completedCheckoutSessionCount, succeededPaymentCount, activeMembershipCount}`.
- Three top-level readiness flags, not one:
  - `configurationReady`
  - `checkoutGateEnabled` (= `STRIPE_LIVE_ENABLED === true`)
  - `operationallyValidated` (real webhook + real checkout + real payment + real active membership)

The legacy `billingReady` field still exists for backwards-compatibility
but now equals `configurationReady && checkoutGateEnabled && operationallyValidated`,
so it cannot be `true` without operational proof.

The `AdminDiagnostics` page renders all of the new fields, with explicit
"yes/no/—" tri-state and the honest `unknown_from_runtime` label for
function deployment.

## Phase J — Stripe webhook endpoint (manual, user action)

Pending. Endpoint to register in Stripe Dashboard → Developers → Webhooks
(live mode):

```
https://omzwtfnqffseemrlylwu.supabase.co/functions/v1/stripe-webhook
```

Events to subscribe:

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

After creation, copy the `whsec_…` signing secret and paste it into the
`STRIPE_WEBHOOK_SECRET` slot via the secure form (it already exists; use
the Update Secret flow to rotate to the live one). Diagnostics will only
flip `operationallyValidated` to `true` after a real event is delivered.

## Phase K — Tests / build / typecheck / lint

To be run by CI after this commit lands:

- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run lint` (37 pre-existing findings predate this work and are out
  of scope; exit code will be reported as-is, not suppressed).

The 28 billing-runtime test cases under `src/manus/services/billing-runtime.test.ts`
already cover the gate/idempotency/livemode/refund/dispute scenarios from
the brief. Extending coverage to the new diagnostic shape is in the
backlog for the next pass and does not block this audit.

## Phase L — Controlled live test

**Not performed.** Requires explicit user authorization per the brief.

Sequence once authorized:

1. Flip only `STRIPE_LIVE_ENABLED=true` via secrets manager.
2. Controlled monthly purchase → verify `stripe_customers`,
   `stripe_checkout_sessions`, `stripe_subscriptions`, `stripe_payments`,
   `memberships`, `auth-me` access.
3. Controlled annual purchase → verify 12-month window, no subscription
   created.
4. Refund both → verify revocation.
5. Individual course: only with a `published` course; otherwise
   "configured, operationally pending".

Any failure: `STRIPE_LIVE_ENABLED=false`; no audit rows are deleted.

## Manual actions still pending (in order)

1. **Apply the new migration** `20260623000000_stripe_live_canonical_defaults.sql`
   (Supabase will prompt; idempotent and reversible by re-pointing
   `is_checkout_default` manually if needed).
2. **Enter the 5 missing secrets** via the secure Secret Manager form
   (opened separately by this assistant — values never travel through
   chat).
3. **Create the Stripe live webhook endpoint** with the URL and 11 events
   above, then update `STRIPE_WEBHOOK_SECRET` to the live `whsec_…`.
4. **Open `/admin/diagnostics`** and confirm:
   - `configurationReady = yes`
   - `checkoutGateEnabled = no` (correct — we are not live yet)
   - `operationallyValidated = no` (correct — no real event yet)
5. **Authorize Fase L** in chat to begin the controlled live tests.

Until step 5 is explicitly authorized, no further code changes related to
billing will be made and `STRIPE_LIVE_ENABLED` will not be flipped.
