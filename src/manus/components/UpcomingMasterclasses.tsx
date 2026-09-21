import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAssetUrl } from "@/manus/lib/asset-url";

type PublicWorkshop = {
  id: number;
  slug: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_image_path: string | null;
};

/** Never show dashes in member facing copy. */
function noDashes(text: string): string {
  return text.replace(/ [-–—] /g, ": ");
}

/** "Tuesday 6 October, 7:00pm Sydney time" */
function formatSydney(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .replace(/\s?(AM|PM|am|pm)$/i, (m) => m.trim().toLowerCase());
  return `${day}, ${time} Sydney time`;
}

export default function UpcomingMasterclasses({
  buyingOpen,
  onJoin,
}: {
  buyingOpen: boolean;
  onJoin: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  const { data } = useQuery({
    queryKey: ["public", "upcoming_masterclasses"],
    queryFn: async (): Promise<PublicWorkshop[]> => {
      const { data, error } = await supabase.rpc("get_public_upcoming_workshops" as never);
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: Number(r.id),
        slug: (r.slug as string | null) ?? null,
        title: String(r.title ?? ""),
        description: (r.description as string | null) ?? null,
        starts_at: String(r.starts_at),
        ends_at: (r.ends_at as string | null) ?? null,
        cover_image_path: (r.cover_image_path as string | null) ?? null,
      }));
    },
  });

  const items = data ?? [];

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 8);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [items.length]);

  if (items.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? el.clientWidth * 0.85) + 24), behavior: "smooth" });
  };

  return (
    <section id="masterclasses" style={{ backgroundColor: "var(--aa-muted-surface)", padding: "6rem 0" }}>
      <style>{`
        .mc-row { scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; }
        .mc-row::-webkit-scrollbar { display: none; }
        .mc-clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
      <div className="container">
        <div className="max-w-2xl mb-10">
          <p className="section-label mb-4">Live and interactive</p>
          <h2 className="font-serif text-4xl md:text-5xl mb-5" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Upcoming Expert Masterclasses
          </h2>
          <p style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontSize: "1rem" }}>
            Sit down live with the experts behind the design decisions. Bring your questions and ask them directly.
            Included with Annual and Monthly membership.
          </p>
        </div>

        <div className="relative">
          {canScroll && (
            <>
              <button
                type="button"
                aria-label="Previous masterclasses"
                onClick={() => scrollBy(-1)}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 items-center justify-center rounded-full"
                style={{ width: 44, height: 44, background: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)", color: "var(--aa-olive-dark)" }}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                aria-label="Next masterclasses"
                onClick={() => scrollBy(1)}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 items-center justify-center rounded-full"
                style={{ width: 44, height: 44, background: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)", color: "var(--aa-olive-dark)" }}
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          <div ref={scroller} className="mc-row flex gap-6 overflow-x-auto snap-x snap-mandatory pb-2">
            {items.map((w) => {
              const cover = resolveAssetUrl(w.cover_image_path);
              return (
                <article
                  key={w.id}
                  data-card
                  className="snap-start shrink-0 w-[85%] md:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] flex flex-col"
                  style={{ background: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}
                >
                  {cover ? (
                    <img src={cover} alt={noDashes(w.title)} className="w-full h-auto" loading="lazy" />
                  ) : (
                    <div style={{ width: "100%", aspectRatio: "3 / 2", background: "var(--aa-cream-dark)" }} />
                  )}
                  <div className="p-6 flex flex-col gap-3 flex-1">
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--aa-gold)", fontWeight: 600 }}>
                      {formatSydney(w.starts_at)}
                    </p>
                    <h3 className="font-serif text-2xl" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
                      {noDashes(w.title)}
                    </h3>
                    {w.description && (
                      <p className="mc-clamp" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", color: "var(--aa-text-mid)" }}>
                        {noDashes(w.description)}
                      </p>
                    )}
                    <span
                      className="self-start"
                      style={{ display: "inline-flex", padding: "0.25rem 0.7rem", borderRadius: 999, background: "var(--aa-cream)", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}
                    >
                      Included with membership
                    </span>
                    <div className="mt-auto pt-4">
                      {buyingOpen ? (
                        <button type="button" onClick={onJoin} className="cta-btn">
                          Join to attend
                        </button>
                      ) : (
                        <a href="#offers" className="cta-btn">
                          See plans
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
