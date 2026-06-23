/**
 * Phase 1 microcorrection — defense in depth:
 * Public event/workshop queries must filter both status=published AND
 * archived_at IS NULL so archived rows never leak to the public surface.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

type Call = {
  table: string;
  filters: Array<{ type: string; args: unknown[] }>;
};
const calls: Call[] = [];

function reset() {
  calls.length = 0;
}

function makeBuilder(table: string) {
  const state: Call = { table, filters: [] };
  const builder: Record<string, unknown> = {
    select() { return builder; },
    eq(col: string, val: unknown) { state.filters.push({ type: "eq", args: [col, val] }); return builder; },
    is(col: string, val: unknown) { state.filters.push({ type: "is", args: [col, val] }); return builder; },
    gte(col: string, val: unknown) { state.filters.push({ type: "gte", args: [col, val] }); return builder; },
    lt(col: string, val: unknown) { state.filters.push({ type: "lt", args: [col, val] }); return builder; },
    order() { return builder; },
    limit() { return builder; },
    then(resolve: (v: unknown) => unknown) {
      calls.push(state);
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    channel: () => ({
      on() { return this; },
      subscribe() { return this; },
    }),
    removeChannel: () => {},
  },
}));

import {
  useUpcomingEvents,
  usePastEvents,
  useUpcomingWorkshops,
  usePastWorkshops,
} from "@/manus/hooks/usePublicContent";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

function hasFilter(c: Call, type: string, col: string, val?: unknown) {
  return c.filters.some(
    (f) => f.type === type && f.args[0] === col && (val === undefined || f.args[1] === val),
  );
}

describe("public event/workshop queries — archive defense", () => {
  beforeEach(reset);

  it.each([
    ["useUpcomingEvents", useUpcomingEvents, "events"],
    ["usePastEvents", usePastEvents, "events"],
    ["useUpcomingWorkshops", useUpcomingWorkshops, "live_workshops"],
    ["usePastWorkshops", usePastWorkshops, "live_workshops"],
  ] as const)("%s filters status=published AND archived_at IS NULL", async (_name, hook, table) => {
    renderHook(() => hook(), { wrapper: wrapper() });
    await waitFor(() => expect(calls.find((c) => c.table === table)).toBeDefined());
    const call = calls.find((c) => c.table === table)!;
    expect(hasFilter(call, "eq", "status", "published")).toBe(true);
    expect(hasFilter(call, "is", "archived_at", null)).toBe(true);
  });
});
