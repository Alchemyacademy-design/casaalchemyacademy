import MemberLayout from "@/manus/components/MemberLayout";
import { Calendar, MapPin, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";
import { useUpcomingEvents, usePastEvents, useMyRegistrations, useRegisterForTarget } from "@/manus/hooks/usePublicContent";
import { useAuth } from "@/manus/hooks/useAuth";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function Events() {
  const { isAuthenticated } = useAuth();
  const { data: upcoming = [], isLoading: loadingUp } = useUpcomingEvents();
  const { data: past = [], isLoading: loadingPast } = usePastEvents(6);
  const { data: regs = [] } = useMyRegistrations();
  const register = useRegisterForTarget();

  const registeredIds = new Set(regs.filter(r => r.event_id != null).map(r => r.event_id as number));

  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        <div className="mb-10">
          <p className="section-label mb-2">Community</p>
          <h1 className="font-serif text-3xl md:text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>Events</h1>
          <p className="text-sm max-w-xl" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            Join our community events to connect with other members and deepen your design knowledge.
          </p>
        </div>

        <div className="mb-12">
          <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>Upcoming Events</h2>
          {loadingUp ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}><Loader2 className="animate-spin" size={16} /> Loading…</div>
          ) : upcoming.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--aa-text-mid)" }}>No upcoming events yet. Check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcoming.map((event) => {
                const isRegistered = registeredIds.has(event.id);
                return (
                  <div key={event.id} className="p-6 rounded-lg border border-border/50 hover:border-border transition" style={{ backgroundColor: "white" }}>
                    <div className="mb-4">
                      <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)" }}>{event.title}</h3>
                      {event.description && (
                        <p className="text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>{event.description}</p>
                      )}
                    </div>
                    <div className="space-y-3 border-t border-border/30 pt-4">
                      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
                        <Calendar size={16} style={{ color: "var(--aa-accent)" }} />
                        <span>{fmtDate(event.starts_at)} · {fmtTime(event.starts_at)}{event.ends_at ? ` – ${fmtTime(event.ends_at)}` : ""}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}>
                          <MapPin size={16} style={{ color: "var(--aa-accent)" }} />
                          <span>{event.location}</span>
                        </div>
                      )}
                      {event.external_url && (
                        <a href={event.external_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:underline" style={{ color: "var(--aa-accent)" }}>
                          <ExternalLink size={16} /> <span>More info</span>
                        </a>
                      )}
                    </div>
                    <button
                      className="w-full mt-4 px-4 py-2 rounded-lg transition text-sm font-medium disabled:opacity-60"
                      style={{ backgroundColor: isRegistered ? "var(--aa-text-light)" : "var(--aa-olive-dark)", color: "white" }}
                      disabled={isRegistered || register.isPending || !isAuthenticated}
                      onClick={() => register.mutate({ target_type: "event", target_id: event.id })}
                    >
                      {!isAuthenticated ? "Sign in to register" : isRegistered ? (<><CheckCircle2 size={14} className="inline mr-1" />Registered</>) : register.isPending ? "Registering…" : "Register"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>Past Events</h2>
          {loadingPast ? (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}><Loader2 className="animate-spin" size={16} /> Loading…</div>
          ) : past.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--aa-text-mid)" }}>No past events to show.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {past.map((event) => (
                <div key={event.id} className="p-6 rounded-lg border border-border/50 opacity-75" style={{ backgroundColor: "white" }}>
                  <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)" }}>{event.title}</h3>
                  {event.description && (
                    <p className="text-sm mb-4" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>{event.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm border-t border-border/30 pt-4" style={{ color: "var(--aa-text-mid)" }}>
                    <Calendar size={16} style={{ color: "var(--aa-accent)" }} />
                    <span>{fmtDate(event.starts_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-12 pt-6 border-t border-border/50">
        <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-card transition">← Back</a>
        <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg btn-gold transition">Exit</a>
      </div>
    </MemberLayout>
  );
}
