// Routing tests for loadMemberQuiz / loadAdminQuiz — they MUST go through the
// edge functions and never query the quiz_options table directly from the
// browser. Mocks @/integrations/supabase/client to assert invoke targets.

import { describe, expect, it, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: invokeMock },
    from: fromMock,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

beforeEach(() => {
  invokeMock.mockReset();
  fromMock.mockReset();
});

describe("loadMemberQuiz routing", () => {
  it("invokes get-member-quiz and never queries quiz_options directly", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        quiz: {
          id: 1,
          course_id: 1,
          lesson_id: null,
          title: "T",
          description: null,
          passing_score: 70,
          max_attempts: 3,
          status: "published",
        },
        questions: [
          {
            id: 10,
            quiz_id: 1,
            question_text: "Q?",
            points: 1,
            explanation: null,
            sort_order: 1,
            quiz_options: [
              { id: 100, question_id: 10, option_text: "A", sort_order: 1 },
              { id: 101, question_id: 10, option_text: "B", sort_order: 2 },
            ],
          },
        ],
      },
      error: null,
    });

    const { loadMemberQuiz } = await import("./quiz");
    const result = await loadMemberQuiz(1);
    expect(invokeMock).toHaveBeenCalledWith("get-member-quiz", { body: { quiz_id: 1 } });
    expect(fromMock).not.toHaveBeenCalled();
    expect(result?.questions[0].options.length).toBe(2);
    // is_correct is never present in member options
    expect(JSON.stringify(result)).not.toContain("is_correct");
  });

  it("returns null when forbidden so UI can show a neutral message", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });
    const { loadMemberQuiz } = await import("./quiz");
    expect(await loadMemberQuiz(2)).toBeNull();
  });
});

describe("loadAdminQuiz routing", () => {
  it("invokes get-admin-quiz and surfaces is_correct from server", async () => {
    invokeMock.mockResolvedValueOnce({
      data: {
        quiz: {
          id: 1,
          course_id: 1,
          lesson_id: null,
          title: "T",
          description: null,
          passing_score: 70,
          max_attempts: 3,
          status: "draft",
        },
        questions: [
          {
            id: 10,
            quiz_id: 1,
            question_text: "Q?",
            points: 1,
            explanation: null,
            sort_order: 1,
            quiz_options: [
              { id: 100, question_id: 10, option_text: "A", is_correct: true, sort_order: 1 },
              { id: 101, question_id: 10, option_text: "B", is_correct: false, sort_order: 2 },
            ],
          },
        ],
      },
      error: null,
    });

    const { loadAdminQuiz } = await import("./quiz");
    const result = await loadAdminQuiz(1);
    expect(invokeMock).toHaveBeenCalledWith("get-admin-quiz", { body: { quiz_id: 1 } });
    expect(fromMock).not.toHaveBeenCalled();
    expect(result?.questions[0].options[0]).toMatchObject({ is_correct: true });
  });

  it("throws Admin access required when forbidden", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: { message: "forbidden" } });
    const { loadAdminQuiz } = await import("./quiz");
    await expect(loadAdminQuiz(1)).rejects.toThrow(/admin access/i);
  });
});
