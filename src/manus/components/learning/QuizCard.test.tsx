// QuizCard immediate-result test: when the edge function returns a passing
// score, the card must render it straight away without waiting for the
// attempts refetch (which previously caused a 0% flash).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import QuizCard from "./QuizCard";

const submitMock = vi.fn();
const listAttemptsMock = vi.fn();
const loadMemberMock = vi.fn();

vi.mock("@/manus/services/quiz", async () => {
  const actual = await vi.importActual<typeof import("@/manus/services/quiz")>(
    "@/manus/services/quiz",
  );
  return {
    ...actual,
    loadMemberQuiz: (...args: unknown[]) => loadMemberMock(...args),
    loadAdminQuiz: vi.fn(),
    listAttempts: (...args: unknown[]) => listAttemptsMock(...args),
    submitAttempt: (...args: unknown[]) => submitMock(...args),
  };
});

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <QuizCard quizId={1} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  submitMock.mockReset();
  listAttemptsMock.mockReset();
  loadMemberMock.mockReset();
});

describe("QuizCard immediate result", () => {
  it("renders the edge function's score immediately without waiting for refetch", async () => {
    loadMemberMock.mockResolvedValue({
      quiz: {
        id: 1,
        course_id: 1,
        lesson_id: null,
        title: "Pilot",
        description: null,
        passing_score: 70,
        max_attempts: 3,
        status: "published",
      },
      questions: [
        {
          id: 10,
          quiz_id: 1,
          question_text: "Q1?",
          points: 1,
          explanation: null,
          sort_order: 1,
          options: [
            { id: 100, question_id: 10, option_text: "A", sort_order: 1 },
            { id: 101, question_id: 10, option_text: "B", sort_order: 2 },
          ],
        },
      ],
    });
    // attempts refetch resolves with NO history, so if the card depended on it,
    // it would show 0%. The card must use the submit response instead.
    listAttemptsMock.mockResolvedValue([]);
    submitMock.mockResolvedValue({ score: 100, passed: true, attemptsRemaining: 2 });

    renderCard();

    await waitFor(() => expect(screen.getByText(/Quiz: Question 1 of 1/)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/A: A/));
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() =>
      expect(screen.getByText(/Quiz passed/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });
});
