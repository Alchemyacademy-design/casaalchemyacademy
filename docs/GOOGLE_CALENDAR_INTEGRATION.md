# Google Calendar Integration

## Overview

Admin-managed events in Alchemy Academy are automatically synced to a Google
Calendar via the Lovable **Google Calendar App Connector**. Public visitors on
`/events` also get a one-click **"Add to Google Calendar"** link per event.

## Architecture

```
Admin UI (AdminEvents)
        │
        │  supabase.functions.invoke("sync-event-to-google-calendar")
        ▼
Edge Function: sync-event-to-google-calendar
        │
        │  fetch → https://connector-gateway.lovable.dev/google_calendar/calendar/v3/...
        │  Headers: Authorization: Bearer $LOVABLE_API_KEY
        │           X-Connection-Api-Key: $GOOGLE_CALENDAR_API_KEY
        ▼
Google Calendar API (v3)  ── OAuth refresh handled by Lovable gateway
```

## Database

Migration adds five columns on `public.events`:

| Column | Type | Purpose |
| --- | --- | --- |
| `google_calendar_event_id` | `text` | Google Calendar event id for update/delete |
| `google_calendar_html_link` | `text` | `htmlLink` returned by Google — used for "Open in Google Calendar" |
| `google_calendar_synced_at` | `timestamptz` | Last sync attempt |
| `google_calendar_sync_status` | `text` | `not_synced` \| `pending` \| `synced` \| `failed` \| `deleted` |
| `google_calendar_sync_error` | `text` | Short error message when `failed` |

No changes to RLS — existing `events` policies apply. Only the service-role
edge function writes these columns.

## Automatic sync flow

`AdminTablePage` now accepts an `afterMutate(op, ctx)` hook. `AdminEvents.tsx`
wires it so:

- **save (insert or update)** → `sync-event-to-google-calendar { action: "upsert" }`
  - Draft or otherwise unpublished events are **removed** from the calendar
    (so scheduling in advance doesn't leak private drafts).
- **archive / delete** → `sync-event-to-google-calendar { action: "delete" }`

The edge function reloads the event from the DB (never trusts client input),
builds a Google Calendar payload, and:

- If no `google_calendar_event_id`: **POST** `/events` → stores the returned id +
  `htmlLink`.
- If existing id: **PATCH** `/events/{id}`. On 404/410 (event deleted upstream),
  auto-retries as **POST** and refreshes the id.
- Delete branch: **DELETE** `/events/{id}` (200/204/404/410 all treated as
  success). Clears the local id + link.

All outcomes are persisted to `google_calendar_sync_status` /
`google_calendar_sync_error` so admins can see which events are in a bad state
directly in the admin table.

## Configuration

| Secret / env | Where it comes from | Required |
| --- | --- | --- |
| `LOVABLE_API_KEY` | Auto-provisioned | ✅ |
| `GOOGLE_CALENDAR_API_KEY` | Linked via `standard_connectors--connect` (`google_calendar`) | ✅ |
| `GOOGLE_CALENDAR_ID` | Optional edge-function env; defaults to `primary` | Optional |

To sync into a **shared calendar** instead of the connected account's primary
calendar, set `GOOGLE_CALENDAR_ID` to that calendar's id in Supabase Edge
Function secrets.

## Public-side "Add to Google Calendar"

`/events` cards render a link using the standard Google Calendar
**`calendar/render?action=TEMPLATE`** URL. This requires no auth for the
visitor — Google shows a pre-filled event for the visitor to save to their own
account. This works even when a visitor has no Alchemy account or Google API
setup.

## Failure handling

- Gateway auth errors (`unauthorized`, `lovable_api_key_not_registered`):
  rotate `LOVABLE_API_KEY` once via `lovable_api_key--rotate_lovable_api_key`,
  then redeploy the edge function.
- Provider errors (missing scope, quota, 4xx): stored verbatim in
  `google_calendar_sync_error`. Reconnect the Google Calendar connection with
  the missing scopes if needed — do **not** rotate the key.
- Deleted upstream event: auto-recreated on next save.

## Extending

- Add attendees: extend `toGCalEvent()` in the edge function with an
  `attendees` array (requires the `calendar.events` scope, already granted by
  the connector).
- Bulk backfill: call the edge function per event id from a small admin
  script; the `upsert` action is idempotent.