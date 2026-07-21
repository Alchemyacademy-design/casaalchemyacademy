import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalIcon,
  ExternalLink,
  RefreshCw,
  Pencil,
  MapPin,
  Video,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Source = "event" | "workshop";
type SyncStatus = "not_synced" | "pending" | "synced" | "failed" | "deleted";

export type AdminCalendarItem = {
  id: number;
  source: Source;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  online_url: string | null;
  status: string | null;
  archived_at: string | null;
  google_calendar_event_id: string | null;
  google_calendar_html_link: string | null;
  google_calendar_synced_at: string | null;
  google_calendar_sync_status: SyncStatus;
  google_calendar_sync_error: string | null;
};

type Filter = "all" | "events" | "workshops" | "synced" | "failed" | "pending" | "archived";
type ViewMode = "month" | "list";

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function fmtMonth(d: Date) { return d.toLocaleDateString(undefined, { month: "long", year: "numeric" }); }
function fmtDay(d: Date) { return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }
function isoDay(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function sameDay(a: Date, b: Date) { return isoDay(a) === isoDay(b); }

const EVENT_SELECT =
  "id,title,starts_at,ends_at,location,external_url,status,archived_at,google_calendar_event_id,google_calendar_html_link,google_calendar_synced_at,google_calendar_sync_status,google_calendar_sync_error";
const WORKSHOP_SELECT =
  "id,title,starts_at,ends_at,meeting_url,status,archived_at,google_calendar_event_id,google_calendar_html_link,google_calendar_synced_at,google_calendar_sync_status,google_calendar_sync_error";

type EventRow = {
  id: number; title: string; starts_at: string; ends_at: string | null;
  location: string | null; external_url: string | null; status: string | null;
  archived_at: string | null; google_calendar_event_id: string | null;
  google_calendar_html_link: string | null; google_calendar_synced_at: string | null;
  google_calendar_sync_status: SyncStatus | null; google_calendar_sync_error: string | null;
};
type WorkshopRow = Omit<EventRow, "location" | "external_url"> & { meeting_url: string | null };

function normalizeEvent(r: EventRow): AdminCalendarItem {
  return {
    id: r.id, source: "event", title: r.title, starts_at: r.starts_at, ends_at: r.ends_at,
    location: r.location, online_url: r.external_url, status: r.status,
    archived_at: r.archived_at,
    google_calendar_event_id: r.google_calendar_event_id,
    google_calendar_html_link: r.google_calendar_html_link,
    google_calendar_synced_at: r.google_calendar_synced_at,
    google_calendar_sync_status: (r.google_calendar_sync_status ?? "not_synced") as SyncStatus,
    google_calendar_sync_error: r.google_calendar_sync_error,
  };
}
function normalizeWorkshop(r: WorkshopRow): AdminCalendarItem {
  return {
    id: r.id, source: "workshop", title: r.title, starts_at: r.starts_at, ends_at: r.ends_at,
    location: null, online_url: r.meeting_url, status: r.status,
    archived_at: r.archived_at,
    google_calendar_event_id: r.google_calendar_event_id,
    google_calendar_html_link: r.google_calendar_html_link,
    google_calendar_synced_at: r.google_calendar_synced_at,
    google_calendar_sync_status: (r.google_calendar_sync_status ?? "not_synced") as SyncStatus,
    google_calendar_sync_error: r.google_calendar_sync_error,
  };
}

async function callSync(source: Source, id: number) {
  const fn = source === "workshop" ? "sync-workshop-to-google-calendar" : "sync-event-to-google-calendar";
  const body = source === "workshop" ? { workshop_id: id, action: "upsert" } : { event_id: id, action: "upsert" };
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    toast.error("Google Calendar sync failed", { description: error.message });
    return;
  }
  const payload = data as { ok?: boolean; error?: string | null } | null;
  if (payload?.ok) toast.success("Synced to Google Calendar");
  else toast.error("Google Calendar sync returned an error", { description: payload?.error ?? "unknown" });
}

const STATUS_STYLES: Record<SyncStatus, { bg: string; fg: string; label: string }> = {
  synced: { bg: "rgba(196,160,90,0.18)", fg: "var(--aa-olive-dark)", label: "synced" },
  pending: { bg: "rgba(196,156,109,0.20)", fg: "var(--aa-olive-dark)", label: "pending" },
  failed: { bg: "rgba(180,60,60,0.15)", fg: "#8a2020", label: "failed" },
  deleted: { bg: "rgba(0,0,0,0.08)", fg: "var(--aa-text-mid)", label: "deleted" },
  not_synced: { bg: "rgba(0,0,0,0.06)", fg: "var(--aa-text-mid)", label: "not synced" },
};

function StatusChip({ status }: { status: SyncStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: s.bg, color: s.fg, fontFamily: "'DM Sans', sans-serif" }}
    >
      {status === "synced" && <CheckCircle2 size={10} />}
      {status === "failed" && <AlertTriangle size={10} />}
      {status === "pending" && <Clock size={10} />}
      {s.label}
    </span>
  );
}

export default function EventsCalendar() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(new Date());
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<ViewMode>("month");
  const qc = useQueryClient();

  const from = startOfMonth(cursor).toISOString();
  const to = endOfMonth(cursor).toISOString();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "events"] });
    qc.invalidateQueries({ queryKey: ["admin", "live_workshops"] });
  };

  // Realtime: refresh admin caches whenever the source tables change.
  useEffect(() => {
    const channel = supabase
      .channel("admin-events-calendar-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_workshops" }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventsQ = useQuery({
    queryKey: ["admin", "events", "calendar", from, to],
    queryFn: async (): Promise<AdminCalendarItem[]> => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .gte("starts_at", from)
        .lte("starts_at", to);
      if (error) throw error;
      return ((data ?? []) as unknown as EventRow[]).map(normalizeEvent);
    },
  });
  const workshopsQ = useQuery({
    queryKey: ["admin", "live_workshops", "calendar", from, to],
    queryFn: async (): Promise<AdminCalendarItem[]> => {
      const { data, error } = await supabase
        .from("live_workshops")
        .select(WORKSHOP_SELECT)
        .gte("starts_at", from)
        .lte("starts_at", to);
      if (error) throw error;
      return ((data ?? []) as unknown as WorkshopRow[]).map(normalizeWorkshop);
    },
  });

  const items = useMemo(() => {
    const all = [...(eventsQ.data ?? []), ...(workshopsQ.data ?? [])];
    // Deduplicate by source+id (defensive; realtime should not duplicate).
    const map = new Map<string, AdminCalendarItem>();
    for (const it of all) map.set(`${it.source}-${it.id}`, it);
    return Array.from(map.values()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }, [eventsQ.data, workshopsQ.data]);

  const filtered = useMemo(() => items.filter((i) => {
    switch (filter) {
      case "events": return i.source === "event" && !i.archived_at;
      case "workshops": return i.source === "workshop" && !i.archived_at;
      case "synced": return i.google_calendar_sync_status === "synced";
      case "failed": return i.google_calendar_sync_status === "failed";
      case "pending": return i.google_calendar_sync_status === "pending";
      case "archived": return !!i.archived_at || i.status === "archived";
      default: return !i.archived_at;
    }
  }), [items, filter]);

  const byDay = useMemo(() => {
    const m = new Map<string, AdminCalendarItem[]>();
    for (const i of filtered) {
      const key = isoDay(new Date(i.starts_at));
      const arr = m.get(key) ?? [];
      arr.push(i);
      m.set(key, arr);
    }
    return m;
  }, [filtered]);

  // Google sync summary panel
  const summary = useMemo(() => {
    let synced = 0, failed = 0, pending = 0, lastSync: string | null = null;
    for (const i of items) {
      if (i.google_calendar_sync_status === "synced") synced++;
      else if (i.google_calendar_sync_status === "failed") failed++;
      else if (i.google_calendar_sync_status === "pending") pending++;
      if (i.google_calendar_synced_at && (!lastSync || i.google_calendar_synced_at > lastSync)) {
        lastSync = i.google_calendar_synced_at;
      }
    }
    return { synced, failed, pending, lastSync };
  }, [items]);

  const isLoading = eventsQ.isLoading || workshopsQ.isLoading;

  // Month cells
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const cells: Array<{ date?: Date }> = [];
  for (let i = 0; i < startPad; i++) cells.push({});
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d) });
  while (cells.length % 7) cells.push({});

  const selectedItems = byDay.get(isoDay(selected)) ?? [];

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "events", label: "Events" },
    { key: "workshops", label: "Live Workshops" },
    { key: "synced", label: "Synced" },
    { key: "pending", label: "Pending" },
    { key: "failed", label: "Failed" },
    { key: "archived", label: "Archived" },
  ];

  return (
    <Card className="p-4 sm:p-5" style={{ background: "var(--aa-white)", borderColor: "var(--aa-cream-dark)" }}>
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2
              className="text-xl sm:text-2xl"
              style={{ fontFamily: "'Cormorant Garamond', serif", color: "var(--aa-olive-dark)", fontWeight: 500 }}
            >
              Admin Calendar
            </h2>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
              Manage platform events and live workshops in one place.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { const t = new Date(); setCursor(startOfMonth(t)); setSelected(t); }}
            >
              Today
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="ml-2 hidden sm:flex rounded-md border overflow-hidden" style={{ borderColor: "var(--aa-cream-dark)" }}>
              <button
                onClick={() => setView("month")}
                className="px-2.5 py-1 text-xs"
                style={{
                  background: view === "month" ? "var(--aa-cream-dark)" : "transparent",
                  color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif",
                }}
              >Month</button>
              <button
                onClick={() => setView("list")}
                className="px-2.5 py-1 text-xs"
                style={{
                  background: view === "list" ? "var(--aa-cream-dark)" : "transparent",
                  color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif",
                }}
              >List</button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CalIcon className="h-4 w-4" style={{ color: "var(--aa-olive-mid)" }} />
            <span className="text-sm" style={{ color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
              {fmtMonth(cursor)}
            </span>
            {isLoading && <span className="text-xs" style={{ color: "var(--aa-text-light)" }}>Loading…</span>}
          </div>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-2.5 py-1 rounded-full text-[11px] border transition"
                style={{
                  borderColor: "var(--aa-cream-dark)",
                  background: filter === f.key ? "var(--aa-olive-dark)" : "var(--aa-white)",
                  color: filter === f.key ? "var(--aa-white)" : "var(--aa-text-mid)",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                }}
              >{f.label}</button>
            ))}
          </div>
        </div>

        {/* Google Calendar Sync mini panel */}
        <div
          className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-xs"
          style={{ borderColor: "var(--aa-cream-dark)", background: "var(--aa-muted-surface)", color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}
        >
          <span className="font-medium" style={{ color: "var(--aa-olive-dark)" }}>Google Calendar Sync</span>
          <span>Synced: <b style={{ color: "var(--aa-olive-dark)" }}>{summary.synced}</b></span>
          <span>Pending: <b style={{ color: "var(--aa-olive-dark)" }}>{summary.pending}</b></span>
          <span>Failed: <b style={{ color: "#8a2020" }}>{summary.failed}</b></span>
          {summary.lastSync && (
            <span>Last sync: {new Date(summary.lastSync).toLocaleString()}</span>
          )}
          <span className="ml-auto italic">Platform events synced with Google Calendar.</span>
        </div>
      </div>

      {/* Desktop grid */}
      {view === "month" && (
        <div className="hidden sm:grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="rounded-md overflow-hidden border" style={{ borderColor: "var(--aa-cream-dark)" }}>
            <div className="grid grid-cols-7 text-[10px] uppercase tracking-wider" style={{ background: "var(--aa-cream-dark)", color: "var(--aa-text-mid)" }}>
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                <div key={d} className="px-2 py-1.5 text-center">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((c, idx) => {
                if (!c.date) return <div key={idx} className="min-h-[92px] border-t border-l" style={{ borderColor: "var(--aa-cream-dark)", background: "var(--aa-muted-surface)" }} />;
                const dayItems = byDay.get(isoDay(c.date)) ?? [];
                const isToday = sameDay(c.date, new Date());
                const isSelected = sameDay(c.date, selected);
                return (
                  <button
                    key={idx}
                    onClick={() => setSelected(c.date!)}
                    className="text-left px-1.5 py-1.5 min-h-[92px] border-t border-l transition"
                    style={{
                      borderColor: "var(--aa-cream-dark)",
                      background: isSelected ? "var(--aa-cream-dark)" : "var(--aa-white)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[11px]"
                        style={{
                          color: isToday ? "var(--aa-white)" : "var(--aa-text-dark)",
                          background: isToday ? "var(--aa-olive-dark)" : "transparent",
                          padding: isToday ? "1px 6px" : 0,
                          borderRadius: 999,
                          fontWeight: isToday ? 500 : 400,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >{c.date.getDate()}</span>
                    </div>
                    <div className="space-y-1">
                      {dayItems.slice(0, 3).map((i) => (
                        <div
                          key={`${i.source}-${i.id}`}
                          className="truncate rounded px-1.5 py-0.5 text-[10px] flex items-center gap-1"
                          style={{
                            background: i.source === "workshop" ? "var(--aa-gold-light)" : "var(--aa-olive-dark)",
                            color: i.source === "workshop" ? "var(--aa-olive-dark)" : "var(--aa-white)",
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                          title={`${i.title} · ${fmtTime(i.starts_at)}`}
                        >
                          {i.google_calendar_sync_status === "synced" && <CheckCircle2 size={9} />}
                          {i.google_calendar_sync_status === "failed" && <AlertTriangle size={9} />}
                          <span className="truncate">{i.title}</span>
                        </div>
                      ))}
                      {dayItems.length > 3 && (
                        <div className="text-[10px]" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>+{dayItems.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>Selected day</p>
              <p className="text-sm mb-2" style={{ color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{fmtDay(selected)}</p>
              {selectedItems.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--aa-text-light)" }}>Nothing scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {selectedItems.map((i) => <AdminAgendaRow key={`sel-${i.source}-${i.id}`} item={i} onRetry={callSync} />)}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List view (desktop) + mobile agenda */}
      {(view === "list") && (
        <div className="hidden sm:block">
          <AgendaList items={filtered} onRetry={callSync} />
        </div>
      )}
      <div className="sm:hidden">
        <AgendaList items={filtered} onRetry={callSync} />
      </div>
    </Card>
  );
}

function AgendaList({ items, onRetry }: { items: AdminCalendarItem[]; onRetry: (s: Source, id: number) => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center text-sm" style={{ borderColor: "var(--aa-cream-dark)", background: "var(--aa-white)", color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
        Nothing scheduled.
      </div>
    );
  }
  // Group by day
  const groups = new Map<string, AdminCalendarItem[]>();
  for (const i of items) {
    const d = new Date(i.starts_at);
    const k = isoDay(d);
    const arr = groups.get(k) ?? [];
    arr.push(i);
    groups.set(k, arr);
  }
  const keys = Array.from(groups.keys());
  return (
    <ul className="space-y-4">
      {keys.map((k) => {
        const arr = groups.get(k)!;
        const d = new Date(arr[0].starts_at);
        return (
          <li key={k}>
            <p className="text-xs mb-2" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
              {fmtDay(d)}
            </p>
            <ul className="space-y-2">
              {arr.map((i) => <AdminAgendaRow key={`${i.source}-${i.id}`} item={i} onRetry={onRetry} />)}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function AdminAgendaRow({ item, onRetry }: { item: AdminCalendarItem; onRetry: (s: Source, id: number) => void }) {
  const editHref = item.source === "workshop"
    ? `/admin/events-hub?tab=workshops`
    : `/admin/events-hub?tab=events`;
  return (
    <li
      className="rounded-md px-3 py-2 border flex items-start gap-3"
      style={{ borderColor: "var(--aa-cream-dark)", background: "var(--aa-white)" }}
    >
      <div
        className="mt-0.5 w-1 self-stretch rounded"
        style={{ background: item.source === "workshop" ? "var(--aa-gold)" : "var(--aa-olive-dark)" }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] flex-wrap" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
          {item.source === "workshop" ? <Video size={11} /> : <CalIcon size={11} />}
          <span>{item.source === "workshop" ? "Live workshop" : "Event"}</span>
          <span>·</span>
          <span>{fmtTime(item.starts_at)}</span>
          <StatusChip status={item.google_calendar_sync_status} />
          {item.status === "draft" && (
            <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "rgba(0,0,0,0.06)", color: "var(--aa-text-mid)" }}>draft</span>
          )}
          {item.archived_at && (
            <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "rgba(0,0,0,0.08)", color: "var(--aa-text-mid)" }}>archived</span>
          )}
        </div>
        <p className="text-sm truncate" style={{ color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{item.title}</p>
        {(item.location || item.online_url) && (
          <div className="flex items-center gap-1 text-[11px]" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
            <MapPin size={10} /><span className="truncate">{item.location || item.online_url}</span>
          </div>
        )}
        {item.google_calendar_sync_error && (
          <p className="text-[10px] mt-0.5" style={{ color: "#8a2020" }} title={item.google_calendar_sync_error}>
            {item.google_calendar_sync_error.slice(0, 120)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {item.google_calendar_html_link && (
          <a
            href={item.google_calendar_html_link}
            target="_blank"
            rel="noreferrer"
            title="Open in Google Calendar"
            className="p-1 rounded hover:bg-[var(--aa-cream-dark)]"
            style={{ color: "var(--aa-olive-dark)" }}
          >
            <ExternalLink size={14} />
          </a>
        )}
        {item.google_calendar_sync_status !== "synced" && (
          <button
            onClick={() => onRetry(item.source, item.id)}
            title="Retry Google Calendar sync"
            className="p-1 rounded hover:bg-[var(--aa-cream-dark)]"
            style={{ color: "var(--aa-olive-dark)" }}
          >
            <RefreshCw size={14} />
          </button>
        )}
        <Link
          to={editHref}
          title="Edit"
          className="p-1 rounded hover:bg-[var(--aa-cream-dark)]"
          style={{ color: "var(--aa-olive-dark)" }}
        >
          <Pencil size={14} />
        </Link>
      </div>
    </li>
  );
}