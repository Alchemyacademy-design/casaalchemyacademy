import { describe, it, expect } from "vitest";
import {
  resolveRuntimeMode,
  resolveLiveEnabled,
  resolveSecretKey,
  resolveWebhookSecret,
  resolveExpectedLivemode,
  evaluateCheckoutGate,
  describeBillingEnv,
  validateSecretKeyPrefix,
  ANNUAL_MEMBER_EXPECTED,
} from "./billing-runtime";

const envOf = (obj: Record<string, string | undefined>) => (k: string) => obj[k];

describe("billing-runtime", () => {
  describe("resolveRuntimeMode", () => {
    it("defaults to test when nothing is set", () => {
      expect(resolveRuntimeMode(envOf({}))).toBe("test");
    });
    it("returns live when STRIPE_RUNTIME_MODE=live", () => {
      expect(resolveRuntimeMode(envOf({ STRIPE_RUNTIME_MODE: "live" }))).toBe("live");
    });
    it("falls back to legacy STRIPE_EXPECTED_LIVEMODE=true", () => {
      expect(resolveRuntimeMode(envOf({ STRIPE_EXPECTED_LIVEMODE: "true" }))).toBe("live");
    });
    it("falls back to legacy STRIPE_EXPECTED_LIVEMODE=false", () => {
      expect(resolveRuntimeMode(envOf({ STRIPE_EXPECTED_LIVEMODE: "false" }))).toBe("test");
    });
  });

  describe("resolveLiveEnabled", () => {
    it("is false by default", () => {
      expect(resolveLiveEnabled(envOf({}))).toBe(false);
    });
    it("is true only when STRIPE_LIVE_ENABLED=true", () => {
      expect(resolveLiveEnabled(envOf({ STRIPE_LIVE_ENABLED: "true" }))).toBe(true);
      expect(resolveLiveEnabled(envOf({ STRIPE_LIVE_ENABLED: "1" }))).toBe(false);
    });
  });

  describe("resolveExpectedLivemode", () => {
    it("maps mode to livemode", () => {
      expect(resolveExpectedLivemode("test")).toBe(false);
      expect(resolveExpectedLivemode("live")).toBe(true);
    });
  });

  describe("resolveSecretKey", () => {
    it("uses scoped test key in test mode", () => {
      const key = resolveSecretKey(envOf({ STRIPE_TEST_SECRET_KEY: "sk_test_abc" }), "test");
      expect(key).toBe("sk_test_abc");
    });
    it("uses scoped live key in live mode", () => {
      const key = resolveSecretKey(envOf({ STRIPE_LIVE_SECRET_KEY: "sk_live_xyz" }), "live");
      expect(key).toBe("sk_live_xyz");
    });
    it("falls back to legacy STRIPE_SECRET_KEY in test mode", () => {
      const key = resolveSecretKey(envOf({ STRIPE_SECRET_KEY: "sk_test_legacy" }), "test");
      expect(key).toBe("sk_test_legacy");
    });
    it("rejects live key when in test mode", () => {
      expect(() => resolveSecretKey(envOf({ STRIPE_TEST_SECRET_KEY: "sk_live_oops" }), "test"))
        .toThrowError("BILLING_SECRET_KEY_PREFIX_MISMATCH");
    });
    it("rejects test key when in live mode", () => {
      expect(() => resolveSecretKey(envOf({ STRIPE_LIVE_SECRET_KEY: "sk_test_oops" }), "live"))
        .toThrowError("BILLING_SECRET_KEY_PREFIX_MISMATCH");
    });
    it("rejects missing key", () => {
      expect(() => resolveSecretKey(envOf({}), "test")).toThrowError("BILLING_SECRET_KEY_MISSING");
    });
    it("accepts restricted-key prefixes (rk_*)", () => {
      expect(resolveSecretKey(envOf({ STRIPE_TEST_SECRET_KEY: "rk_test_abc" }), "test")).toBe("rk_test_abc");
      expect(resolveSecretKey(envOf({ STRIPE_LIVE_SECRET_KEY: "rk_live_abc" }), "live")).toBe("rk_live_abc");
    });
  });

  describe("resolveWebhookSecret", () => {
    it("uses scoped test webhook", () => {
      expect(resolveWebhookSecret(envOf({ STRIPE_TEST_WEBHOOK_SECRET: "whsec_t" }), "test")).toBe("whsec_t");
    });
    it("uses scoped live webhook", () => {
      expect(resolveWebhookSecret(envOf({ STRIPE_LIVE_WEBHOOK_SECRET: "whsec_l" }), "live")).toBe("whsec_l");
    });
    it("falls back to legacy STRIPE_WEBHOOK_SECRET", () => {
      expect(resolveWebhookSecret(envOf({ STRIPE_WEBHOOK_SECRET: "whsec_legacy" }), "test")).toBe("whsec_legacy");
    });
    it("rejects non-whsec prefix", () => {
      expect(() => resolveWebhookSecret(envOf({ STRIPE_TEST_WEBHOOK_SECRET: "sk_test_no" }), "test"))
        .toThrowError("BILLING_WEBHOOK_SECRET_PREFIX_MISMATCH");
    });
    it("rejects missing webhook", () => {
      expect(() => resolveWebhookSecret(envOf({}), "live")).toThrowError("BILLING_WEBHOOK_SECRET_MISSING");
    });
  });

  describe("evaluateCheckoutGate", () => {
    it("allows test mode with valid test key", () => {
      expect(evaluateCheckoutGate(envOf({
        STRIPE_RUNTIME_MODE: "test",
        STRIPE_TEST_SECRET_KEY: "sk_test_x",
      }))).toEqual({ ok: true });
    });
    it("blocks live mode when STRIPE_LIVE_ENABLED is not true (503 BILLING_LIVE_DISABLED)", () => {
      expect(evaluateCheckoutGate(envOf({
        STRIPE_RUNTIME_MODE: "live",
        STRIPE_LIVE_SECRET_KEY: "sk_live_x",
        STRIPE_LIVE_ENABLED: "false",
      }))).toEqual({ ok: false, code: "BILLING_LIVE_DISABLED", status: 503 });
    });
    it("blocks live mode without live key", () => {
      const r = evaluateCheckoutGate(envOf({
        STRIPE_RUNTIME_MODE: "live",
        STRIPE_LIVE_ENABLED: "true",
      }));
      expect(r).toEqual({ ok: false, code: "BILLING_SECRET_KEY_MISSING", status: 500 });
    });
    it("blocks live mode with test key", () => {
      const r = evaluateCheckoutGate(envOf({
        STRIPE_RUNTIME_MODE: "live",
        STRIPE_LIVE_ENABLED: "true",
        STRIPE_LIVE_SECRET_KEY: "sk_test_wrong",
      }));
      expect(r).toEqual({ ok: false, code: "BILLING_SECRET_KEY_PREFIX_MISMATCH", status: 500 });
    });
    it("blocks test mode with live key", () => {
      const r = evaluateCheckoutGate(envOf({
        STRIPE_RUNTIME_MODE: "test",
        STRIPE_TEST_SECRET_KEY: "sk_live_wrong",
      }));
      expect(r).toEqual({ ok: false, code: "BILLING_SECRET_KEY_PREFIX_MISMATCH", status: 500 });
    });
  });

  describe("describeBillingEnv", () => {
    it("reports only booleans about configuration, never values", () => {
      const status = describeBillingEnv(envOf({
        STRIPE_RUNTIME_MODE: "test",
        STRIPE_TEST_SECRET_KEY: "sk_test_a",
        STRIPE_TEST_WEBHOOK_SECRET: "whsec_a",
        STRIPE_LIVE_SECRET_KEY: "sk_live_b",
        STRIPE_LIVE_WEBHOOK_SECRET: "whsec_b",
        STRIPE_LIVE_ENABLED: "false",
      }));
      expect(status).toEqual({
        stripeRuntimeMode: "test",
        stripeLiveEnabled: false,
        stripeTestKeyConfigured: true,
        stripeTestWebhookConfigured: true,
        stripeLiveKeyConfigured: true,
        stripeLiveWebhookConfigured: true,
        legacyStripeSecretKeyConfigured: false,
        legacyStripeWebhookSecretConfigured: false,
      });
      // Sanity check: no secret value present in any field.
      for (const v of Object.values(status)) {
        if (typeof v === "string") {
          expect(v).not.toMatch(/sk_|whsec_|rk_/);
        }
      }
    });

    it("rejects misclassified test key in live slot (live key configured stays false)", () => {
      const status = describeBillingEnv(envOf({ STRIPE_LIVE_SECRET_KEY: "sk_test_oops" }));
      expect(status.stripeLiveKeyConfigured).toBe(false);
    });
  });

  describe("validateSecretKeyPrefix", () => {
    it("throws with a generic code that does not include the key", () => {
      try {
        validateSecretKeyPrefix("live", "sk_test_super_secret_value");
        throw new Error("should not reach");
      } catch (err) {
        const msg = (err as Error).message;
        expect(msg).toBe("BILLING_SECRET_KEY_PREFIX_MISMATCH");
        expect(msg).not.toContain("sk_test_super_secret_value");
      }
    });
  });

  describe("ANNUAL_MEMBER_EXPECTED constant", () => {
    it("documents canonical annual price attributes without referencing any Stripe ID", () => {
      expect(ANNUAL_MEMBER_EXPECTED).toEqual({
        plan_key: "annual_member",
        currency: "aud",
        unit_amount: 70800,
        recurring_interval: null,
        recurring_interval_count: null,
        active: true,
      });
    });
  });
});
