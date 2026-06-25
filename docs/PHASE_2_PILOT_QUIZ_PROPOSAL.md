# Phase 2 — Pilot Quiz Content Proposal (NOT YET APPLIED)

Status: `AWAITING_ADMIN_APPROVAL`. No rows have been inserted. The
`submit-quiz-attempt` edge function and `module_ratings` migration are in
place, so once you approve this content the only step left is the insert.

## Where it goes

- `quizzes.course_id` = `1` (pilot course)
- `quizzes.lesson_id` = `NULL` (course-level quiz, rendered on `/courses/1`)
- `quizzes.status` = `draft` → flip to `published` only after content sign-off

## Proposed quiz

| Field          | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| Title          | Foundations of Alchemy — Knowledge Check                              |
| Description    | Confirm the core ideas from the introductory module before continuing.|
| Passing score  | 70                                                                    |
| Max attempts   | 3                                                                     |

## Questions (5 × 4 options, exactly one correct, with explanation)

1. **Q1 — What is the central goal of alchemical practice as defined in the course?**
   - A) Producing literal gold from base metals
   - B) Transforming inner and outer matter through deliberate practice  ✅
   - C) Memorising historical formulas
   - D) Replacing scientific method with intuition
   - Explanation: The course frames alchemy as a discipline of transformation, not a metallurgical procedure.
   - Points: 1

2. **Q2 — Which pairing best represents the foundational polarity discussed in Module 1?**
   - A) Hot / Cold
   - B) Solve / Coagula  ✅
   - C) Day / Night
   - D) Light / Heavy
   - Explanation: "Solve et coagula" is the dissolution-and-binding axis named in the canonical text.
   - Points: 1

3. **Q3 — What does the instructor recommend before beginning a transformation cycle?**
   - A) Prolonged fasting
   - B) Setting an explicit intention and observing baseline state  ✅
   - C) Memorising the entire course
   - D) Skipping preparation if confident
   - Explanation: Preparation = intention + observation; without it, results are not measurable.
   - Points: 1

4. **Q4 — Which of these is NOT part of the three-stage rhythm presented in the module?**
   - A) Nigredo
   - B) Albedo
   - C) Rubedo
   - D) Solaris  ✅
   - Explanation: The three stages are Nigredo / Albedo / Rubedo. "Solaris" is a distractor.
   - Points: 1

5. **Q5 — What is the best response when an experiment fails to produce the expected result?**
   - A) Discard the work and start a new topic
   - B) Document the observation, refine the hypothesis, repeat  ✅
   - C) Treat the failure as confirmation of the original idea
   - D) Wait for a more favourable date before retrying
   - Explanation: Alchemy in the course is presented as iterative: observe, refine, repeat.
   - Points: 1

## Approval gate

Reply with **APPROVE_PILOT_QUIZ** to authorise the insert. On approval I will:

1. Insert the quiz row (status = `draft`).
2. Insert the 5 questions and 20 options.
3. Run the integrity check (`isQuizPublishable`).
4. Stop and wait for a second confirmation before flipping the quiz to
   `published` on `/courses/1`.

No automatic publication will occur.
