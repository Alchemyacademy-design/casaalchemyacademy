/**
 * CourseDetail — Retry path.
 * Verifies that the query exposes refetch and that, after an error, the user
 * sees a Retry button which when clicked triggers a successful refetch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

let call = 0;
const courseTree = {
  id: 1,
  title: "Test Course",
  slug: "test",
  subtitle: null,
  description: null,
  cover_image_path: null,
  status: "published",
  access_plan_keys: null,
  course_modules: [],
};

// Builder used by fetchCourseTree(includeDrafts=false).
function makeCoursesBuilder() {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    async maybeSingle() {
      call++;
      if (call === 1) return { data: null, error: { message: "network down" } };
      return { data: courseTree, error: null };
    },
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => makeCoursesBuilder() },
}));

vi.mock("@/manus/hooks/useAuth", () => ({
  useAuth: () => ({
    isAdmin: false,
    isMember: true,
    hasCourseAccess: () => true,
    activeEntitlements: [],
  }),
}));

vi.mock("@/manus/services/admin-content", () => ({
  getCoursesTree: async () => ({ courses: [courseTree], counts: { courses: 1, modules: 0, lessons: 0, missing_video_urls: 0, draft_courses: 0, published_courses: 1 } }),
}));

vi.mock("@/manus/lib/trpc", () => ({
  trpc: {
    lessons: {
      progress: { useQuery: () => ({ data: [] }) },
      markComplete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

vi.mock("@/manus/components/MemberLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CourseDetail from "./CourseDetail";

beforeEach(() => {
  call = 0;
});

describe("CourseDetail — Retry path", () => {
  it("shows Retry on error, then renders the course after refetch", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/courses/1"]}>
          <Routes>
            <Route path="/courses/:id" element={<CourseDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(retry).toBeInTheDocument();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText("Test Course")).toBeInTheDocument());
  });
});
