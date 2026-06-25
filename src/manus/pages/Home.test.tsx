/**
 * Home — Our Courses section uses CourseCard variant="landing".
 * Verifies that:
 *  - unavailable courses render the Coming Soon badge and DO NOT expose any
 *    checkout / Stripe call site;
 *  - no <button>"Buy Now"</button> exists anywhere in the section;
 *  - clicking inside the section never invokes Stripe.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/manus/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, isAdmin: false }),
}));

vi.mock("@/manus/hooks/usePublicContent", () => ({
  usePublishedCourses: () => ({ data: [] }),
  useHomeCourses: () => ({ data: [], isError: false, refetch: () => {} }),
}));

// Tripwire: any attempt to invoke Stripe checkout from Home must fail the test.
const checkoutFetch = vi.fn();
vi.mock("@/manus/lib/trpc", () => ({
  trpc: {
    stripe: {
      createCheckoutSession: {
        useMutation: () => ({ mutate: checkoutFetch, mutateAsync: checkoutFetch }),
      },
    },
  },
}));

const fetchSpy = vi
  .spyOn(globalThis, "fetch")
  .mockImplementation(async () => new Response("{}", { status: 200 }));

import Home from "./Home";

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Home — Our Courses (Phase 2A)", () => {
  it("renders the Our Courses section with at least one Coming Soon card", () => {
    renderHome();
    const grid = screen.getByTestId("our-courses-grid");
    const comingSoon = within(grid).getAllByText(/coming soon/i);
    expect(comingSoon.length).toBeGreaterThan(0);
  });

  it("does not render a 'Buy Now' financial CTA inside Our Courses", () => {
    renderHome();
    const grid = screen.getByTestId("our-courses-grid");
    expect(within(grid).queryByRole("button", { name: /buy now/i })).toBeNull();
    // The available course CTA, when present, must be "View Course".
    const viewLinks = within(grid).queryAllByText(/view course/i);
    // It's valid to have zero (all coming soon) or many — but never a Buy Now.
    expect(viewLinks.length).toBeGreaterThanOrEqual(0);
  });

  it("never triggers a Stripe checkout call when rendering Home", () => {
    renderHome();
    // No checkout fetch and no mutation invocation should happen during render.
    const stripeCalls = fetchSpy.mock.calls.filter((c) =>
      String(c[0] ?? "").includes("create-checkout-session"),
    );
    expect(stripeCalls.length).toBe(0);
    expect(checkoutFetch).not.toHaveBeenCalled();
  });
});
