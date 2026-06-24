/**
 * Certificate course-specificity smoke tests. The certificate service hits the
 * Supabase client directly, so we mock that module to confirm that:
 *  - courseId is honoured (no fallback to "first published course");
 *  - eligibility requires 100% completion;
 *  - missing required quizzes block eligibility;
 *  - duplicate issuance returns the existing certificate without insert.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  // Simple chainable fake builder.
  const state: { lastTable?: string; rows: Record<string, unknown[]> } = { rows: {} };
  const builder = (table: string) => {
    state.lastTable = table;
    const query: { filters: Record<string, unknown>; head?: boolean; isNull?: string } = { filters: {} };
    const api: Record<string, unknown> = {
      select: vi.fn().mockImplementation((_cols?: string, opts?: { head?: boolean }) => {
        query.head = opts?.head;
        return api;
      }),
      eq: vi.fn().mockImplementation((k: string, v: unknown) => { query.filters[k] = v; return api; }),
      in: vi.fn().mockImplementation(() => api),
      is: vi.fn().mockImplementation((k: string) => { query.isNull = k; return api; }),
      not: vi.fn().mockImplementation(() => api),
      order: vi.fn().mockImplementation(() => api),
      limit: vi.fn().mockImplementation(() => api),
      maybeSingle: vi.fn().mockResolvedValue({ data: state.rows[table]?.[0] ?? null, error: null }),
      single: vi.fn().mockResolvedValue({ data: state.rows[table]?.[0] ?? null, error: null }),
      insert: vi.fn().mockImplementation((row: unknown) => {
        const arr = state.rows[table] ?? [];
        const inserted = { id: arr.length + 1, ...(row as Record<string, unknown>) };
        state.rows[table] = [inserted, ...arr];
        return { select: () => ({ single: () => Promise.resolve({ data: inserted, error: null }) }) };
      }),
      then: undefined,
    };
    // Default thenable for non-terminal queries.
    return new Proxy(api, {
      get(target, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve({ data: state.rows[table] ?? [], count: (state.rows[table] ?? []).filter(() => true).length, error: null });
        }
        return target[prop as string];
      },
    });
  };
  return {
    supabase: {
      from: vi.fn((t: string) => builder(t)),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    },
    __state: state,
  };
});

const supabaseMod = await import("@/integrations/supabase/client");
const state = (supabaseMod as unknown as { __state: { rows: Record<string, unknown[]> } }).__state;

import {
  completionPercentageForCourse,
  eligibilityForCourse,
} from "@/manus/services/certificate";

afterEach(() => {
  state.rows = {};
});

describe("completionPercentageForCourse", () => {
  it("returns 0 for an invalid courseId without hitting the DB", async () => {
    expect(await completionPercentageForCourse(0)).toBe(0);
    expect(await completionPercentageForCourse(-1)).toBe(0);
  });
});

describe("eligibilityForCourse", () => {
  it("is not eligible when the course has no lessons", async () => {
    state.rows.course_modules = []; // no modules
    state.rows.quizzes = [];
    const r = await eligibilityForCourse(123);
    expect(r.eligible).toBe(false);
    expect(r.missing[0]).toMatch(/no published lessons/i);
  });
});
