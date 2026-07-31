import { describe, it, expect } from "vitest";
import { parseQuizText, isUsableParse } from "./quiz-import";

describe("parseQuizText", () => {
  it("parses numbered questions with lettered options and an Answer line", () => {
    const parsed = parseQuizText(`Title: Colour Basics
1. What does the 60-30-10 rule describe?
a) Lighting temperature
b) Colour proportion in a room
c) Furniture spacing
Answer: B
Explanation: It splits dominant, secondary and accent colour.

2) Which colour is an accent in that rule?
a. The 60%
b. The 30%
c. The 10%
Answer: c`);
    expect(parsed.title).toBe("Colour Basics");
    expect(parsed.questions).toHaveLength(2);
    expect(parsed.questions[0].options[1].is_correct).toBe(true);
    expect(parsed.questions[0].explanation).toMatch(/dominant/);
    expect(parsed.questions[1].options[2].is_correct).toBe(true);
    expect(isUsableParse(parsed)).toBe(true);
  });

  it("supports asterisk, checkbox and inline (correct) markers", () => {
    const parsed = parseQuizText(`1. Pergunta um?
*a) Certa
b) Errada

2. Pergunta dois?
[ ] Errada
[x] Certa

3. Pergunta tres?
- Errada
- Certa (correct)`);
    expect(parsed.questions).toHaveLength(3);
    expect(parsed.questions[0].options[0].is_correct).toBe(true);
    expect(parsed.questions[1].options[1].is_correct).toBe(true);
    expect(parsed.questions[2].options[1].is_correct).toBe(true);
    expect(parsed.questions[2].options[1].option_text).toBe("Certa");
  });

  it("defaults to the first option and never marks two correct", () => {
    const parsed = parseQuizText(`1. No marker here?
a) One
b) Two`);
    expect(parsed.questions[0].options.filter((o) => o.is_correct)).toHaveLength(1);
    expect(parsed.questions[0].options[0].is_correct).toBe(true);
  });

  it("drops questions with fewer than two options", () => {
    const parsed = parseQuizText(`1. Lonely?
a) Only one`);
    expect(parsed.questions).toHaveLength(0);
    expect(isUsableParse(parsed)).toBe(false);
  });

  it("resolves answers given as full option text", () => {
    const parsed = parseQuizText(`1. Qual regra?
a) Regra A
b) Regra B
Resposta: Regra B`);
    expect(parsed.questions[0].options[1].is_correct).toBe(true);
  });
});