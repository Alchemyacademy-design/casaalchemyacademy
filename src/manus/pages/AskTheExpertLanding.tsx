// Public, unauthenticated lead-capture landing for the "Ask the Expert LIVE"
// workshops. Deliberately outside MemberLayout and outside the member
// registration flow: visitors leave their details, the private meeting link is
// never rendered here (it is emailed closer to the session).
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarPlus, Download, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { gcalRenderUrl, icsDataUrl, icsFileName, type CalendarItem } from "@/lib/calendar-links";

type PublicWorkshop = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_image_path: string | null;
};

function formatWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const end = endsAt
    ? new Date(endsAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : null;
  return `${date} · ${time}${end ? `–${end}` : ""}`;
}

export default function AskTheExpertLanding() {
  const { slug = "" } = useParams();
  const [workshop, setWorkshop] = useState<PublicWorkshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc("get_public_workshop", { p_slug: slug });
      if (!active) return;
      if (rpcError) console.error("get_public_workshop failed:", rpcError);
      const row = Array.isArray(data) ? (data[0] as PublicWorkshop | undefined) : null;
      setWorkshop(row ?? null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!workshop) return;
    document.title = `${workshop.title} — Save your seat | Alchemy Academy`;
  }, [workshop]);

  const calendarItem = useMemo<CalendarItem | null>(() => {
    if (!workshop) return null;
    return {
      id: workshop.id,
      kind: "workshop",
      title: workshop.title,
      description: workshop.description,
      starts_at: workshop.starts_at,
      ends_at: workshop.ends_at,
      // Meeting link intentionally omitted — it is private and emailed later.
      meeting_url: null,
    };
  }, [workshop]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workshop || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("capture-lead", {
        body: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          source: "live_workshop",
          website,
          metadata: {
            workshop_id: workshop.id,
            workshop_slug: workshop.slug,
            placement: "ask_the_expert_landing",
            page_uri: window.location.href,
          },
        },
      });
      if (fnError) throw fnError;
      if (data && (data as { error?: string }).error) {
        throw new Error((data as { error?: string }).error);
      }
      setConfirmed(true);
    } catch (err) {
      console.error("capture-lead failed:", err);
      setError("We couldn't save your seat just now. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--aa-cream)" }}>
        <Loader2 className="animate-spin" size={22} style={{ color: "var(--aa-gold)" }} />
      </main>
    );
  }

  if (!workshop) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ backgroundColor: "var(--aa-cream)" }}
      >
        <h1 className="font-serif text-2xl" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
          This session isn't available
        </h1>
        <p className="text-sm" style={{ color: "var(--aa-text-mid)" }}>
          The link may have expired. Explore the Academy to see what's coming next.
        </p>
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.14em]"
          style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
        >
          Back to Alchemy Academy
        </Link>
      </main>
    );
  }

  const when = formatWhen(workshop.starts_at, workshop.ends_at);

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 sm:py-16" style={{ backgroundColor: "var(--aa-cream)" }}>
      <div className="mx-auto w-full max-w-3xl">
        <article
          className="overflow-hidden rounded-xl border"
          style={{ backgroundColor: "var(--aa-white)", borderColor: "var(--aa-cream-dark)" }}
        >
          {workshop.cover_image_path && (
            <div className="relative min-h-[200px] overflow-hidden bg-primary sm:min-h-[280px]">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${workshop.cover_image_path})` }}
                aria-hidden="true"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/15 to-transparent" aria-hidden="true" />
              <div className="relative z-10 flex min-h-[200px] items-end p-5 sm:min-h-[280px] sm:p-7">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
                  Ask the Expert LIVE
                </span>
              </div>
            </div>
          )}

          <div className="p-6 sm:p-9">
            <h1
              className="font-serif text-2xl leading-snug sm:text-3xl"
              style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}
            >
              {workshop.title}
            </h1>
            <p
              className="mt-2 text-xs uppercase tracking-[0.12em]"
              style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
            >
              {when}
            </p>
            {workshop.description && (
              <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed" style={{ color: "var(--aa-text-mid)" }}>
                {workshop.description}
              </p>
            )}

            <hr className="my-8" style={{ border: "none", borderTop: "1px solid var(--aa-cream-dark)" }} />

            {confirmed ? (
              <div>
                <p className="flex items-center gap-2 font-serif text-xl" style={{ color: "var(--aa-olive-dark)" }}>
                  <CheckCircle2 size={20} style={{ color: "var(--aa-gold)" }} /> You're in!
                </p>
                <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--aa-text-mid)" }}>
                  Your seat for <strong>{workshop.title}</strong> on {when} is confirmed. We've emailed your
                  confirmation — the private class link will be sent by email closer to the session.
                </p>
                {calendarItem && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={gcalRenderUrl(calendarItem)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-md px-5 py-3 text-xs uppercase tracking-[0.1em]"
                      style={{ backgroundColor: "var(--aa-olive-dark)", color: "var(--aa-cream)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
                    >
                      <CalendarPlus size={14} /> Add to Google Calendar
                    </a>
                    <a
                      href={icsDataUrl(calendarItem)}
                      download={icsFileName(calendarItem)}
                      className="inline-flex items-center gap-2 rounded-md border px-5 py-3 text-xs uppercase tracking-[0.1em]"
                      style={{ borderColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
                    >
                      <Download size={14} /> Download .ics
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <h2 className="font-serif text-xl" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                  Save your seat
                </h2>
                <p className="text-sm" style={{ color: "var(--aa-text-mid)" }}>
                  Free to attend. Leave your details and we'll email your confirmation — the private class link
                  follows closer to the date.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs uppercase tracking-[0.1em]" style={{ color: "var(--aa-text-light)" }}>
                    Name
                    <input
                      type="text"
                      required
                      maxLength={200}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm normal-case tracking-normal"
                      style={{ borderColor: "var(--aa-cream-dark)", color: "var(--aa-text-dark)", backgroundColor: "var(--aa-white)" }}
                    />
                  </label>
                  <label className="block text-xs uppercase tracking-[0.1em]" style={{ color: "var(--aa-text-light)" }}>
                    Phone
                    <input
                      type="tel"
                      required
                      minLength={4}
                      maxLength={40}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm normal-case tracking-normal"
                      style={{ borderColor: "var(--aa-cream-dark)", color: "var(--aa-text-dark)", backgroundColor: "var(--aa-white)" }}
                    />
                  </label>
                </div>
                <label className="block text-xs uppercase tracking-[0.1em]" style={{ color: "var(--aa-text-light)" }}>
                  Email
                  <input
                    type="email"
                    required
                    maxLength={320}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm normal-case tracking-normal"
                    style={{ borderColor: "var(--aa-cream-dark)", color: "var(--aa-text-dark)", backgroundColor: "var(--aa-white)" }}
                  />
                </label>

                {/* Honeypot — hidden from humans. */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                />

                {error && <p className="text-sm" style={{ color: "hsl(var(--destructive))" }}>{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md px-6 py-3 text-xs uppercase tracking-[0.12em] disabled:opacity-60"
                  style={{ backgroundColor: "var(--aa-gold)", color: "#fff", fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Saving your seat…" : "Save your seat"}
                </button>
              </form>
            )}
          </div>
        </article>

        <p className="mt-6 text-center text-xs" style={{ color: "var(--aa-text-light)" }}>
          <Link to="/" style={{ color: "var(--aa-gold)" }}>Casa Alchemy Academy</Link> · The private class link is
          never published — we email it only to registered guests.
        </p>
      </div>
    </main>
  );
}