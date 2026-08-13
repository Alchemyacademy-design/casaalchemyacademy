import MemberLayout from "@/manus/components/MemberLayout";
import { Link } from "react-router-dom";
import { ExternalLink, Sparkles, Clock, ArrowRight } from "lucide-react";
import { useActiveDeals } from "@/manus/hooks/usePublicContent";
import { useTrackDealClick } from "@/manus/hooks/useTrackDealClick";
import { resolveAssetUrl } from "@/manus/lib/asset-url";

export default function Deals() {
  const { data: deals = [], isLoading } = useActiveDeals();
  const trackClick = useTrackDealClick();
  const now = Date.now();

  const active = deals.filter((d) => {
    if (d.ends_at && new Date(d.ends_at).getTime() < now) return false;
    if (d.starts_at && new Date(d.starts_at).getTime() > now) return false;
    return true;
  });

  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        <div className="mb-10">
          <p className="section-label mb-2">Members Only</p>
          <h1
            className="font-serif text-3xl md:text-4xl mb-3"
            style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}
          >
            Exclusive Deals
          </h1>
          <p
            className="text-sm max-w-xl"
            style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}
          >
            Handpicked partner discounts, previews, and limited-time offers reserved for Alchemy Academy members.
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
            Loading exclusive offers…
          </p>
        ) : active.length === 0 ? (
          <div
            className="text-center py-16"
            style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}
          >
            <Sparkles size={28} className="mx-auto mb-3" style={{ color: "var(--aa-gold)" }} />
            <p style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
              No active deals right now. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {active.map((deal) => {
              const cover = resolveAssetUrl((deal as { cover_image_path?: string | null }).cover_image_path);
              const priceLabel = (deal as { price_label?: string | null }).price_label;
              return (
              <article
                key={deal.id}
                className="group relative flex h-full flex-col overflow-hidden rounded-xl border transition duration-300 hover:-translate-y-1 hover:shadow-float"
                style={{ backgroundColor: "var(--aa-white)", borderColor: "var(--aa-cream-dark)" }}
              >
                <div className="relative min-h-[190px] overflow-hidden bg-primary">
                  {cover ? (
                    <div
                      className="absolute inset-0 scale-[1.01] bg-cover bg-center transition duration-500 group-hover:scale-[1.045]"
                      style={{ backgroundImage: `url(${cover})` }}
                      aria-hidden="true"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(circle at 75% 20%, hsl(var(--accent) / .52), transparent 38%), linear-gradient(135deg, hsl(var(--primary)), hsl(20 63% 11%))",
                      }}
                      aria-hidden="true"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/15 to-transparent" aria-hidden="true" />
                  <div className="relative z-10 flex min-h-[190px] items-end p-5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                      Members only
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} style={{ color: "var(--aa-gold)" }} />
                  <span
                    className="text-[10px] uppercase tracking-widest"
                    style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                  >
                    Exclusive Offer
                  </span>
                </div>
                <h3
                  className="font-serif text-lg mb-1"
                  style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}
                >
                  {deal.title}
                </h3>
                {priceLabel && (
                  <p
                    className="mb-3 text-xs"
                    style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: ".04em" }}
                  >
                    {priceLabel}
                  </p>
                )}
                {deal.description && (
                  <p
                    className="text-xs mb-4 leading-relaxed"
                    style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}
                  >
                    {deal.description}
                  </p>
                )}
                {deal.ends_at && (
                  <p
                    className="text-[11px] mb-3 inline-flex items-center gap-1"
                    style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <Clock size={11} /> Ends {new Date(deal.ends_at).toLocaleDateString()}
                  </p>
                )}
                {deal.slug ? (
                  <Link
                    to={`/deals/${deal.slug}`}
                    className="mt-auto flex items-center gap-2 text-xs"
                    style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                  >
                    Book Now <ArrowRight size={12} />
                  </Link>
                ) : deal.external_url ? (
                  <a
                    href={deal.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackClick.mutate(deal.id)}
                    className="mt-auto flex items-center gap-2 text-xs"
                    style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                  >
                    Redeem offer <ExternalLink size={12} />
                  </a>
                ) : null}
                </div>
              </article>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between mt-12 pt-6 border-t border-border/50">
          <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-card transition">
            ← Back
          </Link>
          <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg btn-gold transition">
            Exit
          </Link>
        </div>
      </div>
    </MemberLayout>
  );
}
