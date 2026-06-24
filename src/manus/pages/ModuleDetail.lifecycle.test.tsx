/**
 * ModuleDetail — query lifecycle (loading / error+Retry / unavailable /
 * lessons empty / progress error keeps lesson visible).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/manus/components/MemberLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mutable per-test state for the mock trpc surface.
const state = {
  module: { data: undefined as unknown, isLoading: false, isFetching: false, error: null as unknown, refetch: vi.fn() },
  lessons: { data: [] as unknown[], isLoading: false, isFetching: false, error: null as unknown, refetch: vi.fn() },
  progress: { data: [] as unknown[], isLoading: false, isFetching: false, error: null as unknown },
};

vi.mock("@/manus/lib/trpc", () => ({
  trpc: {
    modules: { get: { useQuery: () => state.module } },
    lessons: { byModule: { useQuery: () => state.lessons } },
    progress: {
      moduleProgress: { useQuery: () => state.progress },
      markLesson: {
        useMutation: () => ({ mutateAsync: async () => ({ success: true }) }),
      },
    },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
        in: async () => ({ data: [], error: null }),
      }),
    }),
  },
}));

import ModuleDetail from "./ModuleDetail";

function renderRoute(path = "/modules/10") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/modules/:id" element={<ModuleDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  state.module = { data: { id: 10, title: "Mod", course_id: 1 }, isLoading: false, isFetching: false, error: null, refetch: vi.fn() };
  state.lessons = { data: [], isLoading: false, isFetching: false, error: null, refetch: vi.fn() };
  state.progress = { data: [], isLoading: false, isFetching: false, error: null };
});

describe("ModuleDetail — query lifecycle", () => {
  it("shows module-loading state", () => {
    state.module = { ...state.module, data: undefined, isLoading: true };
    renderRoute();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows error + Retry when module query fails, and calls refetch on click", async () => {
    const refetch = vi.fn();
    state.module = { ...state.module, data: undefined, error: new Error("rls denied"), refetch };
    renderRoute();
    const retry = await screen.findByRole("button", { name: /retry/i });
    fireEvent.click(retry);
    expect(refetch).toHaveBeenCalled();
  });

  it("shows neutral 'unavailable or no access' when module returns null", () => {
    state.module = { ...state.module, data: null };
    renderRoute();
    expect(
      screen.getByText(/module unavailable or you do not have access/i),
    ).toBeInTheDocument();
  });

  it("shows 'No lessons available yet' when module loads but lessons is empty", () => {
    state.lessons = { ...state.lessons, data: [] };
    renderRoute();
    expect(screen.getByText(/no lessons available yet/i)).toBeInTheDocument();
  });

  it("renders the lesson when module loaded, even if progress query errored", async () => {
    state.lessons = {
      ...state.lessons,
      data: [
        { id: 101, title: "L1A", sort_order: 1, number: 1, content_text: null, external_video_url: null },
      ],
    };
    state.progress = { ...state.progress, error: new Error("progress down") };
    renderRoute();
    expect(await screen.findByRole("heading", { name: "L1A" })).toBeInTheDocument();
    expect(screen.getByText(/progress unavailable/i)).toBeInTheDocument();
  });

  it("shows lessons-loading state while lessons fetch is in flight", async () => {
    state.lessons = { ...state.lessons, isLoading: true };
    renderRoute();
    await waitFor(() => {
      expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0);
    });
  });
});
