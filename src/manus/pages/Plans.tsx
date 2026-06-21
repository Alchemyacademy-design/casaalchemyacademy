import { useState } from "react";
import { useLocation } from "wouter";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SubscribeModal from "@/manus/components/SubscribeModal";
import { useAuth } from "@/manus/hooks/useAuth";

type SubscriptionChoice = "monthly" | "annual" | null;

const plans = [
  {
    key: "monthly" as const,
    title: "Monthly Membership",
    price: "$99",
    cadence: "per month",
    description: "Full membership access with monthly billing.",
    features: ["All member areas", "Courses included by plan", "Community access"],
  },
  {
    key: "annual" as const,
    title: "Annual Membership",
    price: "$708",
    cadence: "per year",
    description: "Full membership access with annual billing.",
    features: ["All member areas", "Courses included by plan", "Community access"],
  },
];

export default function Plans() {
  const [, navigate] = useLocation();
  const { loading, isAuthenticated, isAdmin, isMember, activeEntitlements, logout } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionChoice>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const alreadyHasAccess = isAdmin || isMember || activeEntitlements.length > 0;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="section-label mb-2">Choose your access</p>
          <h1 className="font-serif text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Select the option that fits you
          </h1>
          <p className="text-sm text-foreground/70 max-w-2xl mx-auto">
            Your account is ready. Access is released automatically after Stripe confirms payment.
          </p>
        </div>

        {isAdmin && (
          <Card className="p-5 mb-8 border-accent/40 bg-accent/5">
            <p className="text-sm">
              Administrator access is active. No subscription is required.
            </p>
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

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.key} className="p-6 flex flex-col">
              <h2 className="font-serif text-2xl mb-2" style={{ color: "var(--aa-olive-dark)" }}>{plan.title}</h2>
              <div className="mb-4">
                <span className="text-3xl font-semibold">{plan.price}</span>
                <span className="text-sm text-foreground/60 ml-2">{plan.cadence}</span>
              </div>
              <p className="text-sm text-foreground/70 mb-5">{plan.description}</p>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button className="w-full" disabled={isAdmin} onClick={() => setSelectedPlan(plan.key)}>
                {isAdmin ? "Not required for admin" : `Choose ${plan.key === "monthly" ? "monthly" : "annual"}`}
              </Button>
            </Card>
          ))}

          <Card className="p-6 flex flex-col">
            <h2 className="font-serif text-2xl mb-2" style={{ color: "var(--aa-olive-dark)" }}>Individual Course</h2>
            <div className="mb-4">
              <span className="text-3xl font-semibold">R$159</span>
              <span className="text-sm text-foreground/60 ml-2">one-time</span>
            </div>
            <p className="text-sm text-foreground/70 mb-5">Buy one selected course and keep access for three months.</p>
            <ul className="space-y-2 mb-6 flex-1">
              <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-accent" />Card or Pix</li>
              <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-accent" />Three months of access</li>
              <li className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-accent" />Only the selected course</li>
            </ul>
            <Button className="w-full" disabled={isAdmin} onClick={() => navigate("/courses")}>{isAdmin ? "Not required for admin" : "Choose a course"}</Button>
          </Card>
        </div>

        <div className="text-center mt-8 space-x-4">
          <button className="text-sm text-foreground/60 hover:text-foreground" onClick={() => navigate("/profile")}>View profile</button>
          <button className="text-sm text-foreground/60 hover:text-foreground" onClick={async () => { await logout(); navigate("/login"); }}>Sign out</button>
        </div>
      </div>

      {selectedPlan && <SubscribeModal type={selectedPlan} onClose={() => setSelectedPlan(null)} />}
    </div>
  );
}
