# Phase 2 — Pilot Quiz Content Proposal (NOT YET APPLIED)

Status: `AWAITING_ADMIN_APPROVAL`. No rows have been inserted. The pilot
course is **The path to a COLOURFUL life** (`courses.id = 1`). This proposal
replaces an earlier draft that mistakenly used generic alchemy content; the
current quiz is built strictly from the course's colour-theory curriculum.

## Where it goes

- `quizzes.course_id` = `1`
- `quizzes.lesson_id` = `NULL` (course-level quiz, rendered on `/courses/1`)
- `quizzes.status` = `draft` → flip to `published` only after content sign-off

## Quiz metadata

| Field          | Value                                                                 |
|----------------|-----------------------------------------------------------------------|
| Title          | The path to a COLOURFUL life — Colour Theory Check                    |
| Description    | Confirm the colour-theory foundations from the introductory module: the colour wheel, primaries and secondaries, temperature, analogous and complementary relationships, and tints, shades and tones. |
| Passing score  | 70                                                                    |
| Max attempts   | 3                                                                     |

## Questions (5 × 4 options, exactly one correct, 1 point each)

1. **Q1 — Which group lists the three primary colours used to build the colour wheel in this course?**
   - A) Red, Green, Blue
   - B) Red, Yellow, Blue  ✅
   - C) Cyan, Magenta, Yellow
   - D) Orange, Green, Violet
   - Explanation: The course uses the traditional artist's wheel — red, yellow and blue are the three primaries from which every other hue is mixed.

2. **Q2 — Which set is made up only of secondary colours?**
   - A) Red, Yellow, Blue
   - B) Orange, Green, Violet  ✅
   - C) Red-orange, Yellow-green, Blue-violet
   - D) Pink, Brown, Grey
   - Explanation: Secondary colours are produced by mixing two primaries: red + yellow = orange, yellow + blue = green, blue + red = violet.

3. **Q3 — Which row groups warm colours together?**
   - A) Blue, Green, Violet
   - B) Red, Orange, Yellow  ✅
   - C) Blue-green, Violet, Pink
   - D) Black, White, Grey
   - Explanation: Warm colours sit on the red–yellow half of the wheel; cool colours sit on the blue–green half.

4. **Q4 — Which pair is an example of a COMPLEMENTARY relationship on the colour wheel?**
   - A) Yellow and Yellow-green
   - B) Red and Orange
   - C) Blue and Orange  ✅
   - D) Red and Pink
   - Explanation: Complementary colours sit directly opposite each other on the wheel (e.g. blue↔orange, red↔green, yellow↔violet). Analogous colours, by contrast, sit next to each other.

5. **Q5 — What is the difference between a TINT, a SHADE and a TONE as defined in the module?**
   - A) Tint = add black, Shade = add white, Tone = add another hue
   - B) Tint = add white, Shade = add black, Tone = add grey  ✅
   - C) Tint = warm version, Shade = cool version, Tone = neutral version
   - D) They are three names for the same lightness adjustment
   - Explanation: The course defines tint as a hue lightened with white, shade as a hue darkened with black, and tone as a hue softened with grey.

## Approval gate

Reply with **APPROVE_PILOT_QUIZ** to authorise the insert. On approval I will:

1. Insert the quiz row (status = `draft`).
2. Insert the 5 questions and 20 options.
3. Run the integrity check (`isQuizPublishable`).
4. Stop and wait for a second confirmation before flipping the quiz to
   `published` on `/courses/1`.

No automatic publication will occur. No rows are written before approval.
