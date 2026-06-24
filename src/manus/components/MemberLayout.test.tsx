/**
 * MemberLayout — desktop active state, mobile aria-expanded toggle,
 * and mobile menu closes after navigation click.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/manus/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { name: "Test", email: "t@example.com" },
    loading: false,
    isAuthenticated: true,
    isAdmin: false,
    logout: vi.fn(),
  }),
}));

import MemberLayout from "./MemberLayout";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MemberLayout>
        <div>content</div>
      </MemberLayout>
    </MemoryRouter>,
  );
}

describe("MemberLayout", () => {
  it("marks the active route with bg-accent in the desktop sidebar", () => {
    renderAt("/mycourses");
    const desktopNav = screen.getAllByRole("navigation", { name: /member navigation/i })[0];
    const coursesLink = within(desktopNav).getByRole("link", { name: /courses/i });
    expect(coursesLink.className).toMatch(/bg-accent/);
  });

  it("mobile toggle exposes aria-expanded and the mobile menu shows on click", () => {
    renderAt("/dashboard");
    const toggle = screen.getByRole("button", { name: /open navigation menu/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /close navigation menu/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(document.getElementById("member-mobile-menu")).not.toBeNull();
  });

  it("clicking a nav item in the mobile menu closes the menu", () => {
    renderAt("/dashboard");
    fireEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));
    const mobile = document.getElementById("member-mobile-menu")!;
    const coursesLink = within(mobile).getByRole("link", { name: /courses/i });
    fireEvent.click(coursesLink);
    expect(document.getElementById("member-mobile-menu")).toBeNull();
  });
});
