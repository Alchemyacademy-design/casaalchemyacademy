import { describe, it, expect } from "vitest";
import {
  DESIGNATED_ADMIN_EMAIL,
  isDesignatedAdminEmail,
  maskStripeId,
} from "./admin-api";

describe("admin-api helpers", () => {
  it("designated admin email is the casa alchemy contact", () => {
    expect(DESIGNATED_ADMIN_EMAIL).toBe("contact@casaalchemystudio.com");
  });

  it("isDesignatedAdminEmail matches case/whitespace insensitively", () => {
    expect(isDesignatedAdminEmail("contact@casaalchemystudio.com")).toBe(true);
    expect(isDesignatedAdminEmail("  Contact@CasaAlchemyStudio.com  ")).toBe(true);
    expect(isDesignatedAdminEmail("someone@else.com")).toBe(false);
    expect(isDesignatedAdminEmail(null)).toBe(false);
    expect(isDesignatedAdminEmail(undefined)).toBe(false);
    expect(isDesignatedAdminEmail("")).toBe(false);
  });

  it("maskStripeId masks long ids and passes through short/empty", () => {
    expect(maskStripeId("sub_1234567890ABCD")).toBe("sub_***ABCD");
    expect(maskStripeId("short")).toBe("short");
    expect(maskStripeId(null)).toBe("—");
    expect(maskStripeId(undefined)).toBe("—");
  });
});
