/**
 * Component tests for ModuleDetail covering the hash + module-switch
 * lifecycle that pure helpers cannot validate on their own.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/manus/components/MemberLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// trpc proxy — every page that imports it gets the same mocked surface
const moduleByIdMock = vi.fn();
const lessonsByModuleMock = vi.fn();
const moduleProgressMock = vi.fn(() => []);
const markLessonMock = vi.fn(() => Promise.resolve({ success: true }));

vi.mock("@/manus/lib/trpc", () => ({
  trpc: {
    modules: {
      get: {
        useQuery: ({ id }: { id: number }) => ({ data: moduleByIdMock(id) }),
      },
    },
    lessons: {
      byModule: {
        useQuery: ({ moduleId }: { moduleId: number }) => ({
          data: lessonsByModuleMock(moduleId),
        }),
      },
    },
    progress: {
      moduleProgress: {
        useQuery: ({ moduleId }: { moduleId: number }) => ({
          data: moduleProgressMock(moduleId),
        }),
      },
      markLesson: {
        useMutation: (opts: { onSuccess?: () => void } = {}) => ({
          mutateAsync: async (input: unknown) => {
            const r = await markLessonMock(input);
            await opts.onSuccess?.();
            return r;
          },
        }),
      },
    },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { id: 1, title: "Course A" }, error: null }) }),
        in: async () => ({ data: [], error: null }),
      }),
    }),
  },
}));

import ModuleDetail from "./ModuleDetail";

const MODULE_1 = { id: 10, title: "Mod 1", course_id: 1 };
const MODULE_2 = { id: 20, title: "Mod 2", course_id: 1 };
const LESSONS_1 = [
  { id: 101, title: "L1A", sort_order: 1, number: 1, content_text: null, external_video_url: null },
  { id: 102, title: "L1B", sort_order: 2, number: 2, content_text: null, external_video_url: null },
  { id: 103, title: "L1C", sort_order: 3, number: 3, content_text: null, external_video_url: null },
];
const LESSONS_2 = [
  { id: 201, title: "L2A", sort_order: 1, number: 1, content_text: null, external_video_url: null },
  { id: 202, title: "L2B", sort_order: 2, number: 2, content_text: null, external_video_url: null },
];

function renderRoute(path: string) {
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
  moduleByIdMock.mockImplementation((id: number) => (id === 10 ? MODULE_1 : MODULE_2));
  lessonsByModuleMock.mockImplementation((id: number) => (id === 10 ? LESSONS_1 : LESSONS_2));
});

describe("ModuleDetail", () => {
  it("selects the first lesson when no hash is present", () => {
    renderRoute("/modules/10");
    // active heading shows the first lesson
    expect(screen.getByRole("heading", { name: "L1A" })).toBeInTheDocument();
  });

  it("applies #lesson-<id> hash on initial render when valid", () => {
    renderRoute("/modules/10#lesson-102");
    expect(screen.getByRole("heading", { name: "L1B" })).toBeInTheDocument();
  });

  it("ignores a hash whose id belongs to another module and falls back to lessons[0]", () => {
    // 201 lives in module 2 — must not select it inside module 1
    renderRoute("/modules/10#lesson-201");
    expect(screen.getByRole("heading", { name: "L1A" })).toBeInTheDocument();
  });

  it("clicking a different lesson does not get re-trapped by the hash", () => {
    renderRoute("/modules/10#lesson-101");
    expect(screen.getByRole("heading", { name: "L1A" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /L1C/ }));
    expect(screen.getByRole("heading", { name: "L1C" })).toBeInTheDocument();
  });

  it("Previous and Next traverse the sibling lessons", () => {
    renderRoute("/modules/10#lesson-102");
    expect(screen.getByRole("heading", { name: "L1B" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByRole("heading", { name: "L1C" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Previous/i }));
    expect(screen.getByRole("heading", { name: "L1B" })).toBeInTheDocument();
  });

  it("resets the active lesson when moduleId changes", () => {
    const { unmount } = renderRoute("/modules/10");
    expect(screen.getByRole("heading", { name: "L1A" })).toBeInTheDocument();
    unmount();
    renderRoute("/modules/20");
    // Module 2's first lesson must be active even though we had L1A before.
    expect(screen.getByRole("heading", { name: "L2A" })).toBeInTheDocument();
    // L1 lessons must NOT be present in module 2's sidebar
    expect(screen.queryByRole("heading", { name: "L1A" })).toBeNull();
  });
});
