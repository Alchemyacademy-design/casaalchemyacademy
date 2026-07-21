// Shared helpers for adding platform events/workshops to any user's calendar
// without requiring OAuth. Two paths:
//   1. `gcalRenderUrl` — opens a Google Calendar "TEMPLATE" screen prefilled
//      with the event; the user is the one saving it to their own calendar.
//   2. `icsDataUrl` — a client-side .ics blob that works with Apple Calendar,
//      Outlook, and any RFC 5545 client.
// No secrets, no API calls, no PII beyond what the event already exposes.

export type CalendarItem = {
  id: number | string;
  kind: "event" | "workshop";
  title: string;
  description?: string | null;
  location?: string | null;
  starts_at: string;
  ends_at?: string | null;
  external_url?: string | null;
  meeting_url?: string | null;
};

function toStamp(iso: string) {
  // Google Calendar / iCal want UTC in `YYYYMMDDTHHMMSSZ`.
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function resolveEnd(item: CalendarItem) {
  if (item.ends_at) return item.ends_at;
  return new Date(new Date(item.starts_at).getTime() + 60 * 60 * 1000).toISOString();
}

function buildDescription(item: CalendarItem) {
  const lines: string[] = [];
  if (item.description) lines.push(item.description);
  const link = item.kind === "workshop" ? item.meeting_url : item.external_url;
  if (link) lines.push(`More info: ${link}`);
  lines.push("— Alchemy Academy");
  return lines.join("\n\n");
}

export function gcalRenderUrl(item: CalendarItem): string {
  const start = toStamp(item.starts_at);
  const end = toStamp(resolveEnd(item));
  const location = item.location ?? (item.kind === "workshop" ? item.meeting_url ?? "" : "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates: `${start}/${end}`,
    details: buildDescription(item),
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildIcs(item: CalendarItem): string {
  const start = toStamp(item.starts_at);
  const end = toStamp(resolveEnd(item));
  const uid = `alchemy-${item.kind}-${item.id}@alchemyacademy`;
  const now = toStamp(new Date().toISOString());
  const location = item.location ?? (item.kind === "workshop" ? item.meeting_url ?? "" : "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alchemy Academy//Events Hub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(item.title)}`,
    `DESCRIPTION:${escapeIcs(buildDescription(item))}`,
    location ? `LOCATION:${escapeIcs(location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

export function icsDataUrl(item: CalendarItem): string {
  const ics = buildIcs(item);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function icsFileName(item: CalendarItem): string {
  const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug || item.kind}-${item.id}.ics`;
}