// Static guard tests for the Phase 1A migration SQL. These tests do NOT
// execute SQL; they assert that the source-of-truth migration file contains
// the security guards required by the Phase 1A audit:
//   - Entitlement branch joins public.courses with archived_at is null
//   - Membership branch joins public.courses with archived_at is null
//   - Quizzes with zero questions are rejected with `quiz_has_no_questions`
//   - Browser code never reads quiz_options directly (sweep)
// Keeping these checks in the test suite means CI fails the moment somebody
// regresses the migration or reintroduces a direct browser read.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SQL_PATH = "docs/migrations/20260625120000_secure_quiz_and_module_ratings.sql";
const sql = readFileSync(SQL_PATH, "utf8");

describe("Phase 1A migration — archived course gating", () => {
  it("entitlement branch joins public.courses and requires archived_at is null", () => {
    // The entitlement EXISTS block must include a join on public.courses with
    // c.archived_at is null. We assert on a normalized fragment.
    const normalized = sql.replace(/\s+/g, " ");
    expect(normalized).toMatch(
      /from public\.course_entitlements e\s+join public\.courses c on c\.id = e\.course_id[\s\S]*?c\.archived_at is null/,
    );
  });

  it("membership branch joins public.courses and requires archived_at is null", () => {
    const normalized = sql.replace(/\s+/g, " ");
    expect(normalized).toMatch(
      /from public\.memberships m\s+join public\.courses c on c\.id = v_quiz\.course_id[\s\S]*?c\.archived_at is null/,
    );
  });

  it("rejects quizzes with zero questions", () => {
    expect(sql).toMatch(/raise exception 'quiz_has_no_questions'/);
    expect(sql).toMatch(/coalesce\(array_length\(v_expected_q, 1\), 0\) = 0/);
  });

  it("revokes table-level SELECT on quiz_options from authenticated and anon", () => {
    expect(sql).toMatch(/revoke select on table public\.quiz_options from authenticated/);
    expect(sql).toMatch(/revoke select on table public\.quiz_options from anon/);
  });

  it("uses a single explicit begin/commit envelope", () => {
    const begins = sql.match(/^\s*begin;\s*$/gim) ?? [];
    const commits = sql.match(/^\s*commit;\s*$/gim) ?? [];
    expect(begins.length).toBe(1);
    expect(commits.length).toBe(1);
  });
});

describe("Browser bundle never reads quiz_options directly", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  }

  it("no .from(\"quiz_options\").select(...) call lives under src/ outside types/tests", () => {
    const files = walk("src");
    const offenders: string[] = [];
    for (const file of files) {
      if (
        file.includes("integrations/supabase/types.ts") ||
        file.endsWith(".test.ts") ||
        file.endsWith(".test.tsx")
      )
        continue;
      const txt = readFileSync(file, "utf8");
      // direct SELECT reads from the table
      if (/\.from\(\s*["']quiz_options["']\s*\)[\s\S]{0,200}\.select\(/.test(txt)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
