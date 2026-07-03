# Admin Center — Premortem & Upgrade Plan

Goal: reduce clicks, surface risk earlier, and give the admin more autonomy across the 9 sections. Each section below lists **What breaks today** (premortem risks), **What to add** (features), and **How** (concrete implementation notes).

---

## 1. Overview (`/admin`)

**Risks today**
- KPIs are read-only — admin sees a problem (missing videos, pending posts) but has to hunt for the fix.
- No "what changed since yesterday" — every visit feels the same.
- Recent audit list is passive; no filter by actor/entity.

**Upgrades**
- **Actionable KPI cards** — each warning KPI (missing videos, missing thumbnails, pending posts, out-of-sync plans) becomes a button that deep-links to a pre-filtered view that fixes exactly those rows.
- **"Since last visit" delta** — store `last_admin_visit_at` in `profiles` and show +N new signups / +N posts / +N revenue vs. previous session.
- **Global command palette (⌘K)** — jump to any course, student email, plan, or supplier from anywhere; also runs actions ("publish course X", "grant plan Y to email Z").
- **Health strip** — one-line row at top: Stripe webhook status, last successful sync, storage usage, edge function error rate (last 24h from `analytics_query`).
- **Pinned shortcuts** — admin-configurable quick actions saved in `localStorage`.

---

## 2. Course Management (`/admin/course-management`)

**Risks today**
- Builder + Wizard + Bulk + Quizzes + Legacy tabs = discoverability problem. New admins don't know where "add a lesson" lives.
- No bulk publish / unpublish / archive.
- No visibility of who has access to a course (entitlements) from the list.

**Upgrades**
- **Unified action bar** on the list: multi-select rows → Publish, Archive, Duplicate, Change plan access, Export CSV.
- **Course template library** — save a course structure as template ("6-module cohort", "single-lesson mini-course") and spawn new courses from it.
- **Auto-save + version snapshots** in the builder (`course_audit_logs` already exists — add a "Restore this version" button).
- **Broken-link scanner** — background check on every lesson `external_video_url` (HEAD request via edge function) → red badge on lessons with 404/expired Dropbox links.
- **AI helpers (Lovable AI Gateway)**: generate lesson description from title, suggest quiz questions from lesson transcript, auto-write course SEO blurb.
- **Access preview drawer** — click a course → see the exact list of members currently entitled (via plan or direct entitlement) and revoke inline.

---

## 3. Events Hub (`/admin/events-hub`)

**Risks today**
- Events and Live Workshops share almost identical schemas but two separate editors — copy/paste mistakes.
- No RSVP visibility from the list; admin can't see who's coming.
- No reminder automation — students often forget events.

**Upgrades**
- **Single "New session" form** with a Type selector (Event vs. Live workshop) that writes to the right table — one UX, two backends.
- **Calendar view** (month/week toggle) alongside the current list — drag to reschedule (updates `starts_at`).
- **Attendee panel per event** — inline table of `registrations` with export CSV, mark attended, send bulk email.
- **Automatic reminders** — edge function cron sends 24h + 1h reminders; toggle per event.
- **ICS download + Google Calendar link** auto-generated for each event, both public and admin-side.
- **Recurring events** — RRULE stored in a new column; expand into instances on read.
- **Post-event follow-up** — auto-move past events to an "Archive" tab and prompt to upload the recording (Dropbox URL).

---

## 4. Magazine (`/admin/magazine`)

**Risks today**
- PDF + cover + optional video upload is manual; no validation that files actually opened for members.
- No sense of which issues are being read.

**Upgrades**
- **Drag-and-drop issue builder** with live preview of the member-facing card.
- **Issue scheduler** — set `publish_at` in the future; edge function cron flips status to `published`.
- **Read/download analytics** — track opens per issue in a new `magazine_opens` table; show per-issue KPI.
- **Cover auto-generation** — if no cover is uploaded, generate from the PDF's first page via a pdf-to-image edge function.
- **Bulk import** — paste multiple Dropbox links; admin fills titles later.
- **Access plan chip** on each issue card (same UX as courses).

---

## 5. Suppliers Hub (`/admin/suppliers`)

**Risks today**
- Suppliers can drift from categories (orphaned category IDs); admin has no signal.
- No bulk edits (category rename, tag reassign).
- Favorites data is invisible to admin.

**Upgrades**
- **Health check tab**: orphan suppliers, missing logo, broken website URL (HEAD-check), duplicates by domain.
- **Merge duplicates** flow — pick a canonical row, redirect favorites.
- **Bulk actions**: assign category, publish/unpublish, feature/unfeature.
- **Featured carousel manager** — drag to reorder featured suppliers with live preview.
- **"Most favorited" leaderboard** using `supplier_favorites` counts — useful for admin curation and for pitching partnership renewals.
- **Public form for suppliers to self-submit** → moderation queue tab.

---

## 6. Deals (`/admin/deals`)

**Risks today**
- Expired deals stay visible until manually removed.
- No usage tracking (was the coupon actually clicked?).

**Upgrades**
- **`expires_at` auto-hide** + "Expiring in 7d" filter and email digest to admin.
- **Click tracking** via a redirect edge function `/r/deal/:id` → increments counter, then 302s to the partner URL.
- **Duplicate / rollover** button to renew a deal for the next quarter.
- **Supplier link** — pick a supplier row instead of typing a name; keeps hub coherent.
- **Preview card** side panel — see the member-facing card before publishing.
- **Deal categories** (percent-off, freebie, event) with color chips.

---

## 7. People Hub (`/admin/people-hub`)

**Risks today**
- Students tab lists everyone but has no segmentation ("free trial ending", "past due", "high engagement").
- Granting/revoking entitlements is one-at-a-time.
- Membership plans tab is now rich, but there's no bridge from a student row to their subscription/portal state.

**Upgrades — Students**
- **Segments**: saved filters (active paid, trialing, past_due, cancelled 30d, no plan + signed up 7d, admins). Each segment shows count and refreshes live.
- **Bulk actions**: grant plan, grant course entitlement, invite to community space, send email (via edge function using Resend), promote/demote admin, export CSV.
- **Student detail drawer**: full timeline — signups, payments, course progress, quiz attempts, community posts, admin notes.
- **Impersonate / view-as** button reusing existing `admin-preview` store so admin can see what a specific student sees.
- **Notes + tags** — free-text notes and tags on `profiles` (new columns) for CRM-lite workflows.

**Upgrades — Membership plans**
- **Coupon manager** — Stripe promotion codes CRUD.
- **Trial config** per plan (days).
- **Waitlist mode** — flip a plan to waitlist; new checkouts collect email only.
- **Plan comparison matrix editor** — reorders + toggles what shows on `/plans`.

---

## 8. Diagnostics (`/admin/diagnostics`)

**Risks today**
- Static snapshot; admin doesn't know if a problem is new or historical.
- No one-click remediation.

**Upgrades**
- **Auto-scan schedule** — nightly edge function runs every check and stores results in `diagnostics_runs`; UI shows trend line (issues over time).
- **Fix-it buttons** for common issues: reprocess a lesson video URL, re-run Stripe reconciliation on a plan, regenerate missing thumbnails via imagegen, re-index community search.
- **Categorized checks**: Content, Billing, Auth, Storage, Realtime, Webhooks — each with pass/fail badges.
- **Export report** as PDF/JSON for compliance.
- **Alert rules** — if any critical check fails, email + Slack/webhook (secret-based).

---

## 9. Analytics (`/admin/analytics`)

**Risks today**
- Numbers without narrative; hard to know what to act on.
- No cohort or funnel view.

**Upgrades**
- **North-star dashboard**: MRR trend, Active learners (weekly), Course completion rate, Community DAU, Churn — with WoW deltas.
- **Signup → paid funnel** (visit → signup → checkout started → paid) with drop-off %.
- **Cohort retention grid** (weekly signups × weeks retained).
- **Per-course engagement**: enrolments, completion rate, avg. rating, drop-off lesson (where students stop watching).
- **Community pulse**: posts/week, top contributors, unanswered questions >48h.
- **Revenue breakdown by plan** + refund/chargeback count.
- **Custom date range + CSV export** on every widget.
- **AI insights panel** (Lovable AI Gateway) — weekly generated summary: "MRR +8% WoW driven by Foundations plan; churn spike from 3 past-due subscriptions — click to reconcile."

---

## Cross-cutting infrastructure (reused by every hub)

1. **Bulk-action pattern** — one shared `<BulkActionBar>` component + `useSelection` hook.
2. **Deep-link filters** — every list reads/writes filters from the URL so admin can bookmark / share pre-filtered views.
3. **Command palette (⌘K)** — global registry of actions each page can push into.
4. **Toast + audit** — every mutation writes to `course_audit_logs` (extend to non-course entities via a generic `admin_audit_logs` table) and shows an undo toast for 8s.
5. **Cron edge functions** — a single scheduler function fanning out to: broken-link scan, reminder emails, diagnostics scan, scheduled publish, expiring-deal digest.
6. **Realtime badges** — subscribe to `pending_posts`, `past_due_subs`, `failed_webhooks` and pulse the sidebar item when count > 0.
7. **Permission tiers** — introduce `editor` role (can edit content, cannot manage billing/people) so the founder can delegate safely.

---

## Suggested rollout order (fast → high leverage)

1. **Foundations** — command palette, bulk-action bar, URL-filter pattern, extend audit to all entities.
2. **Overview upgrades** — actionable KPIs + health strip + since-last-visit.
3. **Course Management** — bulk publish/duplicate, broken-link scanner, access preview drawer.
4. **People Hub** — segments + bulk grant + student detail drawer.
5. **Events Hub** — unified new-session, calendar view, attendee panel, reminders cron.
6. **Diagnostics** — nightly scan + fix-it buttons.
7. **Analytics** — north-star dashboard + funnel + cohort + AI insights.
8. **Magazine / Suppliers / Deals** — polish (scheduler, click tracking, health tab).

Each phase is independently shippable and delivers visible admin-time savings before the next starts.

Approve the plan (or tell me which phase to start with) and I'll execute.
