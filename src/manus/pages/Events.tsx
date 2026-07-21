import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MemberLayout from "@/manus/components/MemberLayout";
import EventsCalendarView, { type CalendarEntry } from "@/manus/components/events/EventsCalendarView";
import { gcalRenderUrl, icsDataUrl, icsFileName } from "@/lib/calendar-links";
import {
  Calendar, Clock, MapPin, ExternalLink, CheckCircle2, Loader2, CalendarPlus,
  Download, Video, Lock,
} from "lucide-react";
import {
  useUpcomingEvents, usePastEvents, useUpcomingWorkshops, usePastWorkshops,
  useMyRegistrations, useRegisterForTarget,
} from "@/manus/hooks/usePublicContent";
import { useAuth } from "@/manus/hooks/useAuth";

type TabKey = "events" | "workshops" | "calendar";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function useTab(): [TabKey, (t: TabKey) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const active: TabKey = raw === "workshops" || raw === "calendar" ? raw : "events";
  const set = (t: TabKey) => {
    const next = new URLSearchParams(params);
    if (t === "events") next.delete("tab"); else next.set("tab", t);
    setParams(next, { replace: true });
  };
  return [active, set];
}

export default function Events() {
  const [tab, setTab] = useTab();
  const { isAuthenticated, isAdmin, isMember } = useAuth();
  const hasWorkshopAccess = isAdmin || isMember;

  const { data: upcomingEvents = [], isLoading: loadingUE } = useUpcomingEvents();
  const { data: pastEvents = [], isLoading: loadingPE } = usePastEvents(6);
  const { data: upcomingWorkshops = [], isLoading: loadingUW } = useUpcomingWorkshops();
  const { data: pastWorkshops = [], isLoading: loadingPW } = usePastWorkshops(6);
  const { data: regs = [] } = useMyRegistrations();
  const register = useRegisterForTarget();

  const registeredEventIds = useMemo(
    () => new Set(regs.filter(r => r.event_id != null).map(r => r.event_id as number)),
    [regs],
  );
  const registeredWorkshopIds = useMemo(
    () => new Set(regs.filter(r => r.live_workshop_id != null).map(r => r.live_workshop_id as number)),
    [regs],
  );

  const calendarEntries: CalendarEntry[] = useMemo(() => {
    const evs = upcomingEvents.map(e => ({
      id: e.id,
      kind: "event" as const,
      title: e.title,
      description: e.description,
      location: e.location,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      external_url: e.external_url,
      registered: registeredEventIds.has(e.id),
      synced: e.google_calendar_sync_status === "synced",
    }));
    const ws = upcomingWorkshops.map(w => ({
      id: w.id,
      kind: "workshop" as const,
      title: w.title,
      description: w.description,
      starts_at: w.starts_at,
      ends_at: w.ends_at,
      meeting_url: w.meeting_url,
      registered: registeredWorkshopIds.has(w.id),
    }));
    return [...evs, ...ws];
  }, [upcomingEvents, upcomingWorkshops, registeredEventIds, registeredWorkshopIds]);

  const summary = {
    upcomingEvents: upcomingEvents.length,
    upcomingWorkshops: upcomingWorkshops.length,
    registered: registeredEventIds.size + registeredWorkshopIds.size,
  };

  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        {/* Header */}
        <header className="mb-8">
          <p className="section-label mb-2">Events Hub</p>
          <h1 className="font-serif text-3xl md:text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Events Hub
          </h1>
          <p className="text-sm max-w-xl" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            In-person and online events plus live workshops in one place.
          </p>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <SummaryCard label="Upcoming events" value={summary.upcomingEvents} />
          <SummaryCard label="Live workshops" value={summary.upcomingWorkshops} />
          <SummaryCard label="Registered" value={summary.registered} />
          <SummaryCard label="This month" value={countThisMonth(calendarEntries)} />
        </div>

        {/* Tabs */}
        <nav
          className="flex gap-1 mb-6 -mx-1 overflow-x-auto no-scrollbar"
          role="tablist"
          aria-label="Events Hub sections"
        >
          {(["events","workshops","calendar"] as TabKey[]).map(key => {
            const label = key === "events" ? "Events" : key === "workshops" ? "Live workshops" : "Calendar";
            const selected = tab === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(key)}
                className="px-4 py-2 text-sm rounded-md transition whitespace-nowrap"
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  color: selected ? "var(--aa-white)" : "var(--aa-olive-dark)",
                  backgroundColor: selected ? "var(--aa-olive-dark)" : "transparent",
                  border: selected ? "1px solid var(--aa-olive-dark)" : "1px solid var(--aa-cream-dark)",
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Tab panels */}
        {tab === "events" && (
          <section aria-labelledby="tab-events">
            <h2 id="tab-events" className="sr-only">Events</h2>
            <SectionBlock title="Upcoming events" loading={loadingUE} empty={upcomingEvents.length === 0} emptyText="No upcoming events yet. Check back soon.">
              <CardGrid>
                {upcomingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    registered={registeredEventIds.has(event.id)}
                    isAuthenticated={isAuthenticated}
                    onRegister={() => register.mutate({ target_type: "event", target_id: event.id })}
                    registering={register.isPending}
                  />
                ))}
              </CardGrid>
            </SectionBlock>

            <SectionBlock title="Past events" loading={loadingPE} empty={pastEvents.length === 0} emptyText="No past events to show." muted>
              <CardGrid>
                {pastEvents.map(event => <PastCard key={event.id} title={event.title} description={event.description} cover={event.cover_image_path} date={event.starts_at} />)}
              </CardGrid>
            </SectionBlock>
          </section>
        )}

        {tab === "workshops" && (
          <section aria-labelledby="tab-workshops">
            <h2 id="tab-workshops" className="sr-only">Live workshops</h2>
            <SectionBlock title="Coming up" loading={loadingUW} empty={upcomingWorkshops.length === 0} emptyText="No workshops scheduled yet.">
              <CardGrid two>
                {upcomingWorkshops.map((w) => (
                  <WorkshopCard
                    key={w.id}
                    workshop={w}
                    registered={registeredWorkshopIds.has(w.id)}
                    isAuthenticated={isAuthenticated}
                    canJoin={hasWorkshopAccess}
                    onRegister={() => register.mutate({ target_type: "live_workshop", target_id: w.id })}
                    registering={register.isPending}
                  />
                ))}
              </CardGrid>
            </SectionBlock>

            <SectionBlock title="Past workshops" loading={loadingPW} empty={pastWorkshops.length === 0} emptyText="No past workshops yet." muted>
              <CardGrid two>
                {pastWorkshops.map(w => (
                  <PastCard
                    key={w.id}
                    title={w.title}
                    description={w.description}
                    cover={w.cover_image_path}
                    date={w.starts_at}
                    footer={hasWorkshopAccess && w.replay_url ? (
                      <a href={w.replay_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs mt-2 hover:underline" style={{ color: "var(--aa-accent)" }}>
                        <ExternalLink size={12} /> Watch replay
                      </a>
                    ) : null}
                  />
                ))}
              </CardGrid>
            </SectionBlock>
          </section>
        )}

        {tab === "calendar" && (
          <section aria-labelledby="tab-calendar">
            <h2 id="tab-calendar" className="sr-only">Calendar</h2>
            {loadingUE || loadingUW ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
                <Loader2 className="animate-spin" size={16} /> Loading calendar…
              </div>
            ) : (
              <EventsCalendarView entries={calendarEntries} />
            )}
          </section>
        )}

        <div className="flex items-center justify-between mt-12 pt-6 border-t" style={{ borderColor: "var(--aa-cream-dark)" }}>
          <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg border transition" style={{ borderColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)" }}>← Back</Link>
          <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg btn-gold transition">Exit</Link>
        </div>
      </div>
    </MemberLayout>
  );
}

/* ============================ Sub-components ============================ */

function countThisMonth(entries: CalendarEntry[]) {
  const now = new Date();
  return entries.filter(e => {
    const d = new Date(e.starts_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-lg px-4 py-3 border"
      style={{ backgroundColor: "var(--aa-white)", borderColor: "var(--aa-cream-dark)" }}
    >
      <p className="text-xs uppercase tracking-wide" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>{label}</p>
      <p className="font-serif text-2xl mt-0.5" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>{value}</p>
    </div>
  );
}

function SectionBlock({
  title, loading, empty, emptyText, muted, children,
}: { title: string; loading: boolean; empty: boolean; emptyText: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className={muted ? "opacity-90" : ""} style={{ marginBottom: "3rem" }}>
      <h3 className="font-serif text-xl md:text-2xl mb-4" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>{title}</h3>
      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}><Loader2 className="animate-spin" size={16} /> Loading…</div>
      ) : empty ? (
        <p className="text-sm" style={{ color: "var(--aa-text-mid)" }}>{emptyText}</p>
      ) : children}
    </div>
  );
}

function CardGrid({ children, two }: { children: React.ReactNode; two?: boolean }) {
  return (
    <div className={`grid grid-cols-1 gap-6 ${two ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
      {children}
    </div>
  );
}

function CalendarActions({ item }: { item: React.ComponentProps<typeof AddToCalendarButton>["item"] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
      <AddToCalendarButton item={item} />
      <IcsDownloadButton item={item} />
    </div>
  );
}

function AddToCalendarButton({ item }: { item: Parameters<typeof gcalRenderUrl>[0] }) {
  return (
    <a
      href={gcalRenderUrl(item)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 hover:underline"
      style={{ color: "var(--aa-accent)" }}
    >
      <CalendarPlus size={14} /> Add to Google Calendar
    </a>
  );
}

function IcsDownloadButton({ item }: { item: Parameters<typeof icsDataUrl>[0] }) {
  return (
    <a
      href={icsDataUrl(item)}
      download={icsFileName(item)}
      className="inline-flex items-center gap-1.5 hover:underline"
      style={{ color: "var(--aa-text-mid)" }}
    >
      <Download size={14} /> Download .ics
    </a>
  );
}

// deno-lint-ignore no-explicit-any
function EventCard({ event, registered, isAuthenticated, onRegister, registering }: {
  event: any;
  registered: boolean;
  isAuthenticated: boolean;
  onRegister: () => void;
  registering: boolean;
}) {
  const calendarItem = {
    id: event.id,
    kind: "event" as const,
    title: event.title,
    description: event.description,
    location: event.location,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    external_url: event.external_url,
  };
  return (
    <article className="rounded-lg border overflow-hidden flex flex-col transition hover:shadow-sm" style={{ backgroundColor: "var(--aa-white)", borderColor: "var(--aa-cream-dark)" }}>
      {event.cover_image_path && (
        <div
          className="aspect-[16/9] w-full"
          style={{ backgroundImage: `url('${event.cover_image_path}')`, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "var(--aa-cream-dark)" }}
          aria-hidden="true"
        />
      )}
      <div className="p-6 flex flex-col flex-1">
        <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 500 }}>{event.title}</h3>
        {event.description && (
          <p className="text-sm mb-4 line-clamp-3" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>{event.description}</p>
        )}
        <div className="space-y-2 border-t pt-3 mt-auto" style={{ borderColor: "var(--aa-cream-dark)" }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
            <Calendar size={14} style={{ color: "var(--aa-gold)" }} />
            <span>{fmtDate(event.starts_at)} · {fmtTime(event.starts_at)}{event.ends_at ? ` – ${fmtTime(event.ends_at)}` : ""}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
              <MapPin size={14} style={{ color: "var(--aa-gold)" }} />
              <span className="truncate">{event.location}</span>
            </div>
          )}
          {event.external_url && (
            <a href={event.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm hover:underline" style={{ color: "var(--aa-accent)" }}>
              <ExternalLink size={14} /> More info
            </a>
          )}
          <CalendarActions item={calendarItem} />
        </div>
        <button
          className="w-full mt-4 px-4 py-2 rounded-md transition text-sm font-medium disabled:opacity-60"
          style={{ backgroundColor: registered ? "var(--aa-cream-dark)" : "var(--aa-olive-dark)", color: registered ? "var(--aa-olive-dark)" : "var(--aa-white)" }}
          disabled={registered || registering || !isAuthenticated}
          onClick={onRegister}
        >
          {!isAuthenticated
            ? (<><Lock size={12} className="inline mr-1" />Sign in to register</>)
            : registered
              ? (<><CheckCircle2 size={14} className="inline mr-1" />You’re in</>)
              : registering ? "Registering…" : "Participate"}
        </button>
        {registered && (
          <p className="text-xs mt-2" style={{ color: "var(--aa-text-light)" }}>
            You’re registered. Add this event to your calendar manually — automatic sync is coming soon.
          </p>
        )}
      </div>
    </article>
  );
}

// deno-lint-ignore no-explicit-any
function WorkshopCard({ workshop, registered, isAuthenticated, canJoin, onRegister, registering }: {
  workshop: any;
  registered: boolean;
  isAuthenticated: boolean;
  canJoin: boolean;
  onRegister: () => void;
  registering: boolean;
}) {
  const calendarItem = {
    id: workshop.id,
    kind: "workshop" as const,
    title: workshop.title,
    description: workshop.description,
    starts_at: workshop.starts_at,
    ends_at: workshop.ends_at,
    meeting_url: workshop.meeting_url,
  };
  return (
    <article className="rounded-lg overflow-hidden border" style={{ backgroundColor: "var(--aa-white)", borderColor: "var(--aa-cream-dark)" }}>
      {workshop.cover_image_path && (
        <div
          className="aspect-[16/9] w-full"
          style={{ backgroundImage: `url('${workshop.cover_image_path}')`, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "var(--aa-cream-dark)" }}
          aria-hidden="true"
        />
      )}
      <div className="p-6">
        <div className="mb-3 flex items-center gap-3 text-sm" style={{ color: "var(--aa-text-mid)" }}>
          <span className="inline-flex items-center gap-1.5"><Calendar size={14} style={{ color: "var(--aa-gold)" }} />{fmtDate(workshop.starts_at)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={14} style={{ color: "var(--aa-gold)" }} />{fmtTime(workshop.starts_at)}{workshop.ends_at ? ` – ${fmtTime(workshop.ends_at)}` : ""}</span>
        </div>
        <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 500 }}>{workshop.title}</h3>
        {workshop.description && <p className="text-sm mb-4 line-clamp-3" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>{workshop.description}</p>}
        <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--aa-cream-dark)" }}>
          {canJoin && workshop.meeting_url && (
            <a href={workshop.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm hover:underline" style={{ color: "var(--aa-accent)" }}>
              <Video size={14} /> Join link
            </a>
          )}
          <CalendarActions item={calendarItem} />
        </div>
        <button
          className="w-full mt-4 px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-60"
          style={{ backgroundColor: registered ? "var(--aa-cream-dark)" : "var(--aa-gold)", color: registered ? "var(--aa-olive-dark)" : "var(--aa-text-dark)" }}
          disabled={registered || registering || !isAuthenticated}
          onClick={onRegister}
        >
          {!isAuthenticated
            ? (<><Lock size={12} className="inline mr-1" />Sign in to register</>)
            : registered
              ? (<><CheckCircle2 size={14} className="inline mr-1" />You’re in</>)
              : registering ? "Registering…" : "Participate"}
        </button>
      </div>
    </article>
  );
}

function PastCard({ title, description, cover, date, footer }: {
  title: string;
  description?: string | null;
  cover?: string | null;
  date: string;
  footer?: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border overflow-hidden opacity-90" style={{ backgroundColor: "var(--aa-white)", borderColor: "var(--aa-cream-dark)" }}>
      {cover && (
        <div
          className="aspect-[16/9] w-full"
          style={{ backgroundImage: `url('${cover}')`, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "var(--aa-cream-dark)" }}
          aria-hidden="true"
        />
      )}
      <div className="p-6">
        <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>{title}</h3>
        {description && <p className="text-sm mb-3 line-clamp-2" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>{description}</p>}
        <div className="flex items-center gap-2 text-sm border-t pt-3" style={{ color: "var(--aa-text-light)", borderColor: "var(--aa-cream-dark)" }}>
          <Calendar size={14} style={{ color: "var(--aa-gold)" }} />
          <span>{fmtDate(date)}</span>
        </div>
        {footer}
      </div>
    </article>
  );
}
