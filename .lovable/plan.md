# Member Area — Phases 2 through 8 execution plan

Phase 1 (Foundations) is already live: `UserAvatar`, `useContinueLearning`, `useFavorite`, `useNotifications`, `NotificationsBell`, `notifications` + `user_favorites` tables. The next batches build on those primitives.

## Phase 2 — Dashboard v2
- Rebuild `src/manus/pages/Dashboard.tsx` around a **Resume hero** powered by `useContinueLearning` (thumbnail, module title, progress bar, "Resume lesson" CTA, fallback to "Start your first course").
- Add a **This week** strip: lessons completed in the last 7d + a 4‑week activity streak (query `lesson_progress.completed_at`).
- Add an **Upcoming** widget (reuse `useUpcomingWorkshops`/`useUpcomingEvents`) and an **Inbox** widget backed by `useNotifications` (top 3 unread, link to `/profile#notifications`).
- Keep existing "Continue learning" grid but push it below the hero.

## Phase 3 — Lesson Player v2
- Extend `src/manus/components/learning/LessonPlayer.tsx` (or nearest player component) with: playback‑rate control (0.75/1/1.25/1.5/2), persistent resume (write `last_position_seconds` to `lesson_progress`), autoplay next lesson at 95% watched, and a lightweight `<LessonNotes>` panel writing to a new `lesson_notes` table (owner‑only RLS).
- Add a **Quiz review** view on the results screen showing wrong answers with the correct choice + explanation (reads existing `quiz_attempts`/`quiz_answers`).

## Phase 4 — Course Catalog v2 (`/mycourses`)
- Filter chips (Enrolled / Available / Completed), search, category filter, and enrollment badge on each card. Reuse `useEntitlements` to compute status.

## Phase 5 — Community v2
- Unread badge per channel (compare `community_posts.created_at` vs a new `community_reads(user_id, channel_id, last_read_at)` table).
- Emoji reactions row on posts (reuse `community_reactions`), and `@mention` autocomplete that emits a `notifications` row of type `mention`.

## Phase 6 — Discover hub
- **Magazine**: inline reader route `/magazine/:slug` with Dropbox PDF embed + download fallback.
- **Events**: shared calendar view (reuse `EventsCalendar`) with RSVP + "Add to calendar" ICS download.
- **Suppliers / Deals**: unify filters, favorite button (uses `useFavorite`), and click‑through logging into a new `deal_clicks(user_id, deal_id, clicked_at)` table for admin analytics.

## Phase 7 — Profile v2
- Avatar upload with crop (square, 512px) via existing `AvatarUpload` + a lightweight cropper.
- Learning stats card (lessons completed, streak, certificates earned).
- Security section: change password, sign out other sessions.
- Notification preferences (per‑type toggles stored on `profiles.notification_prefs jsonb`).

## Phase 8 — Notifications wiring
- Emit notifications from server triggers / edge functions for: new lesson comment reply, mention, workshop starting in 1h, plan renewal.
- Add `/notifications` full‑page inbox with mark‑as‑read and filters.

## Technical notes
- New tables (single migration per phase): `lesson_notes`, `community_reads`, `deal_clicks`. All owner‑scoped RLS + `service_role` GRANT + `authenticated` GRANT.
- Add `last_position_seconds int` to `lesson_progress` (nullable, default null).
- Add `notification_prefs jsonb default '{}'` to `profiles`.
- Realtime already enabled on `notifications`; add `community_reads` to publication for live unread badges.
- All new UI in English, uses existing design tokens and `MemberUI` primitives — no hardcoded colors.

## Delivery order
Phases run sequentially in one session: 2 → 3 → 4 → 5 → 6 → 7 → 8. After each phase I run `tsgo` and fix fallout before moving on. Final message will summarize everything shipped and any follow‑ups.
