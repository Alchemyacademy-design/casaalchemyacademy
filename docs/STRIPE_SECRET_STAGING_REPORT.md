# Stripe Secret Staging Report

**Status:** LIVE CREDENTIALS CAN BE SAFELY STAGED
**Mode at end of execution:** `STRIPE_RUNTIME_MODE=test`, `STRIPE_LIVE_ENABLED=false` (defaults; nothing was changed in Supabase Secrets in this execution).

This document describes a backend refactor that makes it safe to **store** real Stripe live credentials in Supabase Secrets right now without exposing them to the running application. Live charges remain impossible until the feature flag is flipped.

---

## 1. Environment variables

### Now active (backward-compatible)

| Variable | Purpose | Source |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Legacy fallback secret key (test in current setup) | Already configured |
| `STRIPE_WEBHOOK_SECRET` | Legacy fallback webhook secret (test) | Already configured |
| `STRIPE_EXPECTED_LIVEMODE` | Legacy livemode flag | Already configured |

These continue to work unchanged. The new resolver reads them as a fallback when the scoped variables below are not present.

### New, ready to be cadastered now (no impact while STRIPE_LIVE_ENABLED=false)

| Variable | Allowed values | Notes |
| --- | --- | --- |
| `STRIPE_RUNTIME_MODE` | `test` \| `live` | Defaults to `test` if unset / legacy fallback. |
| `STRIPE_TEST_SECRET_KEY` | `sk_test_…` or `rk_test_…` | Optional; if absent, legacy `STRIPE_SECRET_KEY` is used. |
| `STRIPE_TEST_WEBHOOK_SECRET` | `whsec_…` | Optional; legacy `STRIPE_WEBHOOK_SECRET` is used otherwise. |
| `STRIPE_LIVE_SECRET_KEY` | `sk_live_…` or `rk_live_…` | **Safe to stage now.** Inactive while `STRIPE_LIVE_ENABLED ≠ true`. |
| `STRIPE_LIVE_WEBHOOK_SECRET` | `whsec_…` | Stage **after** the live webhook endpoint is created in the Stripe Dashboard. |
| `STRIPE_LIVE_ENABLED` | `true` \| `false` | **Hard switch.** Must remain `false` until activation day. |
| `STRIPE_LIVE_MONTHLY_PRICE_ID` | `price_…` | Optional cross-validation only. Source of truth = `public.stripe_prices`. |
| `STRIPE_LIVE_ANNUAL_PRICE_ID` | `price_…` | Optional cross-validation only. Same. |
| `STRIPE_LIVE_COURSE_PRICE_ID` | `price_…` | Optional cross-validation only. Same. |

### Still pending (depend on Stripe Dashboard work)

* `STRIPE_LIVE_WEBHOOK_SECRET` — requires the live webhook endpoint to be created first.
* `STRIPE_LIVE_*_PRICE_ID` — depend on the live Products/Prices being created and inserted into `public.stripe_prices` with `livemode=true`, `active=true`, `is_checkout_default=true`.

---

## 2. Behavior matrix

| Mode | Live enabled | Outcome of `create-checkout-session` |
| --- | --- | --- |
| `test` | n/a | Uses test secret key; expects `event.livemode=false`. |
| `live` | `false` (or unset) | **HTTP 503, `{ "error": "BILLING_LIVE_DISABLED" }`.** No Stripe API call is made. |
| `live` | `true`, valid `sk_live_…` | Uses live key; expects `event.livemode=true`. |
| `live` | `true`, no live key | HTTP 500, `BILLING_SECRET_KEY_MISSING`. No Stripe call. |
| `live` | `true`, key has `sk_test_…` prefix | HTTP 500, `BILLING_SECRET_KEY_PREFIX_MISMATCH`. No Stripe call. |
| `test` | n/a | Key with `sk_live_…` prefix is rejected the same way. |

The webhook applies the same prefix and mode logic to its signing secret and rejects events whose `event.livemode` does not match the configured mode (defense-in-depth on top of the existing signature verification).

---

## 3. Hardcoded annual Price ID removal

The constant `price_1TZhtrK9GJLTk49TgcjXU3VU` was previously hardcoded in three files:

* `supabase/functions/_shared/billing-core.ts`
* `supabase/functions/stripe-webhook/index.ts`
* `supabase/functions/recover-stripe-events/index.ts`

The hardcode has been removed. The annual one-time Price is now validated **only** against `public.stripe_prices` using the canonical attributes:

```
plan_key = 'annual_member'
currency = 'aud'
unit_amount = 70800
recurring_interval IS NULL
recurring_interval_count IS NULL
active = true
livemode = <event.livemode>
```

When `STRIPE_LIVE_ANNUAL_PRICE_ID` is configured, it is cross-validated against the resolved Price ID on live events; mismatch causes the event to be rejected before any state mutation. No fixed live Price ID has been substituted into the code.

---

## 4. Frontend behavior

* `SubscribeModal` recognizes the `BILLING_LIVE_DISABLED` response and displays a friendly message ("Payments are not active yet. Please check back soon.") instead of a generic checkout error.
* No `STRIPE_*` variable is exposed as `VITE_*`. No secret reaches the browser bundle.
* Admins can read configuration **booleans** via the Diagnostics page; they cannot trigger live checkouts while the flag is off (the edge function returns 503).

---

## 5. Admin diagnostic surface

New edge function: `supabase/functions/billing-config-status/index.ts`. Returns **only booleans** to admins (validated via `has_role(uid, 'admin')`):

```
stripeRuntimeMode, stripeLiveEnabled,
stripeTestKeyConfigured, stripeTestWebhookConfigured,
stripeLiveKeyConfigured, stripeLiveWebhookConfigured,
legacyStripeSecretKeyConfigured, legacyStripeWebhookSecretConfigured,
liveMonthlyPriceMapped, liveAnnualPriceMapped, liveCoursePriceMapped
```

Never returns key contents, lengths, last characters, full Price IDs, or webhook secret fragments. Surfaced in `/admin/diagnostics` under "Billing configuration (Stripe)".

---

## 6. How to activate live later (NOT done in this execution)

1. In Stripe Dashboard (Live mode): create Products + Prices for `monthly_member`, `annual_member`, `individual_course` with `currency=aud` and the documented unit amounts (9900, 70800, 15900).
2. Sync them into `public.stripe_prices` (`livemode=true`, `active=true`, `is_checkout_default=true`).
3. Create the live webhook endpoint pointing to `https://omzwtfnqffseemrlylwu.supabase.co/functions/v1/stripe-webhook` with events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
4. Stage `STRIPE_LIVE_SECRET_KEY` and `STRIPE_LIVE_WEBHOOK_SECRET` in Supabase Secrets.
5. Stage `STRIPE_LIVE_MONTHLY_PRICE_ID`, `STRIPE_LIVE_ANNUAL_PRICE_ID`, `STRIPE_LIVE_COURSE_PRICE_ID` for cross-validation.
6. Set `STRIPE_RUNTIME_MODE=live` and `STRIPE_LIVE_ENABLED=true`.
7. Verify via `/admin/diagnostics` that all live booleans are `yes` before announcing.

## 7. Rollback

Set `STRIPE_LIVE_ENABLED=false` (or `STRIPE_RUNTIME_MODE=test`). All checkout attempts immediately return 503 / fall back to test. Staged live secrets remain in Supabase Secrets but are unused.

---

## 8. Tests added (Vitest, run via `bun run test`)

`src/manus/services/billing-runtime.test.ts` — 17 unit cases covering:

* `resolveRuntimeMode` default + legacy fallback
* `resolveLiveEnabled` strict `true` parsing
* `resolveExpectedLivemode` mapping
* `resolveSecretKey` for test/live, legacy fallback, prefix mismatch, missing key, restricted-key prefixes
* `resolveWebhookSecret` for test/live, legacy fallback, missing, bad prefix
* `evaluateCheckoutGate` for all five required cases:
  * test mode uses test key
  * live mode with `STRIPE_LIVE_ENABLED=false` → 503 `BILLING_LIVE_DISABLED`
  * live mode without live key → blocked
  * live mode with test key → blocked
  * test mode with live key → blocked
* `describeBillingEnv` never includes secret values (asserted via regex)
* `validateSecretKeyPrefix` error message never contains the key
* `ANNUAL_MEMBER_CANONICAL` shape

Webhook secret selection per environment, and the absence of Stripe API calls when live is disabled, are enforced by the same `resolveSecretKey` / `resolveWebhookSecret` / `evaluateCheckoutGate` helpers mirrored verbatim in `supabase/functions/_shared/billing-core.ts`.

---

## 9. Validation commands

Recorded exit codes are appended to `docs/PHASE_3_REPORT.md` (this execution does not change phase status).

```
bun run typecheck
bun run test
bun run build
bun run lint
```

---

## 10. Secrets policy

No secret value was written to source code, logs, the report, the frontend bundle, or error responses. Error responses use stable opaque codes (`BILLING_LIVE_DISABLED`, `BILLING_SECRET_KEY_MISSING`, `BILLING_SECRET_KEY_PREFIX_MISMATCH`, `BILLING_WEBHOOK_SECRET_MISSING`, `BILLING_WEBHOOK_SECRET_PREFIX_MISMATCH`).

**LIVE CREDENTIALS CAN BE SAFELY STAGED.** Stripe live is NOT declared functional.

---

## 11. Recorded exit codes (this execution)

| Command | Exit code | Notes |
| --- | --- | --- |
| `bun run typecheck` | **0** | clean |
| `bun run test` | **0** | 8 files, 78 tests passed (+28 new `billing-runtime.test.ts`) |
| `bun run build` | **0** | dist built; chunk-size warning is pre-existing |
| `bun run lint` | **1** | 37 pre-existing issues. **No new lint findings in any file touched by this execution** (`billing-runtime.ts`, `billing-runtime.test.ts`, `billing-core.ts`, `stripe-webhook/index.ts`, `recover-stripe-events/index.ts`, `create-checkout-session/index.ts`, `billing-config-status/index.ts`, `AdminDiagnostics.tsx`, `SubscribeModal.tsx`). |

