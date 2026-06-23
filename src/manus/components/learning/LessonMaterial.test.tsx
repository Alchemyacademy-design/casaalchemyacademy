import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LessonMaterial, { parseLessonResource } from "./LessonMaterial";

describe("parseLessonResource", () => {
  it("parses valid https url", () => {
    const r = parseLessonResource("https://example.com/files/guide.pdf");
    expect(r).toMatchObject({ kind: "valid", hostname: "example.com", ext: "pdf" });
  });
  it("strips www. from hostname", () => {
    const r = parseLessonResource("https://www.example.com/x");
    expect(r.kind === "valid" && r.hostname).toBe("example.com");
  });
  it("rejects null/empty", () => {
    expect(parseLessonResource(null).kind).toBe("none");
    expect(parseLessonResource("").kind).toBe("none");
  });
  it("rejects invalid url", () => {
    expect(parseLessonResource("not a url").kind).toBe("none");
  });
  it("rejects javascript: protocol", () => {
    expect(parseLessonResource("javascript:alert(1)").kind).toBe("none");
  });
  it("rejects data: protocol", () => {
    expect(parseLessonResource("data:text/plain,hi").kind).toBe("none");
  });
});

describe("LessonMaterial", () => {
  it("renders a safe external link for a valid url", () => {
    render(<LessonMaterial url="https://example.com/g.pdf" label="My PDF" />);
    const link = screen.getByRole("link", { name: /my pdf/i });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("falls back to hostname when no label", () => {
    render(<LessonMaterial url="https://docs.example.com/x" />);
    expect(screen.getByRole("link")).toHaveTextContent(/docs\.example\.com/i);
  });

  it("shows empty state when url is missing", () => {
    render(<LessonMaterial url={null} />);
    expect(screen.getByText(/no supporting material/i)).toBeInTheDocument();
  });

  it("shows empty state for invalid protocol", () => {
    render(<LessonMaterial url="javascript:alert(1)" />);
    expect(screen.getByText(/no supporting material/i)).toBeInTheDocument();
  });
});
