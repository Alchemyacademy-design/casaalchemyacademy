# Close the 4 critical security findings

Two real problems, confirmed by inspecting the live database rules:

1. **Community spaces and channels are fully open.** Alongside the correct paid-members rule, a looser rule lets anyone — including logged-out visitors — see every published space and channel as if they were a member. The paywall never applies.

2. **Students can set their own quiz results.** Students can write directly to the quiz results tables, including the score, the pass/fail flag, and whether each answer was correct. Real submissions already go through the secure server-side path, so this direct write access only creates a way to forge a pass — which can unlock a certificate.

## What will change

### Community: teaser, not open door

- Names and descriptions of published spaces and channels stay visible to signed-in users, so a course-only student can see what exists.
- The actual content inside (posts, replies, reactions) stays restricted to full members, exactly as it is today.
- Anyone who can see a space or channel but cannot enter it sees a locked state with "Unlock access by subscribing", linking to the plans page.
- Full subscribers and admins keep unrestricted access to every area. Nothing changes for them.

### Quizzes: results become server-only

- Students lose the ability to write quiz attempts and answers directly. Taking and submitting a quiz works exactly as it does now — through the secure server-side submission path.
- Students keep read access to their own results; admins keep full management.

Then mark all four findings as fixed in the Security view.

## Technical detail

Migration:

- Community: keep a teaser-level read. Replace `community_spaces_member_select` and `community_channels_member_select` (currently `anon, authenticated`, unconditional on published status) with `authenticated`-only teaser policies restricted to published rows. Signed-out visitors lose access entirely; signed-in non-members get listing rows only. The existing `*_select_accessible` policies stay for the full-access path.
- Content tables (`community_posts`, `community_replies`, `community_reactions`, `community_reads`) are unchanged — their policies already gate on membership, so a teaser row exposes no posts. Verify this by querying their policies before writing the migration.
- Quizzes: drop `quiz_attempts_insert_own`, `quiz_attempts_update_own_or_admin`, `quiz_answers_insert_own`, `quiz_answers_update_own_or_admin`; re-create admin-only `UPDATE` policies guarded by `private.is_admin()`. Revoke `INSERT, UPDATE` on both tables from `authenticated`; keep `SELECT` for `authenticated` and `ALL` for `service_role` (the `submit-quiz-attempt` edge function grades via the service-role RPC `internal_submit_quiz_attempt`).

Frontend:

- In the community UI (`useCommunityPremiumData` / `CommunityPremium`), distinguish "visible" from "accessible". A space or channel the user can list but not enter renders with a lock icon and, when selected, a panel reading "Unlock access by subscribing" with a button to `/plans` instead of the message feed. Accessibility is determined server-side by whether the channel's posts load, not by a client-side guess.
- `GlobalAccessController` currently bounces non-members away from `/community` entirely. That redirect must be relaxed so course-only students can reach the teaser view.

Verification:
- Signed-in course-only student: sees the space/channel list, sees the unlock panel, cannot read posts.
- Full member and admin: community behaves exactly as before.
- Signed-out visitor: no community data.
- Quiz run end-to-end as a student: start, submit, score renders, module/certificate gating still reads passed attempts.
- Re-run the security scan and mark the four findings fixed.
