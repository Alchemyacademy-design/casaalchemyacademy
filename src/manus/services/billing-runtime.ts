// Pure helpers that decide which Stripe environment (test vs live) the backend
// is currently allowed to use. Mirrored verbatim in
// supabase/functions/_shared/billing-core.ts (Deno cannot import from src/).
//
// SECURITY: these helpers never log, return, or expose secret values. They only
// inspect prefixes and presence to gate behavior.

export type StripeRuntimeMode = "test" | "live";

export type EnvGetter = (name: string) => string | undefined;

export const ANNUAL_MEMBER_EXPECTED = {
  plan_key: "annual_member" as const,
  currency: "aud" as const,
  unit_amount: 70800,
  recurring_interval: null as null,
  recurring_interval_count: null as null,
  active: true as const,
};

export function resolveRuntimeMode(get: EnvGetter): StripeRuntimeMode {
  const raw = (get("STRIPE_RUNTIME_MODE") ?? "").trim().toLowerCase();
  if (raw === "live") return "live";
  if (raw === "test") return "test";
  // Backward compatibility: if legacy STRIPE_EXPECTED_LIVEMODE is set, derive.
  const legacy = (get("STRIPE_EXPECTED_LIVEMODE") ?? "").trim().toLowerCase();
  if (legacy === "true") return "live";
  if (legacy === "false") return "test";
  // Default safe value.
  return "test";
}

export function resolveLiveEnabled(get: EnvGetter): boolean {
  return (get("STRIPE_LIVE_ENABLED") ?? "").trim().toLowerCase() === "true";
}

export function resolveExpectedLivemode(mode: StripeRuntimeMode): boolean {
  return mode === "live";
}

export function resolveSecretKey(get: EnvGetter, mode: StripeRuntimeMode): string {
  const scoped = mode === "live" ? get("STRIPE_LIVE_SECRET_KEY") : get("STRIPE_TEST_SECRET_KEY");
  const legacy = get("STRIPE_SECRET_KEY");
  const value = (scoped ?? legacy ?? "").trim();
  if (!value) throw new Error("BILLING_SECRET_KEY_MISSING");
  validateSecretKeyPrefix(mode, value);
  return value;
}

export function resolveWebhookSecret(get: EnvGetter, mode: StripeRuntimeMode): string {
  const scoped = mode === "live" ? get("STRIPE_LIVE_WEBHOOK_SECRET") : get("STRIPE_TEST_WEBHOOK_SECRET");
  const legacy = get("STRIPE_WEBHOOK_SECRET");
  const value = (scoped ?? legacy ?? "").trim();
  if (!value) throw new Error("BILLING_WEBHOOK_SECRET_MISSING");
  validateWebhookSecretPrefix(value);
  return value;
}

export function validateSecretKeyPrefix(mode: StripeRuntimeMode, key: string): void {
  if (mode === "test") {
    if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
      throw new Error("BILLING_SECRET_KEY_PREFIX_MISMATCH");
    }
  } else {
    if (!key.startsWith("sk_live_") && !key.startsWith("rk_live_")) {
      throw new Error("BILLING_SECRET_KEY_PREFIX_MISMATCH");
    }
  }
}

export function validateWebhookSecretPrefix(secret: string): void {
  if (!secret.startsWith("whsec_")) throw new Error("BILLING_WEBHOOK_SECRET_PREFIX_MISMATCH");
}

export type CheckoutGateError =
  | { ok: true }
  | { ok: false; code: "BILLING_LIVE_DISABLED"; status: 503 }
  | { ok: false; code: "BILLING_SECRET_KEY_MISSING"; status: 500 }
  | { ok: false; code: "BILLING_SECRET_KEY_PREFIX_MISMATCH"; status: 500 };

export function evaluateCheckoutGate(get: EnvGetter): CheckoutGateError {
  const mode = resolveRuntimeMode(get);
  if (mode === "live" && !resolveLiveEnabled(get)) {
    return { ok: false, code: "BILLING_LIVE_DISABLED", status: 503 };
  }
  try {
    resolveSecretKey(get, mode);
  } catch (err) {
    const code = err instanceof Error && err.message === "BILLING_SECRET_KEY_PREFIX_MISMATCH"
      ? "BILLING_SECRET_KEY_PREFIX_MISMATCH"
      : "BILLING_SECRET_KEY_MISSING";
    return { ok: false, code, status: 500 };
  }
  return { ok: true };
}

export type BillingConfigStatus = {
  stripeRuntimeMode: StripeRuntimeMode;
  stripeLiveEnabled: boolean;
  stripeTestKeyConfigured: boolean;
  stripeTestWebhookConfigured: boolean;
  stripeLiveKeyConfigured: boolean;
  stripeLiveWebhookConfigured: boolean;
  legacyStripeSecretKeyConfigured: boolean;
  legacyStripeWebhookSecretConfigured: boolean;
  liveMonthlyPriceMapped: boolean;
  liveAnnualPriceMapped: boolean;
  liveCoursePriceMapped: boolean;
};

function configuredPrefix(value: string | undefined, allowedPrefixes: string[]): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return allowedPrefixes.some((p) => trimmed.startsWith(p));
}

export function describeBillingEnv(get: EnvGetter): Omit<BillingConfigStatus, "liveMonthlyPriceMapped" | "liveAnnualPriceMapped" | "liveCoursePriceMapped"> {
  return {
    stripeRuntimeMode: resolveRuntimeMode(get),
    stripeLiveEnabled: resolveLiveEnabled(get),
    stripeTestKeyConfigured: configuredPrefix(get("STRIPE_TEST_SECRET_KEY"), ["sk_test_", "rk_test_"]),
    stripeTestWebhookConfigured: configuredPrefix(get("STRIPE_TEST_WEBHOOK_SECRET"), ["whsec_"]),
    stripeLiveKeyConfigured: configuredPrefix(get("STRIPE_LIVE_SECRET_KEY"), ["sk_live_", "rk_live_"]),
    stripeLiveWebhookConfigured: configuredPrefix(get("STRIPE_LIVE_WEBHOOK_SECRET"), ["whsec_"]),
    legacyStripeSecretKeyConfigured: Boolean((get("STRIPE_SECRET_KEY") ?? "").trim()),
    legacyStripeWebhookSecretConfigured: Boolean((get("STRIPE_WEBHOOK_SECRET") ?? "").trim()),
  };
}
