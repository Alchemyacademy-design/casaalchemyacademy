import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import AdminTablePage from "@/manus/components/admin/AdminTablePage";
import { useStripePriceDefaults, formatStripePriceLabel, useMembershipPlans } from "@/manus/hooks/usePublicContent";

type SubRow = { status: string; stripe_price_id: string | null; livemode: boolean | null };

function useSubscriberStats() {
  return useQuery({
    queryKey: ["admin", "plan_subscriber_stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stripe_subscriptions")
        .select("status, stripe_price_id, livemode");
      if (error) throw error;
      return (data ?? []) as SubRow[];
    },
  });
}

function useRecentRevenue() {
  return useQuery({
    queryKey: ["admin", "plan_recent_revenue"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("stripe_payments")
        .select("amount, currency, status, paid_at")
        .gte("paid_at", since)
        .eq("status", "succeeded" as never);
      if (error) return [] as { amount: number; currency: string }[];
      return (data ?? []) as { amount: number; currency: string }[];
    },
  });
}

function PlanOverviewCards() {
  const { data: plans = [] } = useMembershipPlans();
  const { data: priceMap = {} } = useStripePriceDefaults();
  const { data: subs = [] } = useSubscriberStats();
  const { data: payments = [] } = useRecentRevenue();

  const revenue30d = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const currency = payments[0]?.currency ?? "aud";
  const revenueLabel = (revenue30d / 100).toLocaleString(undefined, {
    style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0,
  });

  const totalActive = subs.filter((s) => ["active", "trialing"].includes(s.status)).length;
  const totalPastDue = subs.filter((s) => s.status === "past_due").length;

  return (
    <>
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-foreground/60"><Users className="w-4 h-4" /> Active subscribers</div>
          <div className="text-2xl font-semibold mt-1">{totalActive}</div>
          {totalPastDue > 0 && <div className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {totalPastDue} past due</div>}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-foreground/60"><DollarSign className="w-4 h-4" /> Revenue (30d)</div>
          <div className="text-2xl font-semibold mt-1">{revenueLabel}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-foreground/60"><TrendingUp className="w-4 h-4" /> Plans active</div>
          <div className="text-2xl font-semibold mt-1">{plans.length}</div>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-8">
        {plans.map((plan) => {
          const price = priceMap[plan.key];
          const priceLabel = formatStripePriceLabel(price);
          const active = subs.filter(
            (s) => s.stripe_price_id === price?.stripe_price_id && ["active", "trialing"].includes(s.status),
          ).length;
          const synced = !!price;
          return (
            <Card key={plan.key} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{plan.name}</div>
                  <div className="text-xs text-foreground/60">{plan.key}</div>
                </div>
                {synced ? (
                  <Badge variant={price?.livemode ? "default" : "secondary"}>{price?.livemode ? "Live" : "Test"}</Badge>
                ) : (
                  <Badge variant="destructive">Out of sync</Badge>
                )}
              </div>
              <div className="mt-3 text-lg">{priceLabel ?? <span className="text-sm text-foreground/50">No Stripe price mapped</span>}</div>
              <div className="mt-2 text-xs text-foreground/60">{active} active subscriber{active === 1 ? "" : "s"}</div>
              {price && (
                <div className="mt-2 text-[10px] text-foreground/40 font-mono truncate" title={price.stripe_price_id}>{price.stripe_price_id}</div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

export function AdminPlansInner({ embedded = false }: { embedded?: boolean }) {
  return (
    <div>
      <PlanOverviewCards />
      <AdminTablePage
      noShell={embedded}
      title="Membership plans"
      description="Plan catalogue used by /plans. Stripe prices are managed in Stripe — only metadata is editable here."
      table="membership_plans"
      orderBy={{ column: "key", ascending: true }}
      searchFields={["name", "key"]}
      publicInvalidateKeys={[["public", "membership_plans"]]}
      fields={[
        { name: "key", label: "Key", type: "text", required: true },
        { name: "name", label: "Name", type: "text", required: true },
        { name: "description", label: "Description", type: "textarea", hideInTable: true },
        { name: "duration", label: "Duration", type: "text" },
        { name: "all_courses", label: "All courses", type: "boolean" },
        { name: "community_access", label: "Community", type: "boolean" },
        { name: "events_access", label: "Events", type: "boolean" },
        { name: "active", label: "Active", type: "boolean", defaultValue: true },
      ]}
      />
    </div>
  );
}

export default function AdminPlans() { return <AdminPlansInner />; }
