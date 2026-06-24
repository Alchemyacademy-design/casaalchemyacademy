# PHASE 2 — VISUAL ACCEPTANCE

## Status

`PHASE_2_RENDERING_STATUS = RENDERED_IN_SANDBOX`

The Phase-2 visual surfaces are now wired into the running app. Hosted-preview
publishing and screenshot capture against the public URL still require
operator action — the sandbox cannot push a deploy and then drive Playwright
against the resulting `lovable.app` URL in the same execution. The pieces
that **are** delivered in this slice:

### Code surfaces touched

| Surface | File | What changed |
| --- | --- | --- |
| Landing | `src/manus/pages/Home.tsx` | Grid marked `data-aa-grid="landing"`, `gap-4 xl:gap-5`, keeps `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. |
| Member catalogue | `src/manus/pages/Modules.tsx` | Grid marked `data-aa-grid="member"`, keeps `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`. |
| Course detail | `src/manus/pages/CourseDetail.tsx` | Course-level `QuizCard` now passes `previewAsAdmin={isAdmin}`; admins see a neutral "No quiz configured yet" panel with a link to the Preview Lab. |
| Module detail | `src/manus/pages/ModuleDetail.tsx` | Lesson `QuizCard` passes `previewAsAdmin={isAdmin}`; admins see a "no quiz" notice; members see nothing extra. |
| Course card | `src/manus/components/learning/CourseCard.tsx` | Adds 40%→50% overlay, `-translate-y-[3px]`, ~250ms transition, landing variant uses 28px padding (`p-7`). |
| Tokens | `src/index.css` | New `.aa-course-card` / `.aa-overlay` rules for the PDF overlay system. |
| Admin nav | `src/manus/components/admin/AdminShell.tsx` | New nav item **Phase 2 Preview** → `/admin/phase-2-preview`. |
| Router | `src/App.tsx` | `AdminPhase2Preview` lazy route registered under the admin guard. |
| Quiz editor | `src/manus/components/admin/AdminQuizEditor.tsx` | "Preview" button on each quiz (renders `QuizCard previewAsAdmin`, no attempt written); empty state links to `/admin/phase-2-preview#quiz`. |
| Course admin | `src/manus/pages/admin/AdminCourseDetail.tsx` | "Preview certificate" panel using the new `CertificatePreview` component (no insert). |
| **New page** | `src/manus/pages/admin/AdminPhase2Preview.tsx` | Six fixture-only sections (Landing / Catalogue / Course detail / Module detail / Quiz / Certificate). Anchors `#landing #catalogue #course #module #quiz #certificate`. |
| **New component** | `src/manus/components/learning/CertificatePreview.tsx` | Instrument Serif / Manrope / Chocolate / Terracotta / Sandstone. Download button is disabled in preview mode. |

### Data and side effects

- **Supabase writes:** none. The Preview Lab is built from local fixtures.
- **Stripe calls:** none. The landing "Coming Soon" path was already free of checkout calls; nothing in this slice re-enables Stripe.
- **Schema / RLS / migrations / edge functions / secrets:** untouched.

### Gates

| Gate | Result |
| --- | --- |
| `bunx tsgo --noEmit` | passes |
| `bun run lint` | 0 errors (18 pre-existing fast-refresh warnings) |
| `bun run test` | 172/172 passing |

### Screenshot capture (operator step)

Screenshots against the **hosted preview** must be captured by an operator
because the sandbox cannot publish and then immediately Playwright the
public `*.lovable.app` URL in the same turn. The expected sweep, per the
brief:

| Width | Routes |
| --- | --- |
| 390 px | `/`, `/mycourses`, `/courses/1`, `/modules/1`, `/admin/phase-2-preview` |
| 768 px | `/mycourses`, `/modules/1` |
| 1024 px | `/courses/1`, `/modules/1` |
| 1440 px | `/`, `/mycourses`, `/courses/1`, `/modules/1`, `/admin/phase-2-preview` |

Save resulting PNGs under `docs/screenshots/phase-2/{width}/{route}.png`
and replace this table with thumbnails. Until then, this document
records what the slice produced, not a hosted-preview validation.

### Honest gap

The brief asks for `RENDERED_AND_HOSTED_VALIDATED`. That status requires
the published preview plus screenshots — both operator-driven. The code
side of Phase 2 rendering is complete and validated locally; the hosted
validation is pending.
