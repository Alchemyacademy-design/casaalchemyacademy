import { describe, it, expect } from "vitest";
import { gradeAttempt, isQuestionPublishable, isQuizPublishable, type AdminQuestion } from "./quiz";

function makeQuestion(id: number, points: number, options: Array<[number, boolean]>): AdminQuestion {
  return {
    id,
    quiz_id: 1,
    question_text: `Q${id}`,
    points,
    explanation: null,
    sort_order: id,
    options: options.map(([optId, correct], i) => ({
      id: optId,
      question_id: id,
      option_text: `O${optId}`,
      is_correct: correct,
      sort_order: i,
    })),
  };
}

describe("gradeAttempt", () => {
  it("returns 0 when no questions", () => {
    expect(gradeAttempt([], {}, 70)).toMatchObject({ score: 0, passed: false });
  });

  it("awards full points only on the correct option", () => {
    const q = makeQuestion(1, 2, [[10, false], [11, true], [12, false]]);
    const wrong = gradeAttempt([q], { 1: 10 }, 50);
    expect(wrong.score).toBe(0);
    expect(wrong.passed).toBe(false);
    const right = gradeAttempt([q], { 1: 11 }, 50);
    expect(right.score).toBe(100);
    expect(right.passed).toBe(true);
  });

  it("computes percentage across multiple questions and applies passingScore", () => {
    const q1 = makeQuestion(1, 1, [[1, true], [2, false]]);
    const q2 = makeQuestion(2, 1, [[3, true], [4, false]]);
    const half = gradeAttempt([q1, q2], { 1: 1, 2: 4 }, 70);
    expect(half.score).toBe(50);
    expect(half.passed).toBe(false);
    const all = gradeAttempt([q1, q2], { 1: 1, 2: 3 }, 70);
    expect(all.passed).toBe(true);
  });

  it("never trusts an unselected answer as correct", () => {
    const q = makeQuestion(1, 1, [[1, true], [2, false]]);
    const result = gradeAttempt([q], {}, 50);
    expect(result.score).toBe(0);
    expect(result.perQuestion[0].isCorrect).toBe(false);
  });
});

describe("publishability gates", () => {
  it("requires at least two options with exactly one correct", () => {
    expect(isQuestionPublishable([{ is_correct: true }])).toBe(false);
    expect(isQuestionPublishable([{ is_correct: true }, { is_correct: true }])).toBe(false);
    expect(isQuestionPublishable([{ is_correct: false }, { is_correct: false }])).toBe(false);
    expect(isQuestionPublishable([{ is_correct: true }, { is_correct: false }])).toBe(true);
  });

  it("requires a quiz to have a title and ≥1 publishable question", () => {
    const q = makeQuestion(1, 1, [[1, true], [2, false]]);
    expect(isQuizPublishable({ title: "", passing_score: 70 }, [q])).toBe(false);
    expect(isQuizPublishable({ title: "Ok", passing_score: 70 }, [])).toBe(false);
    expect(isQuizPublishable({ title: "Ok", passing_score: 200 }, [q])).toBe(false);
    expect(isQuizPublishable({ title: "Ok", passing_score: 70 }, [q])).toBe(true);
  });
});
