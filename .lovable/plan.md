## Goal
Replace the "free lesson" lead magnet with "Subscribe and get our latest magazine issue, free." across every touchpoint — popup, homepage capture section, post-submit page, and Resend confirmation email — without changing the underlying form, storage, HubSpot sync, or 7-day suppression logic.

## Changes

### 1. Popup — `src/manus/components/LeadMagnetDialog.tsx`
- Title → `"Consider this your first experiment."`
- Description → `"Subscribe and get our latest issue, free. Real projects, real principles — the professional knowledge you need to design your own home, with confidence."`
- CTA label passed to `LeadMagnetForm` → `"Get the Magazine"`

### 2. Homepage capture section — `src/manus/pages/Home.tsx` (`#free-lesson-cta`, ~line 624)
This section already exists as the second capture point the brief asks for. Repurpose in place (keep the form + flow):
- Kicker → `"Get the magazine"`
- Headline → `"Get our latest issue, free."`
- Body copy → short magazine-focused paragraph (subscribe, get the PDF now, no video wait).
- Form CTA → `"Get the Magazine"`.
- Rename the section anchor `id` to `magazine-cta` and update any in-page anchors (currently none link to it).

### 3. Thank-you page — repurpose `src/manus/pages/FreeLesson.tsx` + add `/magazine` route
- Rewrite `FreeLesson.tsx` to render the magazine landing: cover image, short preview blurb, primary download button (opens PDF in new tab), and a secondary CTA `"Want the full toolkit, not just the preview?"` linking to `/#offers`.
- Headline → `"Thanks for subscribing. Here's your issue."`
- Add `/magazine` route in `src/App.tsx` pointing at the same component; keep `/free-lesson` as a `Navigate` redirect to `/magazine` so any old confirmation emails still land somewhere valid.
- Use two `import.meta.env` values with hard-coded placeholder fallbacks:
  - `VITE_MAGAZINE_PDF_URL` → default `/lead-magnet/casa-alchemy-issue-01.pdf`
  - `VITE_MAGAZINE_COVER_URL` → default `/lead-magnet/magazine-cover.jpg`

### 4. Form redirect — `src/manus/components/LeadMagnetForm.tsx`
- Default CTA label → `"Get the Magazine"`.
- Success toast → `"You're in. Your issue is ready."`
- Default post-submit navigate target → `/magazine` (kept overridable via `redirectTo` / server `result.redirect`).

### 5. `src/manus/lib/lead-magnet.ts`
- No structural change. Type/comments stay as-is; keeps `LeadSource = "popup" | "quiz"` so the quiz capture path is unaffected.

### 6. Edge function — `supabase/functions/capture-lead/index.ts`
- Rename local var `freeLessonUrl` → `magazineUrl`; source order becomes:
  1. new env `MAGAZINE_PUBLIC_URL` (added), else
  2. legacy `FREE_LESSON_PUBLIC_URL` (kept for continuity), else
  3. `${origin}/magazine`.
- Optional new env `MAGAZINE_PDF_URL` — if set, email links directly to the PDF; otherwise it links to `magazineUrl` (the thank-you page, which itself hosts the download button).
- Response `redirect` → `/magazine` (both success and honeypot branches).
- HubSpot `labelForSource("popup")` → `"Website Pop-up — Magazine"`.
- Resend email:
  - Subject → `"Your free issue of the Casa Alchemy magazine"`
  - Body → magazine-focused copy, primary button `"Download the magazine"` pointing at `MAGAZINE_PDF_URL || magazineUrl`, plaintext fallback link, unchanged footer signature.
- Quiz path (`source: "quiz"`) keeps its existing copy; email template branches on source.

### 7. `src/manus/pages/CourseQuiz.tsx`
- Update the small "already got the lesson" fallback link (`to="/free-lesson"`) to `/magazine` and the surrounding copy to reference the magazine, so the quiz page stays consistent. No form logic changes.

## Assets — where to upload the real files
Once you send the PDF + cover, upload them via the Lovable Assets CLI (keeps the repo lightweight, served from CDN):

```text
lovable-assets create --file <local-cover.jpg> --filename magazine-cover.jpg \
  > src/assets/magazine-cover.jpg.asset.json
lovable-assets create --file <local-magazine.pdf> --filename casa-alchemy-issue-01.pdf \
  > src/assets/casa-alchemy-issue-01.pdf.asset.json
```

I will then wire those `.asset.json` `url` fields into `FreeLesson.tsx` and set `MAGAZINE_PDF_URL` in the edge function secrets. Until you send them, the page uses placeholder paths under `/public/lead-magnet/` — if you'd rather drop the two files into `public/lead-magnet/` yourself with those exact names, everything works without env changes.

## Out of scope
- No changes to leads schema, HubSpot list wiring, honeypot, or 7-day suppression.
- No changes to the popup trigger timing or the auth-based suppression.
- No new secondary popup (footer section = same form/flow, not a second dialog).

## Verification
- Build passes.
- Popup opens with new copy; form submits; localStorage suppression still holds for 7 days.
- `/magazine` renders cover + download button; `/free-lesson` redirects to `/magazine`.
- Curl `capture-lead` with a test payload → response `redirect: "/magazine"`, Resend log shows magazine subject line.
