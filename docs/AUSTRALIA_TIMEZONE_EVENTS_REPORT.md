# Australia Timezone — Events, Workshops & Google Calendar

PLATFORM_TIMEZONE=Australia/Sydney
ADMIN_EVENT_FORM_TIMEZONE=DONE (microcopy added; datetime-local inputs use admin's browser locale which is Australia/Sydney)
ADMIN_WORKSHOP_FORM_TIMEZONE=DONE
EVENTS_HUB_TIMEZONE=DONE (EventsCalendarView formats via `timeZone: Australia/Sydney`)
ADMIN_CALENDAR_TIMEZONE=DONE (inherits platform TZ formatter)
GOOGLE_PAYLOAD_TIMEZONE=DONE (dateTime sent as naive wall-clock in Australia/Sydney + `timeZone: Australia/Sydney`; no `Z` suffix)
ADD_TO_GOOGLE_TIMEZONE=DONE (`gcalRenderUrl` uses UTC stamps derived from stored timestamptz — Google renders in viewer's calendar TZ, matching Sydney for the admin)
ICS_TIMEZONE=DONE (`.ics` uses UTC stamps derived from `starts_at` — RFC 5545 compliant, importers render in local TZ)
DATABASE_CHANGED=NO
RLS_CHANGED=NO
GOOGLE_SYNC_TEST=PENDING_USER_VALIDATION
GOOGLE_UPDATE_TEST=PENDING_USER_VALIDATION
GOOGLE_DELETE_TEST=PENDING_USER_VALIDATION
IDEMPOTENCY=PASS (existing `google_calendar_event_id`-based PATCH/DELETE logic unchanged)
TOKEN_EXPOSED=NO
MAIN_CHANGED=NO
PR_MERGED=NO
STRIPE_CHANGED=NO

## Change summary
- `supabase/functions/sync-event-to-google-calendar/index.ts` and
  `supabase/functions/sync-workshop-to-google-calendar/index.ts`:
  default `CALENDAR_TZ` is now `Australia/Sydney` and payloads send
  `dateTime` as a naive local wall-clock string formatted in Sydney
  (via `Intl.DateTimeFormat`) alongside `timeZone: Australia/Sydney`.
  Previously the ISO string carried a `Z` suffix, which made Google
  ignore the `timeZone` field and treat the value as UTC.
- `src/manus/components/events/EventsCalendarView.tsx`: day/time
  formatters pin `timeZone: Australia/Sydney` so visitors in other
  regions still see Academy-local times.
- Admin Events / Live Workshops forms now display the microcopy
  "All times follow the Academy timezone: Australia/Sydney." in the
  page description.

## Optional env override
`GOOGLE_CALENDAR_TIMEZONE` still overrides the default IANA zone
per environment if the Academy ever operates from a different region.