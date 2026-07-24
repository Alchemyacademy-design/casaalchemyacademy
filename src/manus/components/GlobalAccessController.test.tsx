/**
 * GlobalAccessController — routing gate driven by auth.me flags
 * (isAuthenticated / isAdmin / isMember / hasCourseAccess).
 *
 * Exercises /login, /plans, /mycourses, /dashboard against every persona
 * shape auth.me can return, and asserts the resulting navigate() call.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

const authState: {
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMember: boolean;
  hasCourseAccess: boolean;
} = {
  loading: false,
  isAuthenticated: false,
  isAdmin: false,
  isMember: false,
  hasCourseAccess: false,
};
vi.mock("@/manus/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

import GlobalAccessController from "./GlobalAccessController";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GlobalAccessController />
    </MemoryRouter>,
  );
}

function setAuth(partial: Partial<typeof authState>) {
  Object.assign(authState, {
    loading: false,
    isAuthenticated: false,
    isAdmin: false,
    isMember: false,
    hasCourseAccess: false,
  }, partial);
}

beforeEach(() => {
  navigateMock.mockReset();
});

describe("GlobalAccessController — /login (public)", () => {
  it("does not redirect an unauthenticated visitor", () => {
    setAuth({ isAuthenticated: false });
    renderAt("/login");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not redirect an authenticated user (Login page owns its own redirect)", () => {
    setAuth({ isAuthenticated: true, isMember: true });
    renderAt("/login");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe("GlobalAccessController — /plans", () => {
  it("redirects an unauthenticated visitor to /login", () => {
    setAuth({ isAuthenticated: false });
    renderAt("/plans");
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });

  it("allows an authenticated user with no paid access to stay", () => {
    setAuth({ isAuthenticated: true });
    renderAt("/plans");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("allows an active member to view /plans (no forced redirect)", () => {
    setAuth({ isAuthenticated: true, isMember: true });
    renderAt("/plans");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe("GlobalAccessController — /mycourses", () => {
  it("redirects an unauthenticated visitor to /login", () => {
    setAuth({ isAuthenticated: false });
    renderAt("/mycourses");
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });

  it("redirects an authenticated user with no paid access to /plans", () => {
    setAuth({ isAuthenticated: true });
    renderAt("/mycourses");
    expect(navigateMock).toHaveBeenCalledWith("/plans");
  });

  it("allows a user with only a course entitlement to stay", () => {
    setAuth({ isAuthenticated: true, hasCourseAccess: true });
    renderAt("/mycourses");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("allows an active member to stay", () => {
    setAuth({ isAuthenticated: true, isMember: true });
    renderAt("/mycourses");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("allows an admin to stay", () => {
    setAuth({ isAuthenticated: true, isAdmin: true });
    renderAt("/mycourses");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe("GlobalAccessController — /dashboard (membership-only)", () => {
  it("redirects an unauthenticated visitor to /login", () => {
    setAuth({ isAuthenticated: false });
    renderAt("/dashboard");
    expect(navigateMock).toHaveBeenCalledWith("/login");
  });

  it("redirects an authenticated user with no paid access to /plans", () => {
    setAuth({ isAuthenticated: true });
    renderAt("/dashboard");
    expect(navigateMock).toHaveBeenCalledWith("/plans");
  });

  it("redirects a course-only user (no membership) to /mycourses", () => {
    setAuth({ isAuthenticated: true, hasCourseAccess: true });
    renderAt("/dashboard");
    expect(navigateMock).toHaveBeenCalledWith("/mycourses");
  });

  it("allows an active member to stay", () => {
    setAuth({ isAuthenticated: true, isMember: true });
    renderAt("/dashboard");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("allows an admin to stay (bypasses membership check)", () => {
    setAuth({ isAuthenticated: true, isAdmin: true });
    renderAt("/dashboard");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe("GlobalAccessController — loading state", () => {
  it("never navigates while auth.me is still loading", () => {
    setAuth({ loading: true, isAuthenticated: false });
    renderAt("/dashboard");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

// Regression coverage for the loading-race bug class fixed in
// CourseDetail/PaymentSuccess/Modules: while `loading` is true the
// component must not act on stale/default auth flags, regardless of
// what those flags happen to be or which route is active.
describe("GlobalAccessController — loading gate (regression)", () => {
  const routes = ["/login", "/plans", "/mycourses", "/dashboard"];
  const personas: Array<[string, Partial<typeof authState>]> = [
    ["default flags", {}],
    ["stale unauthenticated", { isAuthenticated: false }],
    ["stale authenticated no-access", { isAuthenticated: true }],
    ["stale course-only", { isAuthenticated: true, hasCourseAccess: true }],
    ["stale member", { isAuthenticated: true, isMember: true }],
    ["stale admin", { isAuthenticated: true, isAdmin: true }],
  ];
  for (const route of routes) {
    for (const [label, persona] of personas) {
      it(`does not navigate on ${route} while loading (${label})`, () => {
        setAuth({ ...persona, loading: true });
        renderAt(route);
        expect(navigateMock).not.toHaveBeenCalled();
      });
    }
  }
});

describe("GlobalAccessController — membershipOnlyPrefixes (isMember bypass)", () => {
  const memberRoutes = [
    "/dashboard",
    "/community",
    "/magazine",
    "/suppliers",
    "/events",
  ];
  for (const route of memberRoutes) {
    it(`allows an active member on ${route}`, () => {
      setAuth({ isAuthenticated: true, isMember: true });
      renderAt(route);
      expect(navigateMock).not.toHaveBeenCalled();
    });
  }
});

describe("GlobalAccessController — admin bypass", () => {
  it("admin is not redirected from /dashboard", () => {
    setAuth({ isAuthenticated: true, isAdmin: true });
    renderAt("/dashboard");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("admin is not redirected from /plans", () => {
    setAuth({ isAuthenticated: true, isAdmin: true });
    renderAt("/plans");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("admin bypasses membership gate even without isMember/hasCourseAccess", () => {
    setAuth({ isAuthenticated: true, isAdmin: true });
    renderAt("/community");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});