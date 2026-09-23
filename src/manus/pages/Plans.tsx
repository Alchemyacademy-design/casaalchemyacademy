import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SubscribeModal from "@/manus/components/SubscribeModal";
import { INDIVIDUAL_COURSE_OPEN, isLaunchPricingActive } from "@/manus/lib/feature-flags";
import BackNav from "@/manus/components/BackNav";
import { useAuth } from "@/manus/hooks/useAuth";
import { useMembershipPlans, useStripePriceDefaults, formatStripePriceLabel } from "@/manus/hooks/usePublicContent";

type SubscriptionChoice = "monthly" | "annual" | "guide" | null;

// Display only overrides so the plan copy stays accurate regardless of the stored text.
const PLAN_DESCRIPTION: Record<string, string> = {
  annual_member:
    "Full annual access at the best value. Includes every course, community, members events, magazine, exclusive deals, and Live Classes with Lorena. One payment covers 12 months.",
  monthly_member:
    "Complete monthly access to every course, the community, Expert Masterclasses, magazine and suppliers directory. Cancel anytime.",
  individual_course:
    "One time purchase for 3 months of access to a single course, including all lesson materials, quizzes and completion certificate.",
};

// Display order: Annual, Monthly, Single Course. Unknown keys go last.
const PLAN_ORDER = ["annual_member", "monthly_member", "individual_course"];
const planRank = (key: string) => {
  const i = PLAN_ORDER.indexOf(key);
  return i === -1 ? PLAN_ORDER.length : i;
};

const FALLBACK_PRICE_LABEL: Record<string, string> = {
  monthly_member: "US$99 / month",
  annual_member: "US$708 / year",
  individual_course: "US$159 one-time",
};

function planFeatures(p: { all_courses: boolean; community_access: boolean; events_access: boolean; live_workshops_access: boolean; exclusive_deals_access: boolean; individual_course_access: boolean; }) {
  const out: string[] = [];
  if (p.all_courses) out.push("All courses included"); else if (p.individual_course_access) out.push("Selected course access");
  if (p.community_access) out.push("Community access");
  if (p.events_access) out.push("Members events");
  if (p.live_workshops_access) out.push("Live workshops");
  if (p.exclusive_deals_access) out.push("Exclusive deals");
  return out;
}

export default function Plans() {
  const navigate = useNavigate();
  const { loading, isAuthenticated, isAdmin, isMember, activeEntitlements, logout } = useAuth();
  const { data: plans = [], isLoading: loadingPlans } = useMembershipPlans();
  const { data: priceMap = {} } = useStripePriceDefaults();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionChoice>(null);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Sparkles className="w-8 h-8 text-accent animate-spin" /></div>;
  }
  if (!isAuthenticated) { navigate("/login"); return null; }

  const alreadyHasAccess = isAdmin || isMember || activeEntitlements.length > 0;

  return (
    <div className="aa-plans-bg min-h-screen px-4 py-10 relative">
      <BackNav variant="top" />
      <div className="max-w-5xl mx-auto relative">

        <div className="text-center mb-10">
          <p className="section-label mb-2">Choose your access</p>
          <h1 className="font-serif text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>Select the option that fits you</h1>
          <p className="text-sm text-foreground/70 max-w-2xl mx-auto">Choose a plan below and complete checkout securely with Stripe. Access is released automatically as soon as your payment is confirmed.</p>
        </div>

        {isAdmin && (
          <Card className="p-5 mb-8 border-accent/40 bg-accent/5">
            <p className="text-sm">Administrator access is active. No subscription is required.</p>
          </Card>
        )}
        {alreadyHasAccess && !isAdmin && (
          <Card className="p-5 mb-8 border-accent/30">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm">You already have active access.</p>
              <Button onClick={() => navigate(isMember ? "/dashboard" : "/mycourses")}>Continue to your content</Button>
            </div>
          </Card>
        )}

        {loadingPlans ? (
          <div className="flex items-center gap-2 text-sm text-foreground/70"><Loader2 className="animate-spin" size={16} /> Loading plans…</div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-foreground/70">No plans available yet.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const features = planFeatures(plan);
              const isMonthly = plan.key === "monthly_member";
              const isAnnual = plan.key === "annual_member";
              const isGuide = plan.key === "individual_course";
              const choice: SubscriptionChoice = isMonthly ? "monthly" : isAnnual ? "annual" : isGuide ? "guide" : null;
              const annualLaunch = isAnnual && isLaunchPricingActive();
              // Membership prices always display as a monthly figure; the yearly total is a secondary line.
              const priceLabel = isAnnual
                ? "USD 59 / month"
                : isGuide
                  ? "USD 159 one time"
                  : formatStripePriceLabel(priceMap[plan.key]) ?? FALLBACK_PRICE_LABEL[plan.key];
              const billingNote = isAnnual && !annualLaunch ? "USD 708 billed yearly" : null;
              const bonusLines = annualLaunch
                ? ["+ 1 free month", "+ 1 mini Casa Consult with Lorena", "Launch week only, until Fri 25 Sept"]
                : isAnnual
                  ? ["Save USD 480"]
                  : [];
              const description = PLAN_DESCRIPTION[plan.key] ?? plan.description;
              return (
                <Card key={plan.key} className="p-6 flex flex-col">
                  <h2 className="font-serif text-2xl mb-2" style={{ color: "var(--aa-olive-dark)" }}>{plan.name}</h2>
                  <div className="mb-4">
                    {priceLabel && (
                      <div className="font-serif text-2xl mb-1" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
                        {priceLabel}
                      </div>
                    )}
                    {billingNote && (
                      <p className="text-xs text-foreground/60">{billingNote}</p>
                    )}
                    {bonusLines.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {bonusLines.map((b) => (
                          <span key={b} className="text-[11px] uppercase tracking-wide rounded-full px-2 py-1 bg-accent/10 text-accent">{b}</span>
                        ))}
                      </div>
                    )}
                    {!priceLabel && (
                      <span className="text-xs text-foreground/60 uppercase tracking-wide">{plan.duration}</span>
                    )}
                  </div>
                  {description && <p className="text-sm text-foreground/70 mb-5">{description}</p>}
                  <ul className="space-y-2 mb-6 flex-1">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-accent" />{f}</li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    disabled={isAdmin || !choice || (isGuide && !INDIVIDUAL_COURSE_OPEN)}
                    onClick={() => {
                      if (!choice) return;
                      if (choice === "guide") {
                        if (!INDIVIDUAL_COURSE_OPEN) return;
                        navigate("/choose-course");
                        return;
                      }
                      setSelectedPlan(choice);
                    }}
                  >
                    {isAdmin
                      ? "Not required for admin"
                      : choice === "guide"
                        ? (INDIVIDUAL_COURSE_OPEN ? "Choose your course" : "Opens soon")
                        : choice
                          ? `Choose ${choice}`
                          : "Contact us"}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}

        <div className="text-center mt-8 space-x-4">
          <button className="text-sm text-foreground/60 hover:text-foreground" onClick={() => navigate("/profile")}>View profile</button>
          <button className="text-sm text-foreground/60 hover:text-foreground" onClick={async () => { await logout(); navigate("/login"); }}>Sign out</button>
        </div>
      </div>

      {selectedPlan && <SubscribeModal type={selectedPlan} onClose={() => setSelectedPlan(null)} />}
      <BackNav variant="bottom" />
    </div>
  );
}
