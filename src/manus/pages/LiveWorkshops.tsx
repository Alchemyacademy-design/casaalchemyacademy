import MemberLayout from "@/manus/components/MemberLayout";
import { Link } from "react-router-dom";
import { Calendar, Clock, ExternalLink, Loader2, Lock, CheckCircle2 } from "lucide-react";
import { useUpcomingWorkshops, usePastWorkshops, useMyRegistrations, useRegisterForTarget } from "@/manus/hooks/usePublicContent";
import { useAuth } from "@/manus/hooks/useAuth";
import { useEntitlements } from "@/manus/hooks/useEntitlements";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Member-facing status pill, mirroring the shape of the admin StatusBadge but
 * in the warm cream/gold palette used across the member area.
 */
function StatusPill({ status }: { status: "available" | "coming_soon" }) {
  const available = status === "available";
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-medium tracking-wide uppercase"
      style={{
        backgroundColor: available ? "var(--aa-gold)" : "var(--aa-cream)",
        borderColor: available ? "var(--aa-gold)" : "var(--aa-cream-dark)",
        color: available ? "var(--aa-cacao, var(--aa-text-dark))" : "var(--aa-text-mid)",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {available ? "Available" : "Coming Soon"}
    </span>
  );
}

/** Thumbnail with the status pill anchored in the top-right corner. */
function Thumb({ src, status, dim }: { src?: string | null; status: "available" | "coming_soon"; dim?: boolean }) {
  return (
    <div className="relative">
      <div
        className={`aspect-[16/9] w-full ${dim ? "opacity-80" : ""}`}
        style={{
          backgroundImage: src ? `url('${src}')` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "var(--aa-cream-dark)",
        }}
        aria-hidden="true"
      />
      <div className="absolute top-3 right-3">
        <StatusPill status={status} />
      </div>
    </div>
  );
}

export default function LiveWorkshops() {
  const { isAuthenticated } = useAuth();
  // Live workshops are annual-tier only (or admin). Do not fall back to the
  // flat isMember check — monthly members must not see join/replay links.
  const { hasWorkshops: hasAccess } = useEntitlements();
  const { data: upcoming = [], isLoading: loadingUp } = useUpcomingWorkshops();
  const { data: past = [], isLoading: loadingPast } = usePastWorkshops(6);
  const { data: regs = [] } = useMyRegistrations();
  const register = useRegisterForTarget();
  const registered = new Set(regs.filter(r => r.live_workshop_id != null).map(r => r.live_workshop_id as number));

  return (
    <MemberLayout>
      <div className="p-6 md:p-10 min-h-screen" style={{ backgroundColor: "var(--aa-cream)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h1 className="font-serif text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>Expert Masterclasses</h1>
            <p className="text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>Join our expert-led workshops and connect with fellow Alchemists.</p>
          </div>

          <div className="mb-12">
            <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>Coming Up</h2>
            {loadingUp ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}><Loader2 className="animate-spin" size={16} /> Loading…</div>
            ) : upcoming.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--aa-text-mid)" }}>No workshops scheduled yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {upcoming.map((w) => {
                  const isReg = registered.has(w.id);
                  return (
                    <div key={w.id} className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
                      {/* Upcoming sessions have not happened yet — always "Coming Soon". */}
                      <Thumb src={w.cover_image_path} status="coming_soon" />
                      <div className="p-6">
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar size={16} style={{ color: "var(--aa-gold)" }} />
                            <span className="text-sm" style={{ color: "var(--aa-text-light)" }}>{fmtDate(w.starts_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={16} style={{ color: "var(--aa-gold)" }} />
                            <span className="text-sm" style={{ color: "var(--aa-text-light)" }}>{fmtTime(w.starts_at)}{w.ends_at ? ` – ${fmtTime(w.ends_at)}` : ""}</span>
                          </div>
                        </div>
                        <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>{w.title}</h3>
                        {w.description && <p className="text-xs mb-4" style={{ color: "var(--aa-text-mid)" }}>{w.description}</p>}
                        {hasAccess && w.meeting_url && (
                          <a href={w.meeting_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs mb-3" style={{ color: "var(--aa-accent)" }}>
                            <ExternalLink size={12} /> Join link
                          </a>
                        )}
                        <button
                          className="w-full px-4 py-2 rounded text-sm font-medium transition disabled:opacity-60"
                          style={{ backgroundColor: isReg ? "var(--aa-cream-dark)" : "var(--aa-gold)", color: "var(--aa-cacao)" }}
                          disabled={isReg || register.isPending || !isAuthenticated}
                          onClick={() => register.mutate({ target_type: "live_workshop", target_id: w.id })}
                        >
                          {!isAuthenticated ? (<><Lock size={12} className="inline mr-1" />Sign in to register</>) : isReg ? (<><CheckCircle2 size={12} className="inline mr-1" />Registered</>) : register.isPending ? "Registering…" : "Register"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mb-12">
            <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>Past Workshops</h2>
            {loadingPast ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}><Loader2 className="animate-spin" size={16} /> Loading…</div>
            ) : past.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--aa-text-mid)" }}>No past workshops yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {past.map((w) => {
                  // A past workshop is watchable only once the recording is in
                  // place and the member's plan includes workshops.
                  const watchable = Boolean(hasAccess && w.replay_url);
                  const cardStyle = { backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" };
                  const body = (
                    <>
                      <Thumb src={w.cover_image_path} status={watchable ? "available" : "coming_soon"} dim />
                      <div className="p-6">
                        <h3 className="font-serif text-lg mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>{w.title}</h3>
                        <p className="text-xs mb-2" style={{ color: "var(--aa-text-light)" }}>{fmtDate(w.starts_at)}</p>
                        {watchable ? (
                          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--aa-accent)" }}>
                            <ExternalLink size={12} /> Watch replay
                          </span>
                        ) : (
                          <p className="text-xs" style={{ color: "var(--aa-text-light)" }}>Recording coming soon.</p>
                        )}
                      </div>
                    </>
                  );

                  // Available replays: the whole card is the link.
                  return watchable ? (
                    <a
                      key={w.id}
                      href={w.replay_url as string}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg overflow-hidden transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2"
                      style={cardStyle}
                    >
                      {body}
                    </a>
                  ) : (
                    <div key={w.id} className="rounded-lg overflow-hidden" style={cardStyle}>
                      {body}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-4 justify-between mt-12 pt-6 border-t" style={{ borderColor: "var(--aa-cream-dark)" }}>
            <Link to="/dashboard" className="px-6 py-2 rounded text-sm font-medium" style={{ backgroundColor: "var(--aa-cream-dark)", color: "var(--aa-text-dark)" }}>← Back</Link>
            <Link to="/dashboard" className="px-6 py-2 rounded text-sm font-medium" style={{ backgroundColor: "var(--aa-olive-dark)", color: "var(--aa-white)" }}>Exit</Link>
          </div>
        </div>
      </div>
    </MemberLayout>
  );
}
