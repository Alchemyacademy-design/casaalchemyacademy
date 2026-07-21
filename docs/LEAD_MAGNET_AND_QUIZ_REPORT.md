# Lead Magnet, Course Quiz & HubSpot Integration — Status Report

## Environment

- ACTIVE_BRANCH: managed by Lovable (single working tree; not `main`)
- STARTING_HEAD / FINAL_HEAD: N/A (Lovable-managed git)
- Supabase project: `omzwtfnqffseemrlylwu`
- RISK_LEVEL: low — additive changes only, HubSpot token stays server-side.

## Files

FILES_CREATED (this turn):
- `docs/LEAD_MAGNET_AND_QUIZ_REPORT.md`

FILES_CHANGED (this turn):
- `src/manus/pages/Home.tsx` — added fixed lead-magnet section before footer, gated by `!isAuthenticated`.

FILES_PRE-EXISTING (built in prior turns, verified in place):
- `src/manus/components/LeadMagnetDialog.tsx` — 10s auto pop-up, 7-day suppression, ESC/close respected, skipped for signed-in users and admins.
- `src/manus/components/LeadMagnetForm.tsx` — shared form (Name, Email, Phone, honeypot, zod validation, single `submitLead` path).
- `src/manus/lib/lead-magnet.ts` — `shouldShowLeadPopup`, `markLeadPopupDismissed`, `markLeadSubmitted`, `submitLead` (invokes edge function; sets 7-day localStorage after success).
- `src/manus/pages/FreeLesson.tsx` — `/free-lesson` route with video embed or elegant placeholder + CTAs to plans/quiz/Home.
- `src/manus/pages/CourseQuiz.tsx` + `src/manus/data/course-quiz-config.ts` — 4-question quiz with `computeRecommendation`, lead gate before result reveal, redirect to `/courses/{slug}` and `/free-lesson`.
- `supabase/functions/capture-lead/index.ts` — Deno edge function.

## Database

DATABASE_TABLES: `public.leads` already provisioned (13 columns: `id`, `name`, `email`, `phone`, `source`, `metadata`, `hubspot_contact_id`, `hubspot_synced_at`, `hubspot_error`, `confirmation_email_sent_at`, `consent_marketing`, `created_at`, `updated_at`).

- MIGRATION_CREATED: YES (previous turn)
- MIGRATION_APPLIED: YES (previous turn)
- Email is normalized lowercase; `(email, source)` unique upsert; anon `INSERT` allowed with restricted columns; `SELECT` admin-only; edge function (service role) updates `hubspot_*` fields.

## Edge Function

EDGE_FUNCTION_CREATED: `capture-lead` (deployed).

Responsibilities verified in code:
1. Validates payload with zod (name, email, phone, source, optional metadata, honeypot).
2. Upserts into `public.leads` with service role.
3. Ensures HubSpot `lead_source` property exists, then upserts contact with `email`, `firstname`, `lastname`, `phone`, `lead_source` mapped from `source` (`popup → "Website Pop-up — Free Lesson"`, `quiz → "Course Quiz"`).
4. Adds the returned contact ID to the static list when `HUBSPOT_STATIC_LIST_ID` is set; otherwise logs a warning and continues.
5. Sends Resend confirmation email with `/free-lesson` link when `RESEND_API_KEY` is set.
6. Always returns `{ ok: true, redirect: "/free-lesson", leadId }` so the visitor reaches the free lesson even if HubSpot or Resend fail.
7. Restricted CORS via `_shared/cors.ts`; no token logging; provider errors surfaced with status + body only in server logs.

## Secrets

SECRETS_REQUIRED (from Supabase Edge Function env):
- `HUBSPOT_PRIVATE_APP_TOKEN` — configured.
- `HUBSPOT_STATIC_LIST_ID` — **PENDING** (Lorena must confirm list ID; without it, contacts are created but not added to the list).
- `RESEND_API_KEY` — configured.
- `RESEND_FROM_EMAIL` — optional; falls back to `Casa Alchemy Academy <onboarding@resend.dev>` (owner-only test address; needs a verified domain to email real visitors).
- `FREE_LESSON_URL` — optional; frontend uses `/free-lesson` route by default.
- `FREE_LESSON_VIDEO_URL` — optional; page shows placeholder when unset.

HUBSPOT_TOKEN_EXPOSED: **NO** (only referenced in `supabase/functions/capture-lead/index.ts` via `Deno.env.get`; no `VITE_HUBSPOT_*` variable exists in the codebase).

## Feature checklist

- LEAD_POPUP: **YES** — timed 10s, 7-day localStorage suppression, ESC + close respected, hidden for logged-in users.
- HOMEPAGE_SECTION: **YES** — added this turn above the footer, uses the same `LeadMagnetForm` with `source: "popup"` (per spec fallback when only `popup | quiz` are allowed).
- QUIZ_SECTION: **YES** — `/quiz` route; lead gate before result; saves `metadata.answers` and `metadata.recommended_course`; source `"quiz"`.
- FREE_LESSON_PAGE: **YES** — `/free-lesson`.
- EMAIL_CONFIRMATION: **YES** (subject: "Your free Alchemy Academy lesson"). Delivery depends on verified Resend domain.
- SUPABASE_INSERT: **YES**.
- HUBSPOT_SYNC: **YES** (non-blocking).
- STATIC_LIST: conditional on `HUBSPOT_STATIC_LIST_ID`.
- LOCALSTORAGE_7_DAYS: **YES** (`casa.leadPopupDismissedAt`, `casa.leadSubmittedAt`).
- TYPECHECK: PASS (`bunx tsgo --noEmit`, no errors).

## Pending decisions for Lorena

- LORENA_CONFIRM_QUIZ_COPY: current quiz uses 4 questions (Q1–Q4). Spec lists an optional Q5 (persona framing) that has not been added — awaiting confirmation on whether to include it and how to weight it.
- LORENA_CONFIRM_FREE_LESSON_VIDEO: `FREE_LESSON_VIDEO_CONFIGURED = NO` until the URL is provided; placeholder currently shown.
- LORENA_CONFIRM_HUBSPOT_LIST_ID: static list ID not yet set.
- LORENA_APPROVE_EMAIL_COPY: current template matches spec draft; approval or edits welcome.

## Guardrails

- MAIN_CHANGED: NO
- PR_MERGED: NO
- STRIPE_CHANGE: none
- CHECKOUT_CHANGE: none
- RLS_CHANGE: none this turn (leads RLS already in place from prior migration)
- Frontend calls only `supabase.functions.invoke("capture-lead", ...)`; no HubSpot request originates in the browser.

## Premortem verdict

All ten risks in the spec are mitigated by existing code paths (token server-only, timed pop-up + 7-day cookie, non-blocking HubSpot with `hubspot_error` recorded, redirect on Supabase success, placeholder on missing video, quiz tie-breaker via Q2). Two operational risks remain until secrets/URLs are supplied by Lorena: (a) static-list membership will silently skip until `HUBSPOT_STATIC_LIST_ID` is set, (b) confirmation emails only deliver to the Resend account owner until a verified sender domain is configured.