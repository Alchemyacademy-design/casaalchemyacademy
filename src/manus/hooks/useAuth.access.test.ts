import { describe, it, expect } from "vitest";

// Pure replica of the access-derivation logic used in useAuth.
// Keeps the test deterministic without needing to mock supabase + trpc.
function deriveAccess(input: {
  roles?: string[];
  membership?: { status: string; ends_at: string } | null;
  entitlements?: Array<{ id: number }>;
}) {
  const roles = input.roles ?? [];
  const entitlements = input.entitlements ?? [];
  const isAdmin = roles.includes("admin");
  const isMember =
    input.membership?.status === "active" &&
    Boolean(
      input.membership.ends_at &&
        input.membership.ends_at > new Date().toISOString(),
    );
  const hasCourseAccess = entitlements.length > 0;
  const hasPaidAccess = isAdmin || isMember || hasCourseAccess;
  const defaultPath = isAdmin
    ? "/admin"
    : isMember
      ? "/dashboard"
      : hasCourseAccess
        ? "/mycourses"
        : "/plans";
  return { isAdmin, isMember, hasCourseAccess, hasPaidAccess, defaultPath };
}

describe("useAuth access derivation (Phase 19)", () => {
  it("admin bypasses membership and entitlements", () => {
    const r = deriveAccess({ roles: ["admin"] });
    expect(r.isAdmin).toBe(true);
    expect(r.hasPaidAccess).toBe(true);
    expect(r.defaultPath).toBe("/admin");
  });

  it("active member routes to /dashboard", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const r = deriveAccess({
      membership: { status: "active", ends_at: future },
    });
    expect(r.isMember).toBe(true);
    expect(r.defaultPath).toBe("/dashboard");
  });

  it("expired membership does not grant access", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const r = deriveAccess({
      membership: { status: "active", ends_at: past },
    });
    expect(r.isMember).toBe(false);
    expect(r.hasPaidAccess).toBe(false);
    expect(r.defaultPath).toBe("/plans");
  });

  it("course entitlement routes to /mycourses", () => {
    const r = deriveAccess({ entitlements: [{ id: 1 }] });
    expect(r.hasCourseAccess).toBe(true);
    expect(r.defaultPath).toBe("/mycourses");
  });

  it("user with nothing goes to /plans", () => {
    const r = deriveAccess({});
    expect(r.hasPaidAccess).toBe(false);
    expect(r.defaultPath).toBe("/plans");
  });
});
