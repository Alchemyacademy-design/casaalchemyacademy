import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";
import RouteFallback from "@/manus/components/RouteFallback";

describe("RouteFallback (Suspense boundary)", () => {
  it("renders an accessible loading state", () => {
    render(<RouteFallback />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/loading page/i)).toBeInTheDocument();
  });

  it("shows fallback while a lazy route resolves", async () => {
    // A never-resolving lazy import simulates the moment before the chunk
    // loads — the Suspense boundary must show RouteFallback, not the route.
    const NeverResolves = () => {
      throw new Promise<never>(() => {});
    };

    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/lazy"]}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/lazy" element={<NeverResolves />} />
            </Routes>
          </Suspense>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
