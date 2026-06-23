/**
 * Component tests for AdminTablePage.
 *
 * Verifies the behaviors required by the Phase 1 final corrections:
 * pagination, search debounce, retry, deletion policy (disabled/archive)
 * and the no-`*`-select invariant.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import AdminTablePage from "@/manus/components/admin/AdminTablePage";

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

type SelectCall = {
  table: string;
  select: string;
  range?: [number, number];
  filters: Array<{ type: string; args: unknown[] }>;
  countOption?: string;
};
const calls: SelectCall[] = [];
let fakeRows: Array<Record<string, unknown>> = [];
let fakeCount = 0;
let shouldError = false;
let errorCount = 0;
let updateCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
let deleteCalled = false;

function resetMocks() {
  calls.length = 0;
  fakeRows = [];
  fakeCount = 0;
  shouldError = false;
  errorCount = 0;
  updateCalls = [];
  deleteCalled = false;
}

function makeBuilder(table: string) {
  const state: SelectCall = { table, select: "", filters: [] };
  const builder: Record<string, unknown> = {
    select(sel: string, opts?: { count?: string }) {
      state.select = sel;
      state.countOption = opts?.count;
      return builder;
    },
    is(col: string, val: unknown) {
      state.filters.push({ type: "is", args: [col, val] });
      return builder;
    },
    or(filter: string) {
      state.filters.push({ type: "or", args: [filter] });
      return builder;
    },
    order(col: string, opts?: unknown) {
      state.filters.push({ type: "order", args: [col, opts] });
      return builder;
    },
    range(from: number, to: number) {
      state.range = [from, to];
      return builder;
    },
    update(payload: Record<string, unknown>) {
      updateCalls.push({ table, payload });
      return {
        eq: async () => ({ error: null }),
      };
    },
    insert: async () => ({ error: null }),
    delete() {
      deleteCalled = true;
      return { eq: async () => ({ error: null }) };
    },
    eq() {
      return builder;
    },
    then(resolve: (v: unknown) => unknown) {
      calls.push(state);
      if (shouldError) {
        errorCount++;
        if (errorCount === 1) {
          return Promise.resolve({ data: null, count: null, error: { message: "boom" } }).then(resolve);
        }
      }
      return Promise.resolve({ data: fakeRows, count: fakeCount, error: null }).then(resolve);
    },
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function renderPage(overrides: Partial<React.ComponentProps<typeof AdminTablePage>> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminTablePage
          title="Events"
          table={"events" as never}
          primaryKey="id"
          fields={[
            { name: "title", label: "Title", type: "text" },
            { name: "status", label: "Status", type: "text" },
          ]}
          searchFields={["title"]}
          orderBy={{ column: "starts_at", ascending: true }}
          {...overrides}
        />
      </MemoryRouter>,
    </QueryClientProvider>,
  );
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("AdminTablePage — pagination", () => {
  beforeEach(resetMocks);

  it("first load requests range(0, 19) and shows the total count", async () => {
    fakeRows = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `E${i}`, status: "draft" }));
    fakeCount = 87;
    renderPage();
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0].range).toEqual([0, 19]);
    expect(calls[0].countOption).toBe("exact");
    expect(await screen.findByText(/of 87/)).toBeInTheDocument();
  });

  it("never selects '*' — minimal select includes id, fields, orderBy, search", async () => {
    fakeRows = []; fakeCount = 0;
    renderPage();
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    const sel = calls[0].select;
    expect(sel).not.toBe("*");
    expect(sel.split(",")).toEqual(expect.arrayContaining(["id", "title", "status", "starts_at"]));
  });

  it("Next advances to page 2 → range(20, 39); Previous goes back", async () => {
    fakeRows = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `E${i}`, status: "draft" }));
    fakeCount = 87;
    renderPage();
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    fireEvent.click(await screen.findByRole("button", { name: /next page/i }));
    await waitFor(() => expect(calls.at(-1)?.range).toEqual([20, 39]));
    fireEvent.click(screen.getByRole("button", { name: /previous page/i }));
    await waitFor(() => expect(calls.at(-1)?.range).toEqual([0, 19]));
  });

  it("Next is disabled on the last page", async () => {
    fakeRows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, title: `E${i}`, status: "draft" }));
    fakeCount = 5; // single page
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled());
  });
});

describe("AdminTablePage — search", () => {
  beforeEach(resetMocks);

  it("debounces input, resets to page 0, and sends ilike to the server", async () => {
    vi.useFakeTimers();
    fakeRows = []; fakeCount = 0;
    renderPage();
    // Trigger initial load.
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const before = calls.length;
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "foo" } });
    // Within debounce window: no extra call yet.
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(calls.length).toBe(before);
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    const last = calls.at(-1)!;
    const orFilter = last.filters.find((f) => f.type === "or");
    expect(orFilter).toBeDefined();
    expect(String(orFilter!.args[0])).toContain("title.ilike.*foo*");
    expect(last.range).toEqual([0, 19]); // back to first page
    vi.useRealTimers();
  });
});

describe("AdminTablePage — retry on error", () => {
  beforeEach(resetMocks);

  it("shows Retry button on error, refetch succeeds", async () => {
    shouldError = true;
    fakeRows = [{ id: 1, title: "ok", status: "draft" }];
    fakeCount = 1;
    renderPage();
    const retry = await screen.findByRole("button", { name: /retry/i });
    expect(retry).toBeInTheDocument();
    fireEvent.click(retry);
    expect(await screen.findByText("ok")).toBeInTheDocument();
  });
});

describe("AdminTablePage — deletion modes", () => {
  beforeEach(resetMocks);

  it("deletionMode='disabled' renders no destructive button", async () => {
    fakeRows = [{ id: 1, title: "ok", status: "draft" }];
    fakeCount = 1;
    renderPage({ deletionMode: "disabled" });
    await screen.findByText("ok");
    expect(screen.queryByRole("button", { name: /delete|archive/i })).toBeNull();
  });

  it("deletionMode='archive' calls update({ archived_at, ... }) and never delete()", async () => {
    fakeRows = [{ id: 42, title: "ok", status: "draft" }];
    fakeCount = 1;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage({ deletionMode: "archive" });
    await screen.findByText("ok");
    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));
    await waitFor(() => expect(updateCalls.length).toBe(1));
    expect(updateCalls[0].payload).toHaveProperty("archived_at");
    expect(typeof updateCalls[0].payload.archived_at).toBe("string");
    expect(deleteCalled).toBe(false);
    confirmSpy.mockRestore();
  });

  it("archivePatch merges extra fields into the archive payload", async () => {
    fakeRows = [{ id: 7, title: "ok", status: "draft" }];
    fakeCount = 1;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage({ deletionMode: "archive", archivePatch: { status: "archived" } });
    await screen.findByText("ok");
    fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));
    await waitFor(() => expect(updateCalls.length).toBe(1));
    expect(updateCalls[0].payload).toMatchObject({ status: "archived" });
    expect(updateCalls[0].payload).toHaveProperty("archived_at");
    expect(deleteCalled).toBe(false);
    confirmSpy.mockRestore();
  });
});
