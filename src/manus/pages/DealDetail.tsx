import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Check, CalendarCheck, CreditCard, FileText, ExternalLink } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import { useActiveDeals } from "@/manus/hooks/usePublicContent";
import { useTrackDealClick } from "@/manus/hooks/useTrackDealClick";
import { resolveAssetUrl } from "@/manus/lib/asset-url";
import { useAuth } from "@/manus/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const SCHEDULING_URL = "https://calendly.com/contact-casaalchemystudio/30min";
const TERMS_VERSION = "1.0";
const FULL_TERMS_PATH = "/legal/casa-consult-terms";

// Public (non-member) Stripe rate, keyed by deal slug. Reached via ?rate=public.
const PUBLIC_RATE_CHECKOUT_URLS: Record<string, string> = {
  "casa-consult": "https://buy.stripe.com/dRmeVe9VDagLbUp5CWaZi08",
};

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: { url: string; parentElement: HTMLElement }) => void;
    };
  }
}

const TERMS_SUMMARY = [
  "Casa Consult is billed hourly at AUD $295 + GST for active Alchemy Academy members, and AUD $395 + GST for non-members, with a minimum of one (1) full hour charged per session regardless of the actual duration. Partial hours are rounded up.",
  "Time spent reviewing, considering and responding to you about the project is billable, regardless of the channel used, including phone calls, emails, WhatsApp messages and SMS.",
  "Cancellations or reschedules require at least 24 hours' notice; less than that incurs an AUD $50 administrative fee, and no full refunds are issued once a session has commenced.",
];

// Non-members cannot read `exclusive_deals`, so the public Casa Consult rate
// renders from this static fallback when the DB row is not visible.
const PUBLIC_RATE_FALLBACK: Record<string, { id: number; slug: string; title: string; description: string; price_label: string }> = {
  "casa-consult": {
    id: 1,
    slug: "casa-consult",
    title: "Casa Consult",
    description:
      "A one-to-one interior design consultation with Lorena Couto, delivered online, on-site, or as a hybrid of both. AUD $395 + GST per hour for non-members of Alchemy Academy.",
    price_label: "AUD $395 + GST per hour",
  },
};

export default function DealDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { data: deals = [], isLoading } = useActiveDeals();
  const trackClick = useTrackDealClick();
  const { user } = useAuth();
  const publicRate = searchParams.get("rate") === "public";
  const deal = useMemo(() => {
    const found = deals.find((d) => d.slug === slug);
    if (found) return found;
    if (publicRate && slug && PUBLIC_RATE_FALLBACK[slug]) {
      return PUBLIC_RATE_FALLBACK[slug] as unknown as (typeof deals)[number];
    }
    return undefined;
  }, [deals, slug, publicRate]);

  // Step completion is derived exclusively from server records:
  //   step 1 -> a real row in public.deal_terms_acceptances
  //   step 2 -> a real paid Stripe payment tied to this booker
  // No localStorage is involved, so nothing can be faked client-side.
  type BookingStatus = { terms_accepted: boolean; payment_verified: boolean; accepted_at: string | null };
  const [status, setStatus] = useState<BookingStatus>({ terms_accepted: false, payment_verified: false, accepted_at: null });
  const [statusLoading, setStatusLoading] = useState(true);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [desiredStep, setDesiredStep] = useState<number>(1);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const calendlyContainerRef = useRef<HTMLDivElement | null>(null);

  // Drop the legacy client-side flag that used to drive the stepper.
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem(`deal-flow:${slug}`);
  }, [slug]);

  useEffect(() => {
    if (user?.email) setEmail((prev) => prev || user.email!);
  }, [user?.email]);

  const refreshStatus = useMemo(
    () => async (emailOverride?: string) => {
      if (!slug) return;
      const probeEmail = (emailOverride ?? email ?? user?.email ?? "").trim().toLowerCase();
      const { data, error } = await supabase.rpc("deal_booking_status", {
        p_deal_slug: slug,
        p_email: probeEmail || undefined,
      });
      if (error) {
        console.warn("deal_booking_status failed:", error.message);
        return;
      }
      const next = (data ?? {}) as BookingStatus;
      setStatus({
        terms_accepted: Boolean(next.terms_accepted),
        payment_verified: Boolean(next.payment_verified),
        accepted_at: next.accepted_at ?? null,
      });
    },
    [slug, email, user?.email],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatusLoading(true);
      await refreshStatus();
      if (!cancelled) setStatusLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.id]);

  const maxStep = status.payment_verified ? 3 : status.terms_accepted ? 2 : 1;
  const step = Math.min(desiredStep, maxStep);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const formValid = firstName.trim().length > 0 && lastName.trim().length > 0 && emailValid && accepted;

  const goTo = (next: number) => setDesiredStep(Math.max(1, Math.min(next, maxStep)));

  const acceptTermsAndContinue = async () => {
    if (!formValid || !slug) return;
    setSaving(true);
    setFormError(null);
    try {
      // Server-side: writes deal_terms_acceptances (service role) and upserts
      // the HubSpot contact + timeline note for the acceptance.
      const { error } = await supabase.functions.invoke("capture-lead", {
        body: {
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          email: email.trim().toLowerCase(),
          source: "casa_consult",
          metadata: {
            deal_slug: slug,
            terms_version: TERMS_VERSION,
            user_id: user?.id ?? null,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            page_uri: typeof window !== "undefined" ? window.location.href : undefined,
          },
        },
      });
      if (error) throw error;
      await refreshStatus(email.trim().toLowerCase());
      setDesiredStep(2);
    } catch (e) {
      console.error("terms acceptance failed:", e);
      setFormError("We could not record your acceptance. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const verifyPayment = async () => {
    setCheckingPayment(true);
    try {
      await refreshStatus();
      setDesiredStep(3);
    } finally {
      setCheckingPayment(false);
    }
  };


  // Casa Consult has two rates: the member rate (the deal's own Stripe link)
  // and the public rate reached with ?rate=public from the landing page.
  const isPublicRate = publicRate;
  const paymentUrl =
    isPublicRate && slug && PUBLIC_RATE_CHECKOUT_URLS[slug]
      ? PUBLIC_RATE_CHECKOUT_URLS[slug]
      : deal?.external_url;




  if (isLoading || statusLoading) {
    return (
      <MemberLayout requireAuth={!isPublicRate}>
        <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
          <p className="text-sm" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
        </div>
      </MemberLayout>
    );
  }

  if (!deal) {
    return (
      <MemberLayout requireAuth={!isPublicRate}>
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
    <MemberLayout requireAuth={!isPublicRate}>
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
                const done = s.n === 1 ? status.terms_accepted : s.n === 2 ? status.payment_verified : false;
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
                <ul className="space-y-3 mb-4">
                  {TERMS_SUMMARY.map((t) => (
                    <li key={t} className="text-xs leading-relaxed flex gap-2" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                      <span style={{ color: "var(--aa-gold)" }}>•</span>
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="text-xs mb-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  <Link
                    to={FULL_TERMS_PATH}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-1"
                    style={{ color: "var(--aa-gold)", fontWeight: 500 }}
                  >
                    Read the full Terms and Conditions <ExternalLink size={12} />
                  </Link>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 max-w-xl">
                  <div>
                    <label htmlFor="cc-first-name" className="block text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                      First name
                    </label>
                    <input
                      id="cc-first-name"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      maxLength={100}
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-cream)", fontFamily: "'DM Sans', sans-serif" }}
                    />
                  </div>
                  <div>
                    <label htmlFor="cc-last-name" className="block text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                      Last name
                    </label>
                    <input
                      id="cc-last-name"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      maxLength={100}
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-cream)", fontFamily: "'DM Sans', sans-serif" }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="cc-email" className="block text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                      Email
                    </label>
                    <input
                      id="cc-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={320}
                      className="w-full px-3 py-2 text-sm outline-none"
                      style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-cream)", fontFamily: "'DM Sans', sans-serif" }}
                    />
                  </div>
                </div>

                <label className="flex items-start gap-3 mb-6 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-[3px]"
                  />
                  <span className="text-xs" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>
                    I have read and agree to the Casa Consult{" "}
                    <Link
                      to={FULL_TERMS_PATH}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                      style={{ color: "var(--aa-gold)", fontWeight: 500 }}
                    >
                      Terms and Conditions
                    </Link>
                  </span>
                </label>
                {formError && (
                  <p className="text-xs mb-4" style={{ color: "#b3261e", fontFamily: "'DM Sans', sans-serif" }}>{formError}</p>
                )}
                <button
                  type="button"
                  disabled={!formValid || saving}
                  onClick={acceptTermsAndContinue}
                  className="px-6 py-3 text-xs uppercase tracking-widest btn-gold disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                >
                  {saving ? "Saving…" : "Continue to payment"}
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
                  {paymentUrl && (
                    <a
                      href={paymentUrl}

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
                    onClick={verifyPayment}
                    disabled={checkingPayment}
                    className="inline-flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-widest disabled:opacity-40"
                    style={{ border: "1px solid var(--aa-gold)", color: "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
                  >
                    {checkingPayment ? "Checking…" : "I've paid, continue"}
                  </button>
                </div>
                {!checkingPayment && !status.payment_verified && desiredStep >= 3 && (
                  <p className="text-xs mt-4 leading-relaxed" style={{ color: "#b3261e", fontFamily: "'DM Sans', sans-serif" }}>
                    We have not received a confirmed payment for this booking yet. Stripe can take a moment, please try again shortly, or contact us at contact@casaalchemystudio.com if it persists.
                  </p>
                )}
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
                <div
                  ref={calendlyContainerRef}
                  className="w-full min-h-[760px]"
                  style={{ border: "1px solid var(--aa-cream-dark)" }}
                  aria-label="Calendly scheduling widget"
                />
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
