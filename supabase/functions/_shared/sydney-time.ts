// Session times in emails are always shown in Sydney time. Australia/Sydney
// handles daylight saving, so the label switches between AEST and AEDT.
const ZONE = "Australia/Sydney";

function zoneLabel(date: Date): string {
  const offset = new Intl.DateTimeFormat("en-AU", { timeZone: ZONE, timeZoneName: "shortOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value ?? "";
  if (/\+11/.test(offset)) return "AEDT";
  if (/\+10/.test(offset)) return "AEST";
  return offset;
}

function clock(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: ZONE, hour: "numeric", minute: "2-digit", hour12: true })
    .formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const period = (parts.find((p) => p.type === "dayPeriod")?.value ?? "").toLowerCase().replace(/\./g, "");
  return `${hour}${minute === "00" ? "" : `:${minute}`}${period}`;
}

/** e.g. "Thursday 3 December 2026, 7pm to 8pm Sydney time (AEDT)". */
export function formatSydneyWhen(startsAt: string, endsAt?: string | null): string {
  const start = new Date(startsAt);
  const day = new Intl.DateTimeFormat("en-AU", {
    timeZone: ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(start).replace(/,/g, "");
  const end = endsAt ? new Date(endsAt) : null;
  const range = end && !Number.isNaN(end.getTime()) ? `${clock(start)} to ${clock(end)}` : clock(start);
  return `${day}, ${range} Sydney time (${zoneLabel(start)})`;
}

/** Session titles never show dashes: " - ", " – " and " — " become ": ". */
export function sessionTitle(title: string): string {
  return title.replace(/\s+[-–—]\s+/g, ": ").trim();
}

/** HubSpot lead source label for a session sign up. */
export function sessionLeadLabel(title?: string | null): string {
  if (!title) return "Ask the Expert LIVE";
  const rest = sessionTitle(title).replace(/^ask the expert live\s*:?\s*/i, "").trim();
  return rest ? `Ask the Expert LIVE: ${rest}` : "Ask the Expert LIVE";
}

/** A session stops taking sign ups once its end time (or start, if no end) has passed. */
export function sessionHasEnded(startsAt: string, endsAt: string | null | undefined, now = Date.now()): boolean {
  const end = new Date(endsAt ?? startsAt).getTime();
  return Number.isFinite(end) && end <= now;
}
