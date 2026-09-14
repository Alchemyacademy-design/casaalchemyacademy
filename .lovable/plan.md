# Close the 4 critical security findings

Two real problems, confirmed by inspecting the live database rules:

1. **Community spaces and channels are visible to everyone.** Alongside the correct paid-members rule, there is a second, looser rule that lets anyone — including logged-out visitors — see the names and descriptions of every published space and channel. Because the rules are combined with "or", the loose one wins and the paywall never applies to that listing.

2. **Students can set their own quiz results.** Students are currently allowed to write directly to the quiz results tables, including the score, the pass/fail flag, and whether each answer was correct. Real submissions already go through the secure server-side path (the `submit-quiz-attempt` function), so this direct write access is unnecessary and only creates a way to forge a pass — which in turn can unlock a certificate.

## What will change

- Remove the loose public-visibility rule on community spaces and on community channels, leaving only the membership/entitlement-based rule. Members and admins see exactly what they see today; non-members and logged-out visitors no longer get the listings.
- Remove students' direct write access to quiz attempts and quiz answers. Quizzes will still be taken and submitted exactly as they are now, through the server-side submission path, which keeps full write access. Reading your own results and admin management are unaffected.
- Mark all four findings as fixed in the Security view afterwards.

## Technical detail

Single migration:

- `DROP POLICY community_spaces_member_select ON public.community_spaces;`
- `DROP POLICY community_channels_member_select ON public.community_channels;`
  (keeps `*_select_accessible`, which checks `private.is_admin()`, `has_active_plan_permission('community')` and course entitlements; `can_access_channel()` for channels)
- `DROP POLICY quiz_attempts_insert_own`, `quiz_attempts_update_own_or_admin`, `quiz_answers_insert_own`, `quiz_answers_update_own_or_admin`; re-create admin-only `UPDATE` policies guarded by `private.is_admin()` so admins keep manual correction ability.
- Revoke `INSERT, UPDATE` on `quiz_attempts` and `quiz_answers` from `authenticated`; keep `SELECT` for `authenticated` and `ALL` for `service_role` (the edge function uses the service role via `internal_submit_quiz_attempt`).

Verification after the migration:
- Run the quiz flow in the preview as a signed-in student: start, submit, see score, and confirm module/certificate gating still reads passed attempts (`ModuleCompletionDialog`, `src/manus/services/quiz.ts`).
- Load the community pages as a member and confirm spaces/channels still list; confirm a logged-out visitor sees nothing.
- Re-run the security scan and mark the four findings fixed.

## Note

Community spaces and channels will no longer be previewable by non-members at all. If you want non-members to see a teaser list of space names as a sales hook, say so and I will add a narrow public-teaser path instead of full removal.
