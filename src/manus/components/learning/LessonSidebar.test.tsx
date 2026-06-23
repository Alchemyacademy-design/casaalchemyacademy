import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LessonSidebar from "./LessonSidebar";

describe("LessonSidebar", () => {
  const lessons = [
    { id: 1, title: "Intro", number: 1 },
    { id: 2, title: "Theory", number: 2 },
    { id: 3, title: "Practice", number: 3, locked: true },
  ];

  it("marks the active lesson with aria-current and the completed one with check icon", () => {
    render(
      <LessonSidebar
        lessons={lessons}
        activeLessonId={2}
        completedLessonIds={new Set([1])}
        onSelect={() => {}}
      />,
    );
    const active = screen.getByRole("button", { name: /theory/i });
    expect(active.getAttribute("aria-current")).toBe("true");
  });

  it("calls onSelect with the lesson id", () => {
    const fn = vi.fn();
    render(
      <LessonSidebar
        lessons={lessons}
        activeLessonId={null}
        completedLessonIds={new Set()}
        onSelect={fn}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /practice/i }));
    expect(fn).toHaveBeenCalledWith(3);
  });

  it("renders empty state when no lessons", () => {
    render(
      <LessonSidebar
        lessons={[]}
        activeLessonId={null}
        completedLessonIds={new Set()}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText(/no lessons yet/i)).toBeInTheDocument();
  });
});
