/**
 * pickResumeLessonId — last_watched_at precedence rules.
 */
import { describe, it, expect } from "vitest";
import { pickResumeLessonId } from "./learning";

const LESSONS = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
];

describe("pickResumeLessonId — last_watched_at semantics", () => {
  it("returns the lesson with the most recent last_watched_at", () => {
    const id = pickResumeLessonId(LESSONS, [
      { lessonId: 1, completed: true, last_watched_at: "2026-06-20T10:00:00Z" },
      { lessonId: 3, completed: false, last_watched_at: "2026-06-23T10:00:00Z" },
      { lessonId: 2, completed: false, last_watched_at: "2026-06-22T10:00:00Z" },
    ]);
    expect(id).toBe(3);
  });

  it("falls back to first incomplete when no last_watched_at is present", () => {
    const id = pickResumeLessonId(LESSONS, [
      { lessonId: 1, completed: true },
    ]);
    expect(id).toBe(2);
  });

  it("ignores progress whose lessonId is not in this ordered list (other course)", () => {
    const id = pickResumeLessonId(LESSONS, [
      { lessonId: 999, completed: false, last_watched_at: "2099-01-01T00:00:00Z" },
      { lessonId: 1, completed: true, last_watched_at: "2026-06-20T10:00:00Z" },
    ]);
    // 999 wins by date but is not in our list — so the algorithm should
    // fall through to first incomplete (lesson 2).
    expect(id).toBe(2);
  });

  it("returns null when there are no lessons", () => {
    expect(pickResumeLessonId([], [])).toBeNull();
  });

  it("returns the only lesson when single-item list and no progress", () => {
    expect(pickResumeLessonId([{ id: 42 }], [])).toBe(42);
  });
});
