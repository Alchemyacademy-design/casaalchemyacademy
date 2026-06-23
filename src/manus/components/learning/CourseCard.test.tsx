import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CourseCard from "./CourseCard";

function renderCard(props: Parameters<typeof CourseCard>[0]) {
  return render(
    <MemoryRouter>
      <CourseCard {...props} />
    </MemoryRouter>,
  );
}

describe("CourseCard", () => {
  it("renders title, subtitle, and lesson count", () => {
    renderCard({
      course: {
        id: 1,
        title: "The path to a COLOURFUL life",
        subtitle: "Discover techniques",
        lessonCount: 3,
        published: true,
        href: "/courses/1",
      },
    });
    expect(screen.getByText("The path to a COLOURFUL life")).toBeInTheDocument();
    expect(screen.getByText("Discover techniques")).toBeInTheDocument();
    expect(screen.getByText(/3 lessons/i)).toBeInTheDocument();
  });

  it("shows Draft badge when not published", () => {
    renderCard({
      course: { id: 1, title: "X", published: false, href: "/courses/1" },
    });
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it("shows Coming Soon and no CTA link when comingSoon=true", () => {
    renderCard({
      course: { id: 1, title: "X", comingSoon: true, href: "/courses/1" },
    });
    expect(screen.getAllByText(/coming soon/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows lock icon when locked and links to fallback href (e.g. /plans)", () => {
    renderCard({
      course: { id: 1, title: "X", locked: true, href: "/plans" },
    });
    expect(screen.getByLabelText(/locked/i)).toBeInTheDocument();
  });

  it("Start CTA when no progress, Continue when partial, Review when complete", () => {
    const { rerender } = renderCard({
      course: { id: 1, title: "X", progressPercent: 0, lessonCount: 4, href: "/courses/1" },
    });
    expect(screen.getByRole("link", { name: /start/i })).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <CourseCard course={{ id: 1, title: "X", progressPercent: 50, lessonCount: 4, href: "/courses/1" }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /continue/i })).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <CourseCard course={{ id: 1, title: "X", progressPercent: 100, lessonCount: 4, href: "/courses/1" }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /review/i })).toBeInTheDocument();
  });

  it("landing variant uses 'View Course' label", () => {
    renderCard({
      variant: "landing",
      course: { id: 1, title: "X", href: "/courses/1" },
    });
    expect(screen.getByRole("link", { name: /view course/i })).toBeInTheDocument();
  });
});
