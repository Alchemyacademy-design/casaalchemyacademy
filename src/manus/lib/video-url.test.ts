import { describe, it, expect } from "vitest";
import { parseVideoUrl, normalizeVideoUrl, getVideoProvider } from "./video-url";

describe("video-url", () => {
  describe("Dropbox", () => {
    // Structural format identical to the link saved on lesson 1 (no real key).
    const base = "https://www.dropbox.com/scl/fi/abc123/lesson.mp4?rlkey=PLACEHOLDER";

    it("dl=0 → raw=1", () => {
      const p = parseVideoUrl(`${base}&dl=0`);
      expect(p.provider).toBe("dropbox");
      if (p.provider !== "dropbox") return;
      expect(p.src).toContain("raw=1");
      expect(p.src).not.toContain("dl=0");
      expect(p.src).toContain("rlkey=PLACEHOLDER");
      expect(p.mime).toBe("video/mp4");
    });

    it("dl=1 → raw=1", () => {
      const p = parseVideoUrl(`${base}&dl=1`);
      if (p.provider !== "dropbox") throw new Error("expected dropbox");
      expect(p.src).toContain("raw=1");
      expect(p.src).not.toMatch(/dl=/);
    });

    it("raw=1 stays valid", () => {
      const p = parseVideoUrl(`${base}&raw=1`);
      if (p.provider !== "dropbox") throw new Error("expected dropbox");
      expect(p.src).toContain("raw=1");
      expect(p.src).toContain("rlkey=PLACEHOLDER");
    });

    it("classifies mp4 as file kind", () => {
      const p = parseVideoUrl(`${base}&dl=0`);
      expect(p.kind).toBe("file");
    });

    it("dl.dropboxusercontent.com is also normalised", () => {
      const p = parseVideoUrl("https://dl.dropboxusercontent.com/s/x/clip.mp4?dl=0");
      if (p.provider !== "dropbox") throw new Error("expected dropbox");
      expect(p.src).toContain("raw=1");
    });

    it("normalizeVideoUrl leaves non-dropbox unchanged", () => {
      const url = "https://example.com/video.mp4?dl=0";
      expect(normalizeVideoUrl(url)).toBe(url);
    });
  });

  describe("YouTube", () => {
    it("parses watch?v=", () => {
      const p = parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(p.provider).toBe("youtube");
      if (p.provider !== "youtube") return;
      expect(p.embed).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    });
    it("parses youtu.be", () => {
      expect(getVideoProvider("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
    });
  });

  describe("Vimeo", () => {
    it("parses vimeo.com/<id>", () => {
      const p = parseVideoUrl("https://vimeo.com/123456789");
      expect(p.provider).toBe("vimeo");
    });
    it("parses player.vimeo.com", () => {
      expect(getVideoProvider("https://player.vimeo.com/video/123")).toBe("vimeo");
    });
  });

  describe("Direct file", () => {
    it("mp4", () => {
      const p = parseVideoUrl("https://cdn.example.com/clip.mp4");
      expect(p.provider).toBe("file");
      if (p.provider !== "file") return;
      expect(p.mime).toBe("video/mp4");
    });
    it("webm", () => {
      expect(getVideoProvider("https://cdn.example.com/clip.webm")).toBe("file");
    });
    it("ogg", () => {
      expect(getVideoProvider("https://cdn.example.com/clip.ogg")).toBe("file");
    });
  });

  describe("Security", () => {
    it("blocks javascript: URLs", () => {
      expect(getVideoProvider("javascript:alert(1)")).toBe("none");
    });
    it("blocks data: URLs", () => {
      expect(getVideoProvider("data:video/mp4;base64,AAAA")).toBe("none");
    });
    it("returns none for invalid input", () => {
      expect(getVideoProvider(null)).toBe("none");
      expect(getVideoProvider("")).toBe("none");
      expect(getVideoProvider("   ")).toBe("none");
      expect(getVideoProvider("not-a-url")).toBe("none");
    });
  });

  describe("External", () => {
    it("unknown host returns external", () => {
      expect(getVideoProvider("https://example.com/movie")).toBe("external");
    });
  });
});
