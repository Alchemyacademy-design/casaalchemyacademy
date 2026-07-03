# Member Area — Premortem & Upgrade Plan

Same lens we used for Admin Center: for each member-facing section list **What breaks today** (premortem risks) → **What to add** (upgrades) → **How** (concrete implementation). Grouped by the three sidebar buckets: Learn, Discover, Account.

---

## LEARN

### 1. Dashboard (`/dashboard`)

**Risks today**
- Static "welcome back" — no signal on what to do next.
- Continue-watching only surfaces the last lesson, not the best next step.
- No visibility of unread community replies, upcoming events, or new magazine issues.
- Progress numbers are aggregate; the student can't see momentum ("3 lessons this week").

**Upgrades**
- **"Pick up where you left off"** hero card: last incomplete lesson with thumbnail, remaining %, one-click Resume — powered by `lesson_progress` `last_position_seconds`.
- **This week strip**: lessons watched, minutes learned, quizzes passed, streak days. Store in a lightweight `learning_activity_daily` materialised view.
- **Next up for you**: 3 recommended lessons — next lesson in each active course, ordered by recency of progress.
- **Live inbox widget**: unread community replies to my posts, quiz feedback, new events I'm registered for, new magazine issue.
- **Upcoming this week**: events + live workshops I'm registered for, with join-link countdown.
- **Certificates earned** carousel with share buttons.
- **Empty-state coaching**: brand-new users see a 3-step onboarding checklist (pick a course, join community, complete profile) instead of zeros.

### 2. Courses (`/courses`, `/courses/:slug`, `/modules/:id`)

**Risks today**
- List doesn't distinguish enrolled vs. locked vs. completed.
- No search/filter (category, level, duration, plan).
- Lesson page has no "up next" nudge, so students drop off between lessons.
- Quizzes appear but there's no retake history, no wrong-answer review.
- Video player has no resume, no speed, no captions toggle, no keyboard shortcuts.
- Comments and ratings live at the bottom — invisible on long lessons.

**Upgrades — Catalog**
- **Filters**: category, level (beginner/intermediate/advanced), duration, "New", "Included in my plan".
- **Sort**: recommended, newest, most popular, shortest.
- **Card badges**: In progress %, Completed ✓, Locked (with plan needed and Upgrade CTA), New (last 30d).
- **Continue in course** vs. **Start course** CTA based on progress.

**Upgrades — Course detail**
- **Sticky Resume bar** at top when there's progress.
- **Module accordion** shows per-module completion, duration, quiz badge.
- **Certificate progress ring** — % towards issuance criteria.
- **Instructor bio card** with links to their other courses.
- **Related courses** rail.

**Upgrades — Lesson player**
- **Persistent progress**: save `last_position_seconds` every 10s + on pause/unload. Auto-resume on next open.
- **Player controls**: playback speed (0.75/1/1.25/1.5/2), keyboard shortcuts (space, ←/→ 10s, f fullscreen), remembered per-user.
- **Auto-mark complete at 90%** watched (already partial — enforce and surface).
- **Up next card** at 95% with 5-second autoplay countdown → next lesson (cross-module).
- **Notes panel**: timestamped personal notes (`lesson_notes` new table), exportable.
- **Transcript** side-panel with click-to-seek (populate from an AI transcription edge function on upload).
- **Attachments** section for `lesson_attachments` downloads with click tracking.
- **Rating + comments** floated in a side rail on desktop, tabbed on mobile.

**Upgrades — Quizzes**
- **Attempt history**: score, date, passed/failed, retake button (respect `max_attempts`).
- **Wrong-answer review**: after submission, show each missed question with the correct answer and rationale.
- **Progress-blocking mode** (course setting): must pass module quiz to unlock next module.
- **Confetti + auto-navigate** on pass.

### 3. Live Workshops (`/live-workshops`)

**Risks today**
- List mixes past and upcoming.
- No "Add to calendar", no reminders.
- Recording after the fact is manual; students don't know when it's up.

**Upgrades**
- **Tabs**: Upcoming / Registered / Past recordings.
- **RSVP button** with confirmation, ICS + Google Calendar link, "Notify me 1h before" toggle → cron reminder.
- **Live countdown** on registered cards; **Join now** button flips 15 min before start.
- **Post-workshop**: recording auto-populates the card when admin uploads Dropbox link; email registrants.
- **Host bio + agenda** on detail page.
- **Waitlist** when capacity is set.

---

## DISCOVER

### 4. Community (`/community`)

**Risks today**
- Feed is chronological only — no relevance ranking.
- No unread counter per space; students miss replies to their own posts.
- Poor mobile compose experience.
- No moderation surface for the reporter (only admin sees actions).
- Avatars sometimes missing; display name inconsistent.

**Upgrades**
- **Spaces sidebar** with unread badges (`community_posts` new since last visit per space).
- **Feed modes**: Latest, Top this week, Unanswered.
- **@mentions** with autocomplete → notification.
- **Reactions** already in table — add quick-react bar (♥, 👏, 🎉, 💡) and hover count.
- **My activity**: my posts, replies to me, saved posts.
- **Reply threading** with collapse; keyboard `r` to reply.
- **Rich compose**: markdown, image drop (uses `public-assets` bucket), link previews, draft autosave.
- **Report post** flow → writes to `moderation_actions`.
- **Profile pop-card** on avatar hover: name, plan badge, courses completed, follow.
- **Search** across posts (Postgres FTS) with filters.

### 5. Discover (root section stub)

Treat as the umbrella. Add a **Discover home** at `/discover` that stitches Magazine + Events + Suppliers + Deals into one editorial page with tabs and a "New this week" strip. Reduces navigation depth.

### 6. Magazine (`/magazine`)

**Risks today**
- Just a list of PDFs to download; no reading experience.
- No sense of what's new; no way to bookmark an article.
- Covers sometimes missing.

**Upgrades**
- **Cover grid** with issue number, month, "New" badge for last 30 days.
- **In-app reader**: streamed PDF viewer (react-pdf) with page thumbnails, zoom, search — with fallback Download button.
- **Table of contents** entered per issue by admin; deep-link to page.
- **Bookmark / favorite** issues (`magazine_favorites` table).
- **Read tracking**: `magazine_opens` — enables Dashboard "New issue" nudge only until read.
- **Share** issue link (public preview page for logged-in members).
- **Related videos** if admin attached a video URL.

### 7. Events (`/events`)

**Risks today**
- Same list-only pattern as workshops.
- No visual distinction between virtual and in-person.
- No location, no map for in-person.

**Upgrades**
- **Calendar + list toggle** (reuse admin `EventsCalendar`).
- **Filters**: Upcoming, This month, Virtual, In-person, By city.
- **Event card**: cover, date pill, city / online chip, RSVP count, host.
- **Detail page**: description, agenda, host, venue map (for in-person), attendees preview, discussion thread scoped to the event.
- **RSVP → ICS + reminder toggles + waitlist** (same primitives as workshops).
- **Post-event**: photos, recording, thank-you note pushed by admin appear inline.

### 8. Supplier List (`/suppliers`)

**Risks today**
- Long flat list; hard to find one.
- No categories UI, no favorites view, no map.
- Contact info not consistently formatted; broken websites go unnoticed.

**Upgrades**
- **Category chips** and search bar (name, tag, city).
- **Sort**: Recommended, New, A→Z, Most favorited.
- **Card**: logo, name, one-line pitch, category chip, favorite ♥ toggle (`supplier_favorites`).
- **Detail page**: hero, description, contact block (email/phone/site), social links, related suppliers, "Report broken link".
- **My favorites** tab.
- **Map view** for suppliers with lat/lng.
- **Public "Suggest a supplier"** form (moderated).

### 9. Exclusive Deals (`/deals`)

**Risks today**
- Codes displayed as plain text — easy to miss, no tracking.
- Expired deals not filtered.
- No supplier context.

**Upgrades**
- **Copy-code button** with toast + click tracking (via `/r/deal/:id` redirect edge function).
- **Filters**: Active, Expiring soon, Category, Supplier.
- **Countdown pill** on cards nearing `expires_at`.
- **Supplier badge** linked to supplier detail.
- **Save deal** ♥ → surface in Dashboard "Your saved deals".
- **Notify me on new deals from this supplier** subscription toggle.
- **"How to use this code"** field per deal.

---

## ACCOUNT

### 10. Profile (`/profile`)

**Risks today**
- Avatar upload works but there's no crop/preview and no bio.
- Plan info is a static string — no upgrade / manage entry from here.
- No visible learning stats, no certificates, no privacy controls.
- Password change bounces to forgot-password (email-based), not an in-page flow.

**Upgrades**
- **Avatar with crop** (react-easy-crop) + WebP conversion; used everywhere via a canonical `<UserAvatar>` component.
- **Public profile fields**: bio, location, socials — surfaced in community pop-cards. Add `bio`, `location`, `website`, `social_links jsonb` to `profiles`.
- **Learning summary**: courses in progress, completed, quizzes passed, hours learned, current streak, certificates carousel.
- **Achievements/badges** (first course, first quiz pass, 30-day streak).
- **Billing card** (already added Manage subscription): plan name, price, next renewal, invoice history preview (last 3), Upgrade / Change plan CTA.
- **Notification preferences**: email toggles for replies, mentions, event reminders, magazine, deals.
- **Security**: in-page change password (Supabase `updateUser({ password })`), active sessions list with revoke, 2FA enrolment stub.
- **Privacy**: show/hide my activity in community, allow DMs (future), export my data (GDPR — edge function bundles user rows to JSON), delete account (soft-delete + Stripe cancel).
- **Referrals** (optional): personal invite link, count of joined users.

---

## Cross-cutting infrastructure (reused everywhere)

1. **Canonical `<UserAvatar>`** — resolves `avatar_path` → public URL, falls back to initials, one place fixes all missing-avatar bugs.
2. **`<ResumeCard>` / `useContinueLearning()`** — single source for last-position playback.
3. **Notifications system** — `notifications` table + realtime channel. Powers Dashboard inbox, community unread, event reminders, quiz feedback, new magazine issue. Bell icon in `MemberLayout` header.
4. **Favorites primitive** — generic `user_favorites(user_id, entity_type, entity_id)` table so Deals, Suppliers, Magazine, Community posts share one API.
5. **Deep-link filters** — every list reads/writes URL params (reuse admin `useUrlFilters`).
6. **Reminder cron** — extend `send-event-reminders` to workshops, magazine drops, streak nudges.
7. **Streak + activity engine** — nightly job aggregates `lesson_progress` deltas into `learning_activity_daily` for cheap dashboard reads.
8. **Analytics hooks** — lightweight `member_events` table for opens, plays, clicks (deal codes, supplier sites) → feeds admin Analytics north-star.
9. **Empty states with next-action** — every list ships a designed empty state that tells the user what to do.
10. **Mobile pass** — bottom sheet composer for community, sticky player on mobile, responsive cards audit for every section.

---

## Suggested rollout (fast → high leverage)

1. **Foundations** — `<UserAvatar>`, `useContinueLearning`, `notifications` table + bell, generic `user_favorites`.
2. **Dashboard v2** — Resume hero, This-week strip, Upcoming widget, Inbox widget.
3. **Lesson player v2** — resume, speed, up-next autoplay, notes, wrong-answer quiz review.
4. **Community v2** — unread badges, reactions bar, feed modes, mentions.
5. **Discover polish** — Magazine reader, Events calendar, Suppliers categories+map, Deals copy-code + tracking.
6. **Profile v2** — crop avatar, learning summary, in-page password change, notification prefs, billing card polish.
7. **Live Workshops v2** — RSVP + ICS + reminders + join-now flip.
8. **Cross-cutting analytics + reminder cron + mobile pass**.

Each phase is independently shippable and produces visible member-time savings before the next starts.

Approve the plan (or tell me which phase to start with) and I'll execute.
