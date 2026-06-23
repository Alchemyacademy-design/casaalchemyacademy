import { useState } from "react";
import { X, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  annual: { label: "Annual Membership", price: "AUD 708", sub: "one payment for 12 months of access" },
  monthly: { label: "Monthly Membership", price: "AUD 99/month", sub: "renews monthly until cancelled" },
  guide: { label: "Selected Course", price: "AUD 159", sub: "renews every 3 months until cancelled" },
};

const OFFER_KEYS = {
  annual: "annual_member",
  monthly: "monthly_member",
  guide: "individual_course",
} as const;

export default function SubscribeModal({ type, courseId, onClose }: SubscribeModalProps) {
  const [selectedCharity, setSelectedCharity] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const planInfo = PLAN_LABELS[type];

  const handleContinue = async () => {
    if (!selectedCharity || isLoading) return;
    setError(null);
    setIsLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setError("Please sign in before continuing to payment.");
        return;
      }

      if (type === "guide" && !courseId) {
        setError("Please select a course before continuing.");
        return;
      }

      const { data, error: functionError } = await supabase.functions.invoke("create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-idempotency-key": crypto.randomUUID(),
        },
        body: {
          offer_key: OFFER_KEYS[type],
          ...(type === "guide" ? { course_id: courseId } : {}),
          charity_id: selectedCharity,
        },
      });

      if (functionError) {
        // Edge function returns 503 BILLING_LIVE_DISABLED while live credentials are staged
        // but not yet activated. Show a friendly message instead of a generic error.
        const ctx = (functionError as { context?: { body?: unknown } }).context;
        const bodyText = typeof ctx?.body === "string" ? ctx.body : "";
        if (bodyText.includes("BILLING_LIVE_DISABLED")) {
          setError("Payments are not active yet. Please check back soon.");
          return;
        }
        throw functionError;
      }
      if (!data?.checkout_url) throw new Error("Checkout URL was not returned.");
      window.location.href = data.checkout_url;
    } catch (checkoutError) {
      console.error("Checkout error:", checkoutError);
      setError("We could not start checkout. Please try again.");
    } finally {
      setIsLoading(false);
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

        <button onClick={handleContinue} disabled={!selectedCharity || isLoading} className="btn-gold w-full" style={{ opacity: selectedCharity && !isLoading ? 1 : 0.4 }}>
          {isLoading ? "Opening checkout..." : "Continue to Payment"}
        </button>
      </div>
    </div>
  );
}
