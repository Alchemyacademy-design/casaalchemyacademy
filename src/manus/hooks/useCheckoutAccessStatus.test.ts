import { describe, expect, it } from "vitest";
import { ACCESS_COPY, deriveAccessState, type AccessStatusInput } from "./useCheckoutAccessStatus";

const base: AccessStatusInput = {
  authLoading: false,
  signedIn: true,
  statusLoading: false,
  accessConfirmed: false,
  hasPaidAccess: false,
  pollingExhausted: false,
};

describe("deriveAccessState", () => {
  it("waits while auth is loading", () => {
    expect(deriveAccessState({ ...base, authLoading: true })).toBe("loading");
  });

  it("reports guest when signed out", () => {
    expect(deriveAccessState({ ...base, signedIn: false })).toBe("guest");
  });

  it("reports granted when Stripe confirmed access", () => {
    expect(deriveAccessState({ ...base, accessConfirmed: true })).toBe("granted");
  });

  it("reports granted when entitlements already active", () => {
    expect(deriveAccessState({ ...base, hasPaidAccess: true })).toBe("granted");
  });

  it("reports pending while the webhook has not confirmed yet", () => {
    expect(deriveAccessState(base)).toBe("pending");
  });

  it("reports none once polling is exhausted without access", () => {
    expect(deriveAccessState({ ...base, pollingExhausted: true })).toBe("none");
  });

  it("prefers granted over loading status fetches", () => {
    expect(deriveAccessState({ ...base, statusLoading: true, accessConfirmed: true })).toBe("granted");
  });

  it("has copy for every state", () => {
    for (const state of ["loading", "guest", "granted", "pending", "none"] as const) {
      expect(ACCESS_COPY[state].label.length).toBeGreaterThan(0);
    }
  });
});
