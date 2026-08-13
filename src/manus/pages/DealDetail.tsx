import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, CalendarCheck, CreditCard, FileText, ExternalLink } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import { useActiveDeals } from "@/manus/hooks/usePublicContent";
import { useTrackDealClick } from "@/manus/hooks/useTrackDealClick";
import { resolveAssetUrl } from "@/manus/lib/asset-url";

const SCHEDULING_URL = "https://calendly.com/contact-casaalchemystudio/30min";

const TERMS = [
  "This is a paid one-to-one consultation delivered online by Lorena Couto via Casa Alchemy Studio.",
  "The member rate applies to Alchemy Academy annual members only. Bookings made on a non-eligible plan may be cancelled.",
  "Payment is processed securely by Stripe and is required before the session can be scheduled.",
  "Rescheduling is available up to 24 hours before the session. No-shows and late cancellations are non-refundable.",
  "Advice provided is guidance only; final decisions and any works remain the client's responsibility.",
];

export default function DealDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: deals = [], isLoading } = useActiveDeals();
  const trackClick = useTrackDealClick();
  const deal = useMemo(() => deals.find((d) => d.slug === slug), [deals, slug]);

  const storageKey = `deal-flow:${slug}`;
  const [step, setStep] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const saved = Number(window.localStorage.getItem(storageKey));
    return saved >= 1 && saved <= 3 ? saved : 1;
  });
  const [accepted, setAccepted] = useState(false);

  const goTo = (next: number) => {
    setStep(next);
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, String(next));
  };

  if (isLoading) {
    return (
      <MemberLayout>
        <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
          <p className="text-sm" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
        </div>
      </MemberLayout>
    );
  }

  if (!deal) {
    return (
      <MemberLayout>
        <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
          <p className="text-sm mb-4" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
            This product is no longer available.
          </p>
          <Link to="/deals" className="text-xs" style={{ color: "var(--aa-gold)" }}>← Back to deals</Link>
        </div>
      </MemberLayout>
    );
  }

  const cover = resolveAssetUrl((deal as { cover_image_path?: string | null }).cover_image_path);
  const priceLabel = (deal as { price_label?: string | null }).price_label;

  const steps = [
    { n: 1, label: "Terms & conditions", icon: FileText },
    { n: 2, label: "Payment", icon: CreditCard },
    { n: 3, label: "Scheduling", icon: CalendarCheck },
  ];

  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        <Link to="/deals" className="text-xs" style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif" }}>
          ← Back to deals
        </Link>

        <div className="mt-4 mb-8">
          <p className="section-label mb-2">Members Only · Product</p>
          <h1 className="font-serif text-3xl md:text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            {deal.title}
          </h1>
          {deal.description && (
            <p className="text-sm max-w-2xl leading-relaxed" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
              {deal.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8 items-start">
          <div
            className="group overflow-hidden rounded-xl border transition duration-300 hover:-translate-y-1 hover:shadow-float"
            style={{ backgroundColor: "var(--aa-white)", borderColor: "var(--aa-cream-dark)" }}
          >
            {cover && (
              <div className="relative min-h-[190px] overflow-hidden bg-primary">
                <div
                  className="absolute inset-0 scale-[1.01] bg-cover bg-center transition duration-500 group-hover:scale-[1.045]"
                  style={{ backgroundImage: `url(${cover})` }}
                  aria-hidden="true"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/15 to-transparent" aria-hidden="true" />
                <div className="relative z-10 flex min-h-[190px] items-end p-5">
                  {priceLabel ? (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">{priceLabel}</span>
                  ) : null}
                </div>
              </div>
            )}
            <div className="p-5 space-y-3">
              {steps.map((s) => {
                const done = step > s.n;
                const active = step === s.n;
                const Icon = s.icon;
                return (
                  <div key={s.n} className="flex items-center gap-3">
                    <span
                      className="flex items-center justify-center w-7 h-7 rounded-full text-[11px]"
                      style={{
                        backgroundColor: done || active ? "var(--aa-gold)" : "var(--aa-cream-dark)",
                        color: done || active ? "#fff" : "var(--aa-text-light)",
                      }}
                    >
                      {done ? <Check size={14} /> : <Icon size={14} />}
                    </span>
                    <span
                      className="text-xs"
                      style={{
                        color: active ? "var(--aa-olive-dark)" : "var(--aa-text-light)",
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: active ? 500 : 300,
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-6 md:p-8" style={{ backgroundColor: "var(--aa-white)", border: "1px solid var(--aa-cream-dark)" }}>
            {step === 1 && (
              <>
                <h2 className="font-serif text-xl mb-4" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                  Terms & conditions
                </h2>
                <ul className="space-y-3 mb-6">
                  {TERMS.map((t) => (
                    <li key={t} className="text-xs leading-relaxed flex gap-2" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                      <span style={{ color: "var(--aa-gold)" }}>•</span>
                      {t}
                    </li>
                  ))}
                </ul>
                <label className="flex items-start gap-3 mb-6 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-[3px]"
                  />
                  <span className="text-xs" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
                    I have read and accept the terms and conditions above.
                  </span>
                </label>
                <button
                  type="button"
                  disabled={!accepted}
                  onClick={() => goTo(2)}
                  className="px-6 py-3 text-xs uppercase tracking-widest btn-gold disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                >
                  Continue to payment
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="font-serif text-xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                  Payment
                </h2>
                <p className="text-xs mb-6 leading-relaxed" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                  Complete your secure payment with Stripe in the new tab. When it is done, come back here to choose your session time.
                </p>
                <div className="flex flex-wrap gap-3">
                  {deal.external_url && (
                    <a
                      href={deal.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackClick.mutate(deal.id)}
                      className="inline-flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-widest btn-gold"
                      style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                    >
                      Pay securely <ExternalLink size={12} />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => goTo(3)}
                    className="px-6 py-3 text-xs uppercase tracking-widest"
                    style={{ border: "1px solid var(--aa-cream-dark)", color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif" }}
                  >
                    I've completed payment
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => goTo(1)}
                  className="mt-6 text-[11px]"
                  style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}
                >
                  ← Back to terms
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="font-serif text-xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>
                  Schedule your session
                </h2>
                <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                  Pick the time that suits you best. You will receive a confirmation email with the meeting link.
                </p>
                <div style={{ border: "1px solid var(--aa-cream-dark)" }}>
                  <iframe
                    title="Schedule your Casa Consult"
                    src={`${SCHEDULING_URL}?hide_gdpr_banner=1`}
                    className="w-full"
                    style={{ height: 760, border: 0 }}
                  />
                </div>
                <a
                  href={SCHEDULING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 text-xs"
                  style={{ color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                >
                  Open scheduling in a new tab <ExternalLink size={12} />
                </a>
                <button
                  type="button"
                  onClick={() => goTo(2)}
                  className="block mt-6 text-[11px]"
                  style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}
                >
                  ← Back to payment
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </MemberLayout>
  );
}
