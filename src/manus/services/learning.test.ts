import { describe, expect, it } from "vitest";
import {
  canAccessCourse,
  courseProgressPercent,
  lessonStatusFromPercent,
  pickResumeLessonId,
} from "./learning";

const base = { isAdmin: false, isMember: false, hasCourseAccess: false, entitlementCourseIds: [] as number[] };

describe("canAccessCourse", () => {
  it("admin always has access", () => {
    expect(canAccessCourse(1, ["annual_member"], { ...base, isAdmin: true })).toBe(true);
  });
  it("free / guest course is open", () => {
    expect(canAccessCourse(1, [], base)).toBe(true);
    expect(canAccessCourse(1, ["free"], base)).toBe(true);
    expect(canAccessCourse(1, ["guest"], base)).toBe(true);
  });
  it("monthly or annual member gets access to paid courses", () => {
    expect(canAccessCourse(1, ["annual_member"], { ...base, isMember: true })).toBe(true);
    expect(canAccessCourse(1, ["monthly_member"], { ...base, isMember: true })).toBe(true);
  });
  it("entitlement releases only that course", () => {
    const a = { ...base, hasCourseAccess: true, entitlementCourseIds: [42] };
    expect(canAccessCourse(42, ["annual_member"], a)).toBe(true);
    expect(canAccessCourse(7, ["annual_member"], a)).toBe(false);
  });
  it("no access stays locked", () => {
    expect(canAccessCourse(1, ["annual_member"], base)).toBe(false);
  });
});

describe("lessonStatusFromPercent", () => {
  it("maps boundaries", () => {
    expect(lessonStatusFromPercent(0)).toBe("not_started");
    expect(lessonStatusFromPercent(1)).toBe("in_progress");
    expect(lessonStatusFromPercent(99)).toBe("in_progress");
    expect(lessonStatusFromPercent(100)).toBe("completed");
  });
});

describe("courseProgressPercent", () => {
  it("returns 0 when no lessons", () => {
    expect(courseProgressPercent([1], 0, [])).toBe(0);
  });
  it("counts completed lessons in scope", () => {
    const p = [
      { lessonId: 1, moduleId: 10, completed: true },
      { lessonId: 2, moduleId: 10, completed: false },
      { lessonId: 3, moduleId: 99, completed: true },
    ];
    expect(courseProgressPercent([10], 2, p)).toBe(50);
  });
});

describe("pickResumeLessonId", () => {
  const lessons = [{ id: 1 }, { id: 2 }, { id: 3 }];
  it("prioritizes last watched", () => {
    expect(
      pickResumeLessonId(lessons, [
        { lessonId: 1, completed: true, last_watched_at: "2026-01-01T00:00:00Z" },
        { lessonId: 2, completed: false, last_watched_at: "2026-02-01T00:00:00Z" },
      ]),
    ).toBe(2);
  });
  it("falls back to first incomplete", () => {
    expect(
      pickResumeLessonId(lessons, [{ lessonId: 1, completed: true }]),
    ).toBe(2);
  });
  it("returns first lesson when everything completed", () => {
    expect(
      pickResumeLessonId(lessons, [
        { lessonId: 1, completed: true },
        { lessonId: 2, completed: true },
        { lessonId: 3, completed: true },
      ]),
    ).toBe(1);
  });
});
