import { describe, it, expect } from "vitest";
import {
  ADMIN_TABLE_PAGE_SIZE,
  buildMinimalSelect,
  escapePostgrestLike,
} from "./AdminTablePage";

describe("AdminTablePage helpers", () => {
  it("PAGE_SIZE is exactly 20", () => {
    expect(ADMIN_TABLE_PAGE_SIZE).toBe(20);
  });

  describe("buildMinimalSelect", () => {
    it("derives select from primaryKey + fields + orderBy + searchFields + extra (deduped)", () => {
      const out = buildMinimalSelect({
        primaryKey: "id",
        fields: [
          { name: "title", label: "Title", type: "text" },
          { name: "slug", label: "Slug", type: "text" },
          { name: "status", label: "Status", type: "select" },
        ],
        orderBy: { column: "starts_at" },
        searchFields: ["title", "slug"],
        extra: ["author:profiles(name)"],
      });
      const cols = out.split(",");
      expect(cols).toContain("id");
      expect(cols).toContain("title");
      expect(cols).toContain("slug");
      expect(cols).toContain("status");
      expect(cols).toContain("starts_at");
      expect(cols).toContain("author:profiles(name)");
      // No duplicates.
      expect(new Set(cols).size).toBe(cols.length);
      // Never falls back to '*'.
      expect(out).not.toBe("*");
    });

    it("works with no orderBy / searchFields / extra", () => {
      const out = buildMinimalSelect({
        primaryKey: "id",
        fields: [{ name: "title", label: "Title", type: "text" }],
      });
      expect(out).toBe("id,title");
    });
  });

  describe("escapePostgrestLike", () => {
    it("escapes wildcards and PostgREST separators", () => {
      expect(escapePostgrestLike("100% off (sale)")).toBe("100\\% off \\(sale\\)");
      expect(escapePostgrestLike("name_with,comma")).toBe("name\\_with\\,comma");
      expect(escapePostgrestLike("back\\slash")).toBe("back\\\\slash");
      expect(escapePostgrestLike("a*b")).toBe("a\\*b");
    });

    it("returns the input unchanged when there is nothing to escape", () => {
      expect(escapePostgrestLike("hello world")).toBe("hello world");
      expect(escapePostgrestLike("")).toBe("");
    });
  });
});
