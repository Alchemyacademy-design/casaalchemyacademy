# Admin Google Calendar Sync — Debug & Hardening Report

Branch: `prelaunch-phase-2-3-official-render`
Scope: Admin-only Google Calendar sync for `public.events` and `public.live_workshops`.

## Status flags

- TOAST_ERROR_UX_FIXED=DONE
- TIMEZONE_VALIDATED=DONE
- GOOGLE_HTML_LINK_PERSISTED=DONE
- OPEN_IN_GOOGLE_CALENDAR_BUTTON=DONE
- CONNECTED_GOOGLE_ACCOUNT_CHECK=DONE
- STRUCTURED_LOGS=DONE
- GOOGLE_EVENT_VISIBLE_IN_REAL_CALENDAR=PENDING_ADMIN_VISUAL_CONFIRMATION
- TYPECHECK=DONE (via harness)
- TESTS=NOT_RUN (no new tests added; existing suite unchanged)
- LINT=DONE (via harness)
- BUILD=DONE (via harness)
- TOKEN_EXPOSED=NO
- MAIN_CHANGED=NO
- PR_MERGED=NO
- STRIPE_CHANGED=NO
- DATABASE_CHANGED=NO
- RLS_CHANGED=NO

## 1. Toast / error UX

Shared helper `src/manus/lib/gcal-sync-toast.ts` replaces the generic invocation error in `AdminEvents.tsx` and `AdminWorkshops.tsx`.

- On `FunctionsHttpError`, reads `error.context.text()` and parses `details` / `error` so the real reason surfaces.
- Re-selects the row (`google_calendar_sync_status`, `google_calendar_sync_error`) after any failure. If already `synced` (or `deleted` on removal), the stale error toast is suppressed.
- Copy: `Saved in the platform, but Google Calendar sync failed.` + `Technical reason: <erro seguro real>`.

## 2. Timezone

Both edge functions now send `timeZone` explicitly and default to `America/Sao_Paulo` (override with env `GOOGLE_CALENDAR_TIMEZONE`).

`start: { dateTime, timeZone: "America/Sao_Paulo" }` and same for `end`. `starts_at` is `timestamptz`, so the ISO sent to Google is UTC-normalized and Google renders it in the calendar timezone. Admin UI (`EventsCalendarView`, tables, cards, `.ics` builder in `src/lib/calendar-links.ts`) formats via the browser locale, matching `America/Sao_Paulo`. Test event `2026-07-23T08:29Z` renders as `23/07/2026 05:29` consistently.

## 3. Open in Google Calendar

`google_calendar_html_link` is persisted from `parsed.htmlLink`. Verified on event #4 (`liveteste`): `google_calendar_event_id = 6p375tf3it30ctmk2ahprn1phs`, `sync_status = synced`, `html_link` populated. `GCalCell` renders the external-link icon whenever the field exists.

## 4. Connected Google account

Decoded from the persisted `htmlLink` `eid`:

- CONNECTED_GOOGLE_ACCOUNT_EMAIL=contact@casaalchemystudio.com
- CALENDAR_ID=primary

The event was created on the primary calendar of the expected admin account. No token or secret is logged.

## 5. Structured logs (no secrets)

Both edge functions emit JSON logs at each step: `function_started`, `admin_authenticated` (only `user_id`), `request_parsed`, `event_loaded` / `workshop_loaded`, `payload_built` (`calendar_id`, `timezone`, `should_delete`), `gateway_called` (`gateway_status`, `result_status`, `has_html_link`), `db_updated`. Headers, tokens, and connector API keys are never logged.

## Out of scope (deferred)

OAuth for end-users, App User Connector wiring, auto-add on Participate, Profile Calendar Integration.
