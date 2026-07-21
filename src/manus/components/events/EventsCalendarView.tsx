import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Video, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import type { CalendarItem } from "@/lib/calendar-links";

// Editorial monthly calendar — no external library.
// Desktop: month grid with small chips inside each day + upcoming rail.
// Mobile: agenda list grouped by day (grids get cramped under 640px).

export type CalendarEntry = CalendarItem & {
  registered?: boolean;
  synced?: boolean;
};

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtMonth(d: Date) { return d.toLocaleDateString(undefined, { month: "long", year: "numeric" }); }
// Academy operates in Sydney; render all event times in the platform timezone
// regardless of the visitor's browser locale.
const PLATFORM_TZ = "Australia/Sydney";
function fmtDay(d: Date) { return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: PLATFORM_TZ }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZone: PLATFORM_TZ }); }

function buildDays(month: Date) {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // grid starts on Sunday
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function EventsCalendarView({ entries }: { entries: CalendarEntry[] }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<Date>(startOfMonth(today));
  const [selected, setSelected] = useState<Date>(today);

  const days = useMemo(() => buildDays(cursor), [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      const d = new Date(e.starts_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return map;
  }, [entries]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const upcoming = useMemo(() => {
    return entries
      .filter(e => new Date(e.starts_at).getTime() >= today.getTime())
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, 8);
  }, [entries, today]);

  const selectedDayEntries = byDay.get(dayKey(selected)) ?? [];

  // Mobile agenda: entries grouped by day, upcoming only, month scoped.
  const monthEntries = useMemo(() => {
    return entries
      .filter(e => {
        const d = new Date(e.starts_at);
        return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [entries, cursor]);

  const monthGrouped = useMemo(() => {
    const groups: { day: Date; items: CalendarEntry[] }[] = [];
    for (const e of monthEntries) {
      const d = new Date(e.starts_at);
      const g = groups.find(x => sameDay(x.day, d));
      if (g) g.items.push(e);
      else groups.push({ day: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [e] });
    }
    return groups;
  }, [monthEntries]);

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => setCursor(addMonths(cursor, -1))}
          className="p-2 rounded border transition hover:bg-[var(--aa-cream-dark)]"
          style={{ borderColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)" }}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <h3 className="font-serif text-xl" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
          {fmtMonth(cursor)}
        </h3>
        <button
          onClick={() => setCursor(addMonths(cursor, 1))}
          className="p-2 rounded border transition hover:bg-[var(--aa-cream-dark)]"
          style={{ borderColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)" }}
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => { setCursor(startOfMonth(today)); setSelected(today); }}
          className="ml-2 px-3 py-1.5 rounded text-xs font-medium border transition hover:bg-[var(--aa-cream-dark)]"
          style={{ borderColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)" }}
        >
          Today
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--aa-text-mid)" }}>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: "var(--aa-olive-dark)" }} />Event</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full" style={{ background: "var(--aa-gold)" }} />Workshop</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 size={12} style={{ color: "var(--aa-gold)" }} />Registered</span>
        </div>
      </div>

      {/* Desktop / tablet grid */}
      <div className="hidden sm:grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--aa-cream-dark)", background: "var(--aa-white)" }}>
          <div className="grid grid-cols-7 text-[11px] font-medium uppercase tracking-wide" style={{ background: "var(--aa-cream-dark)", color: "var(--aa-text-mid)" }}>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(l => (
              <div key={l} className="px-2 py-2 text-center">{l}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = sameDay(d, today);
              const isSelected = sameDay(d, selected);
              const items = byDay.get(dayKey(d)) ?? [];
              return (
                <button
                  key={i}
                  onClick={() => setSelected(d)}
                  className="text-left px-2 py-2 min-h-[84px] border-t border-l transition"
                  style={{
                    borderColor: "var(--aa-cream-dark)",
                    background: isSelected ? "var(--aa-cream-dark)" : "transparent",
                    opacity: inMonth ? 1 : 0.4,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-xs"
                      style={{
                        color: isToday ? "var(--aa-white)" : "var(--aa-text-dark)",
                        background: isToday ? "var(--aa-olive-dark)" : "transparent",
                        padding: isToday ? "1px 6px" : 0,
                        borderRadius: "999px",
                        fontWeight: isToday ? 500 : 400,
                      }}
                    >{d.getDate()}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {items.slice(0, 3).map((e) => (
                      <div
                        key={`${e.kind}-${e.id}`}
                        className="text-[10px] truncate px-1.5 py-0.5 rounded"
                        style={{
                          background: e.kind === "workshop" ? "var(--aa-gold-light)" : "var(--aa-olive-dark)",
                          color: e.kind === "workshop" ? "var(--aa-olive-dark)" : "var(--aa-white)",
                        }}
                        title={e.title}
                      >
                        {e.registered ? "✓ " : ""}{e.title}
                      </div>
                    ))}
                    {items.length > 3 && (
                      <span className="text-[10px]" style={{ color: "var(--aa-text-light)" }}>+{items.length - 3} more</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="section-label mb-2">Selected day</p>
            <p className="text-sm mb-3" style={{ color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{fmtDay(selected)}</p>
            {selectedDayEntries.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--aa-text-light)" }}>Nothing scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {selectedDayEntries.map(e => <AgendaRow key={`${e.kind}-${e.id}`} entry={e} />)}
              </ul>
            )}
          </div>
          <div>
            <p className="section-label mb-2">Upcoming</p>
            {upcoming.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--aa-text-light)" }}>No upcoming items.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map(e => <AgendaRow key={`up-${e.kind}-${e.id}`} entry={e} showDate />)}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Mobile agenda list */}
      <div className="sm:hidden">
        {monthGrouped.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-sm" style={{ borderColor: "var(--aa-cream-dark)", background: "var(--aa-white)", color: "var(--aa-text-mid)" }}>
            Nothing scheduled in {fmtMonth(cursor)}.
          </div>
        ) : (
          <ul className="space-y-4">
            {monthGrouped.map(g => (
              <li key={g.day.toISOString()}>
                <p className="text-xs mb-2" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                  {fmtDay(g.day)}{sameDay(g.day, today) ? " · Today" : ""}
                </p>
                <ul className="space-y-2">
                  {g.items.map(e => <AgendaRow key={`m-${e.kind}-${e.id}`} entry={e} />)}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AgendaRow({ entry, showDate = false }: { entry: CalendarEntry; showDate?: boolean }) {
  const d = new Date(entry.starts_at);
  return (
    <li
      className="rounded-md px-3 py-2 border flex items-start gap-3"
      style={{ borderColor: "var(--aa-cream-dark)", background: "var(--aa-white)" }}
    >
      <div
        className="mt-0.5 w-1 self-stretch rounded"
        style={{ background: entry.kind === "workshop" ? "var(--aa-gold)" : "var(--aa-olive-dark)" }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--aa-text-light)" }}>
          {entry.kind === "workshop" ? <Video size={11} /> : <CalendarIcon size={11} />}
          <span>{entry.kind === "workshop" ? "Live workshop" : "Event"}</span>
          <span>·</span>
          <span>{showDate ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " : ""}{fmtTime(entry.starts_at)}</span>
        </div>
        <p className="text-sm truncate" style={{ color: "var(--aa-olive-dark)", fontWeight: 500 }}>{entry.title}</p>
        {entry.location && (
          <div className="flex items-center gap-1 text-[11px]" style={{ color: "var(--aa-text-light)" }}>
            <MapPin size={10} /><span className="truncate">{entry.location}</span>
          </div>
        )}
      </div>
      {entry.registered && (
        <CheckCircle2 size={14} style={{ color: "var(--aa-gold)" }} aria-label="Registered" />
      )}
    </li>
  );
}