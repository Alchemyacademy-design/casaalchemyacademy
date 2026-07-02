import { useState } from "react";
import { X, Heart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SubscribeModalProps {
  type: "annual" | "monthly" | "guide";
  courseId?: number;
  onClose: () => void;
}

const CHARITIES = [
  { id: "lighthouse", name: "The Lighthouse for the Community" },
  { id: "acasa", name: "A Casa Org" },
];

const PLAN_LABELS: Record<string, { label: string; price: string; sub: string }> = {
  annual: {
    label: "Annual Membership",
    price: "A$708 / year",
    sub: "Billed annually (equivalent to A$59/month). Full access for 12 months: every course, community, members events, magazine, exclusive deals and Live Classes with Lorena. Save A$480 vs monthly.",
  },
  monthly: {
    label: "Monthly Membership",
    price: "A$99 / month",
    sub: "Billed monthly, no lock-in. Cancel anytime. Includes all courses, community, members events, magazine, suppliers directory and exclusive deals.",
  },
  guide: {
    label: "Single Course",
    price: "A$159 one-time",
    sub: "One-time payment for lifetime access to a single course, billed individually. Includes all lesson materials, quizzes and completion certificate.",
  },
};

const OFFER_KEYS = {
  annual: "annual_member",
  monthly: "monthly_member",
  guide: "individual_course",
} as const;

const PAYMENT_LINKS: Record<"annual" | "monthly" | "guide", string> = {
  guide: "https://buy.stripe.com/8x2cN64Bj74z6A56H0aZi03",
  monthly: "https://buy.stripe.com/9B66oI4BjbkP0bHghAaZi01",
  annual: "https://buy.stripe.com/4gMbJ27Nv0Gb2jP1mGaZi02",
};

export default function SubscribeModal({ type, courseId, onClose }: SubscribeModalProps) {
  const [selectedCharity, setSelectedCharity] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const planInfo = PLAN_LABELS[type];

  const handleContinue = async () => {
    if (!selectedCharity || isLoading) return;
    setError(null);
    setIsLoading(true);

    let willRedirect = false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        setError("Please sign in before continuing to payment.");
        toast.error("You need to be signed in to continue to checkout.");
        return;
      }
      if (!user.email) {
        setError("Your account has no email. Please update your profile before checkout.");
        return;
      }

      const baseUrl = PAYMENT_LINKS[type];
      const url = new URL(baseUrl);
      // Prefill email and pass through metadata so the webhook can match the user.
      url.searchParams.set("prefilled_email", user.email);
      url.searchParams.set("client_reference_id", user.id);
      if (type === "guide" && courseId) {
        url.searchParams.set("utm_content", `course_${courseId}`);
      }
      url.searchParams.set("utm_source", "lovable");
      url.searchParams.set("utm_campaign", selectedCharity);
      toast.success("Redirecting to secure Stripe checkout…");
      willRedirect = true;
      // Small delay so the toast is visible before navigation.
      setTimeout(() => { window.location.href = url.toString(); }, 400);
    } catch (checkoutError) {
      console.error("Checkout error:", checkoutError);
      setError("We could not start checkout. Please try again.");
      toast.error("Could not open checkout. Please try again.");
    } finally {
      if (!willRedirect) setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(61,58,42,0.7)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-md mx-4 p-8" style={{ backgroundColor: "var(--aa-cream)", border: "1px solid var(--aa-cream-dark)" }}>
        <button onClick={onClose} className="absolute top-4 right-4 opacity-40 hover:opacity-100 transition-opacity">
          <X size={16} style={{ color: "var(--aa-olive-dark)" }} />
        </button>

        <p className="section-label mb-2">{planInfo.label}</p>
        <div className="font-serif mb-1" style={{ fontSize: "2.5rem", color: "var(--aa-olive-dark)", fontWeight: 300, lineHeight: 1 }}>{planInfo.price}</div>
        <p className="text-xs mb-8" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>{planInfo.sub}</p>

        <div className="mb-6" style={{ borderTop: "1px solid var(--aa-cream-dark)", paddingTop: "1.5rem" }}>
          <div className="flex items-center gap-2 mb-3">
            <Heart size={13} style={{ color: "var(--aa-gold)" }} />
            <p className="text-xs font-medium" style={{ color: "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>Choose a charity to receive your $1 donation:</p>
          </div>
          <div className="space-y-2 mb-3">
            {CHARITIES.map((charity) => (
              <label key={charity.id} className="flex items-center gap-3 cursor-pointer p-3" style={{ border: `1px solid ${selectedCharity === charity.id ? "var(--aa-gold)" : "var(--aa-cream-dark)"}`, backgroundColor: selectedCharity === charity.id ? "rgba(196,160,90,0.06)" : "transparent", transition: "all 0.15s ease" }}>
                <input type="radio" name="charity" value={charity.id} checked={selectedCharity === charity.id} onChange={() => setSelectedCharity(charity.id)} style={{ accentColor: "var(--aa-gold)" }} />
                <span className="text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>{charity.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif", fontStyle: "italic" }}>This is our way of giving back. You pay nothing more.</p>
        </div>

        {error && <p className="text-sm mb-4" style={{ color: "#9f3a38", fontFamily: "'DM Sans', sans-serif" }}>{error}</p>}

        <button onClick={handleContinue} disabled={!selectedCharity || isLoading} className="btn-gold w-full inline-flex items-center justify-center gap-2" style={{ opacity: selectedCharity && !isLoading ? 1 : 0.4 }}>
          {isLoading && <Loader2 size={14} className="animate-spin" />}
          {isLoading ? "Opening secure checkout…" : "Continue to Payment"}
        </button>
        <p className="text-[10px] mt-3 text-center" style={{ color: "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
          You will be redirected to Stripe. Access is released automatically once payment is confirmed.
        </p>
      </div>
    </div>
  );
}
