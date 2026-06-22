/**
 * Pure helpers for community deep-linking, pagination and filters.
 * Kept side-effect free so they are easy to unit-test.
 */

export type DeepLinkChannel = {
  id: number;
  slug: string;
  space_id: number;
};

export type DeepLinkResult =
  | { kind: "match"; channelId: number; spaceId: number }
  | { kind: "not-found"; slug: string };

/**
 * Resolves a slug against a single channel row already fetched by slug
 * (or null when nothing matched). Returns a deterministic result the UI
 * can act on without further lookups.
 */
export function resolveDeepLinkChannel(
  slug: string | null | undefined,
  matched: DeepLinkChannel | null | undefined,
): DeepLinkResult | null {
  if (!slug) return null;
  if (!matched) return { kind: "not-found", slug };
  return { kind: "match", channelId: matched.id, spaceId: matched.space_id };
}

/* -------------------------------- Hash -------------------------------- */

/**
 * Parses `#lesson-<id>` hashes. Returns the lessonId only when it exists
 * in the lessons array (so a hash pointing at a foreign module is rejected).
 */
export function parseLessonHash(
  hash: string | null | undefined,
  lessons: Array<{ id: number }>,
): number | null {
  if (!hash) return null;
  const m = hash.match(/^#?lesson-(\d+)$/i);
  if (!m) return null;
  const id = Number(m[1]);
  if (!Number.isFinite(id)) return null;
  return lessons.some((l) => l.id === id) ? id : null;
}

/* ----------------------------- Pagination ----------------------------- */

export const POSTS_PAGE_SIZE = 20;

export type PostLike = { id: number };

/** Concatenate pages while removing duplicate ids (later pages win). */
export function dedupePostPages<T extends PostLike>(pages: T[][]): T[] {
  const seen = new Map<number, T>();
  for (const page of pages) {
    for (const p of page) seen.set(p.id, p);
  }
  return Array.from(seen.values());
}

/** Only allow loading another page when the last page was full. */
export function canLoadMorePosts(
  lastPageLength: number | undefined,
  pageSize: number = POSTS_PAGE_SIZE,
): boolean {
  if (lastPageLength == null) return false;
  return lastPageLength >= pageSize;
}

/* ----------------------------- Search/filter ----------------------------- */

export type FilterMode = "all" | "pinned" | "mine";

export function filterPosts<
  T extends { title: string | null; body: string; pinned: boolean; author_id: string },
>(posts: T[], search: string, filter: FilterMode, userId: string | null): T[] {
  const q = search.trim().toLowerCase();
  return posts.filter((p) => {
    if (filter === "pinned" && !p.pinned) return false;
    if (filter === "mine" && p.author_id !== userId) return false;
    if (q) {
      const hay = `${p.title ?? ""}\n${p.body ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ----------------------------- URL params ----------------------------- */

export type CommunityUrlParams = {
  channel?: string;
  title?: string;
  body?: string;
};

export function readCommunityUrlParams(search: string): CommunityUrlParams {
  const sp = new URLSearchParams(search);
  return {
    channel: sp.get("channel") ?? undefined,
    title: sp.get("title") ?? undefined,
    body: sp.get("body") ?? undefined,
  };
}

/* ----------------------------- Lesson link body ----------------------------- */

export function buildLessonShareBody(input: {
  courseTitle: string;
  moduleTitle: string;
  lessonTitle: string;
  lessonUrl: string;
  intro?: string;
}): string {
  const intro = input.intro ? `${input.intro}\n\n` : "";
  return (
    `${intro}` +
    `Course: ${input.courseTitle}\n` +
    `Module: ${input.moduleTitle}\n` +
    `Lesson: ${input.lessonTitle}\n` +
    `Lesson link: ${input.lessonUrl}`
  );
}
