import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LessonPlayer, { parseLessonVideo } from "./LessonPlayer";

describe("parseLessonVideo", () => {
  it("parses youtube.com/watch?v=", () => {
    const r = parseLessonVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(r).toEqual({ kind: "youtube", embed: "https://www.youtube.com/embed/dQw4w9WgXcQ" });
  });
  it("parses youtu.be short links", () => {
    const r = parseLessonVideo("https://youtu.be/dQw4w9WgXcQ");
    expect(r).toEqual({ kind: "youtube", embed: "https://www.youtube.com/embed/dQw4w9WgXcQ" });
  });
  it("parses youtube.com/embed/", () => {
    const r = parseLessonVideo("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(r.kind).toBe("youtube");
  });
  it("parses Vimeo numeric ids", () => {
    const r = parseLessonVideo("https://vimeo.com/123456789");
    expect(r).toEqual({ kind: "vimeo", embed: "https://player.vimeo.com/video/123456789" });
  });
  it("parses player.vimeo.com/video/", () => {
    const r = parseLessonVideo("https://player.vimeo.com/video/123456789");
    expect(r.kind).toBe("vimeo");
  });
  it("recognises direct mp4 files", () => {
    const r = parseLessonVideo("https://cdn.example.com/clip.mp4");
    expect(r).toMatchObject({ kind: "file", mime: "video/mp4" });
  });
  it("returns external for unknown hosts", () => {
    const r = parseLessonVideo("https://example.com/movie");
    expect(r.kind).toBe("external");
  });
  it("returns none for invalid url", () => {
    expect(parseLessonVideo("not-a-url").kind).toBe("none");
  });
  it("returns none for null/empty", () => {
    expect(parseLessonVideo(null).kind).toBe("none");
    expect(parseLessonVideo("").kind).toBe("none");
    expect(parseLessonVideo("   ").kind).toBe("none");
  });
  it("rejects javascript: protocol", () => {
    expect(parseLessonVideo("javascript:alert(1)").kind).toBe("none");
  });
});

describe("LessonPlayer", () => {
  it("renders a sandboxed iframe for YouTube without autoplay", () => {
    const { container } = render(
      <LessonPlayer videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="My Lesson" />,
    );
    const iframe = container.querySelector("iframe")!;
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("title")).toBe("My Lesson");
    expect(iframe.getAttribute("loading")).toBe("lazy");
    expect(iframe.getAttribute("sandbox")).toContain("allow-scripts");
    expect(iframe.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(iframe.getAttribute("src") ?? "").not.toMatch(/autoplay=1/);
  });

  it("renders a video element for direct files without autoplay", () => {
    const { container } = render(
      <LessonPlayer videoUrl="https://cdn.example.com/clip.mp4" />,
    );
    const video = container.querySelector("video")!;
    expect(video).toBeTruthy();
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.hasAttribute("controls")).toBe(true);
  });

  it("renders a safe external link for unknown urls", () => {
    render(<LessonPlayer videoUrl="https://example.com/movie" />);
    const link = screen.getByRole("link", { name: /open video externally/i });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("renders 'Video coming soon' when url is missing", () => {
    render(<LessonPlayer videoUrl={null} />);
    expect(screen.getByText(/video coming soon/i)).toBeInTheDocument();
  });

  it("renders 'Video coming soon' for invalid url and does not embed an iframe", () => {
    const { container } = render(<LessonPlayer videoUrl="not://valid" />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText(/video coming soon/i)).toBeInTheDocument();
  });
});
