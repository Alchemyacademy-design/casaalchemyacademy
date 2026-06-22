import { describe, expect, it } from "vitest";
import {
  buildLessonShareBody,
  canLoadMorePosts,
  dedupePostPages,
  filterPosts,
  parseLessonHash,
  POSTS_PAGE_SIZE,
  readCommunityUrlParams,
  resolveDeepLinkChannel,
} from "./community-deeplink";

/* ----------------------- URL params (criterion 1) ----------------------- */
describe("readCommunityUrlParams", () => {
  it("reads channel/title/body from query string", () => {
    const p = readCommunityUrlParams(
      "?channel=projects&title=Hi%20there&body=Line%201%0ALine%202",
    );
    expect(p.channel).toBe("projects");
    expect(p.title).toBe("Hi there");
    expect(p.body).toBe("Line 1\nLine 2");
  });
  it("returns undefined for missing keys", () => {
    expect(readCommunityUrlParams("")).toEqual({});
  });
});

/* ------------------ Deep-link resolution (criteria 2-7) ------------------ */
describe("resolveDeepLinkChannel", () => {
  const channels = {
    projects: { id: 11, slug: "projects", space_id: 1 },
    questions: { id: 12, slug: "questions", space_id: 1 },
    general: { id: 13, slug: "general", space_id: 1 },
    foreign: { id: 99, slug: "resources", space_id: 7 }, // lives in another space
  } as const;

  it("returns null when no slug requested", () => {
    expect(resolveDeepLinkChannel(null, null)).toBeNull();
  });
  it("resolves real channel `projects`", () => {
    const r = resolveDeepLinkChannel("projects", channels.projects);
    expect(r).toEqual({ kind: "match", channelId: 11, spaceId: 1 });
  });
  it("resolves real channel `questions`", () => {
    const r = resolveDeepLinkChannel("questions", channels.questions);
    expect(r).toEqual({ kind: "match", channelId: 12, spaceId: 1 });
  });
  it("resolves real channel `general`", () => {
    const r = resolveDeepLinkChannel("general", channels.general);
    expect(r).toEqual({ kind: "match", channelId: 13, spaceId: 1 });
  });
  it("returns the channel's own space_id even when it lives in another space", () => {
    const r = resolveDeepLinkChannel("resources", channels.foreign);
    expect(r).toEqual({ kind: "match", channelId: 99, spaceId: 7 });
  });
  it("falls back to not-found when slug is unknown", () => {
    expect(resolveDeepLinkChannel("project-sharing", null)).toEqual({
      kind: "not-found",
      slug: "project-sharing",
    });
  });
});

/* --------------------- Prefill preserved on fallback --------------------- */
describe("prefill stays preserved on slug fallback", () => {
  // Pure-helper proxy: when slug not found, caller still gets the original
  // title/body from the URL — the helper never mutates them.
  it("readCommunityUrlParams keeps title/body even if channel missing", () => {
    const p = readCommunityUrlParams(
      "?channel=nope&title=Kept&body=Body%20text",
    );
    expect(p.channel).toBe("nope");
    expect(p.title).toBe("Kept");
    expect(p.body).toBe("Body text");
  });
});

/* ----------------------- Filters (criteria 8-10) ----------------------- */
describe("filterPosts", () => {
  const posts = [
    { title: "Hello world", body: "first body", pinned: true, author_id: "u1" },
    { title: null, body: "ALPHA only in body", pinned: false, author_id: "u2" },
    { title: "Mine", body: "personal", pinned: false, author_id: "u1" },
  ];

  it("searches title and body case-insensitively", () => {
    expect(filterPosts(posts, "alpha", "all", "u1")).toHaveLength(1);
    expect(filterPosts(posts, "hello", "all", "u1")).toHaveLength(1);
  });
  it("filter=mine keeps only the current user's posts", () => {
    const r = filterPosts(posts, "", "mine", "u1");
    expect(r).toHaveLength(2);
    expect(r.every((p) => p.author_id === "u1")).toBe(true);
  });
  it("filter=pinned keeps only pinned", () => {
    const r = filterPosts(posts, "", "pinned", "u1");
    expect(r).toHaveLength(1);
    expect(r[0].pinned).toBe(true);
  });
});

/* ----------------- Pagination (criteria 11-12) ----------------- */
describe("dedupePostPages + canLoadMorePosts", () => {
  it("PAGE_SIZE is 20", () => {
    expect(POSTS_PAGE_SIZE).toBe(20);
  });
  it("concatenates pages without duplicating ids", () => {
    const page1 = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
    const page2 = [{ id: 20 }, { id: 21 }, { id: 22 }]; // 20 overlaps
    const all = dedupePostPages([page1, page2]);
    expect(all).toHaveLength(22);
    expect(new Set(all.map((p) => p.id)).size).toBe(22);
  });
  it("Carregar mais visible only when last page was full", () => {
    expect(canLoadMorePosts(20)).toBe(true);
    expect(canLoadMorePosts(19)).toBe(false);
    expect(canLoadMorePosts(0)).toBe(false);
    expect(canLoadMorePosts(undefined)).toBe(false);
  });
});

/* ----------------- Lesson hash (criteria 13-14) ----------------- */
describe("parseLessonHash", () => {
  const lessons = [{ id: 5 }, { id: 6 }, { id: 7 }];
  it("returns the lesson id when present in this module", () => {
    expect(parseLessonHash("#lesson-6", lessons)).toBe(6);
    expect(parseLessonHash("lesson-7", lessons)).toBe(7);
  });
  it("rejects ids that do NOT belong to the current module", () => {
    expect(parseLessonHash("#lesson-999", lessons)).toBeNull();
  });
  it("returns null for malformed hashes", () => {
    expect(parseLessonHash("", lessons)).toBeNull();
    expect(parseLessonHash("#foo", lessons)).toBeNull();
    expect(parseLessonHash(null, lessons)).toBeNull();
  });
});

/* ----------------- Share body formatting ----------------- */
describe("buildLessonShareBody", () => {
  it("emits separate Course/Module/Lesson/Lesson link lines", () => {
    const body = buildLessonShareBody({
      courseTitle: "Designer Foundations",
      moduleTitle: "Lighting",
      lessonTitle: "Layered ambient",
      lessonUrl: "/modules/3#lesson-7",
      intro: "Hello",
    });
    expect(body).toContain("Course: Designer Foundations");
    expect(body).toContain("Module: Lighting");
    expect(body).toContain("Lesson: Layered ambient");
    expect(body).toContain("Lesson link: /modules/3#lesson-7");
    expect(body.startsWith("Hello")).toBe(true);
  });
});

/* ----------------- Deterministic ordering on tie ----------------- */
import { comparePostsForFeed, paginateFeed } from "./community-deeplink";

describe("comparePostsForFeed + paginateFeed (deterministic on tie)", () => {
  const sameTs = "2026-06-22T12:00:00Z";
  const rows = Array.from({ length: 45 }, (_, i) => ({
    id: i + 1,
    pinned: false,
    last_activity_at: sameTs,
  }));

  it("pins float to the top, ties broken by id desc", () => {
    const mixed = [
      { id: 1, pinned: false, last_activity_at: sameTs },
      { id: 2, pinned: true, last_activity_at: sameTs },
      { id: 3, pinned: true, last_activity_at: sameTs },
    ];
    const sorted = [...mixed].sort(comparePostsForFeed);
    expect(sorted.map((r) => r.id)).toEqual([3, 2, 1]);
  });

  it("pages never omit nor duplicate when last_activity_at ties", () => {
    const pages = paginateFeed(rows, 20);
    expect(pages.length).toBe(3);
    const allIds = pages.flat().map((p) => p.id);
    expect(allIds.length).toBe(45);
    expect(new Set(allIds).size).toBe(45);
    // Page boundary IDs are stable across runs because of the id-desc tiebreak
    expect(pages[0][0].id).toBe(45);
    expect(pages[0][19].id).toBe(26);
    expect(pages[1][0].id).toBe(25);
    expect(pages[2].at(-1)?.id).toBe(1);
  });
});
