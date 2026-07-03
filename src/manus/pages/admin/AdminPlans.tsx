import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, DollarSign, TrendingUp, AlertCircle, Check, Eye, Save, ChevronDown, ExternalLink, Zap, XCircle } from "lucide-react";
import AdminTablePage from "@/manus/components/admin/AdminTablePage";
import { useStripePriceDefaults, formatStripePriceLabel, useMembershipPlans, describeError } from "@/manus/hooks/usePublicContent";
import type { Database } from "@/integrations/supabase/types";

type PlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];

type SubRow = {
  status: string;
  stripe_price_id: string | null;
  livemode: boolean | null;
  cancelled_at: string | null;
  cancel_at_period_end: boolean | null;
  current_period_end: string | null;
};

function useSubscriberStats() {
  return useQuery({
    queryKey: ["admin", "plan_subscriber_stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stripe_subscriptions")
        .select("status, stripe_price_id, livemode, cancelled_at, cancel_at_period_end, current_period_end");
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
  const totalTrialing = subs.filter((s) => s.status === "trialing").length;
  const since30 = Date.now() - 30 * 24 * 3600 * 1000;
  const churned30d = subs.filter((s) =>
    (s.status === "canceled" || s.status === "cancelled") &&
    s.cancelled_at && new Date(s.cancelled_at).getTime() >= since30,
  ).length;

  const priceById = new Map<string, { unit_amount: number | null; recurring_interval: string | null; recurring_interval_count: number | null }>();
  for (const p of Object.values(priceMap)) {
    if (p?.stripe_price_id) priceById.set(p.stripe_price_id, p as never);
  }
  let mrrCents = 0;
  for (const s of subs) {
    if (!["active", "trialing"].includes(s.status)) continue;
    const p = s.stripe_price_id ? priceById.get(s.stripe_price_id) : null;
    if (!p || !p.unit_amount) continue;
    const count = p.recurring_interval_count ?? 1;
    if (p.recurring_interval === "month") mrrCents += p.unit_amount / count;
    else if (p.recurring_interval === "year") mrrCents += p.unit_amount / (12 * count);
    else if (p.recurring_interval === "week") mrrCents += (p.unit_amount * 52) / (12 * count);
  }
  const mrrLabel = (mrrCents / 100).toLocaleString(undefined, {
    style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0,
  });

  return (
    <>
      <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-foreground/60"><TrendingUp className="w-4 h-4" /> MRR</div>
          <div className="text-2xl font-semibold mt-1">{mrrLabel}</div>
          <div className="text-[10px] text-foreground/50 mt-1">Normalised monthly</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-foreground/60"><Users className="w-4 h-4" /> Active subscribers</div>
          <div className="text-2xl font-semibold mt-1">{totalActive}</div>
          {totalPastDue > 0 && <div className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {totalPastDue} past due</div>}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-foreground/60"><Zap className="w-4 h-4" /> Trialing</div>
          <div className="text-2xl font-semibold mt-1">{totalTrialing}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-foreground/60"><DollarSign className="w-4 h-4" /> Revenue (30d)</div>
          <div className="text-2xl font-semibold mt-1">{revenueLabel}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-foreground/60"><XCircle className="w-4 h-4" /> Churned (30d)</div>
          <div className="text-2xl font-semibold mt-1">{churned30d}</div>
          <div className="text-[10px] text-foreground/50 mt-1">{plans.length} plans configured</div>
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

const PERK_FIELDS: { key: keyof PlanRow; label: string }[] = [
  { key: "all_courses", label: "All courses included" },
  { key: "individual_course_access", label: "Individual course access" },
  { key: "community_access", label: "Community access" },
  { key: "events_access", label: "Members events" },
  { key: "live_workshops_access", label: "Live workshops" },
  { key: "exclusive_deals_access", label: "Exclusive deals" },
];

function PlanEditorCard({ plan }: { plan: PlanRow }) {
  const qc = useQueryClient();
  const { data: priceMap = {} } = useStripePriceDefaults();
  const price = priceMap[plan.key];
  const priceLabel = formatStripePriceLabel(price);

  const [draft, setDraft] = useState<PlanRow>(plan);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(plan), [draft, plan]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const patch: Partial<PlanRow> = {
        name: draft.name,
        description: draft.description,
        active: draft.active,
        all_courses: draft.all_courses,
        individual_course_access: draft.individual_course_access,
        community_access: draft.community_access,
        events_access: draft.events_access,
        live_workshops_access: draft.live_workshops_access,
        exclusive_deals_access: draft.exclusive_deals_access,
      };
      const { data, error } = await supabase
        .from("membership_plans")
        .update(patch)
        .eq("key", plan.key)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Plan saved");
      qc.invalidateQueries({ queryKey: ["public", "plans"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => {
      const d = describeError(e, "save plan");
      toast.error(d.title, { description: d.description });
    },
  });

  return (
    <Card className="p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-xs text-foreground/60 font-mono">{plan.key}</div>
          <Input
            className="mt-1 text-base font-medium"
            value={draft.name ?? ""}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {price ? (
            <Badge variant={price.livemode ? "default" : "secondary"}>{price.livemode ? "Live" : "Test"}</Badge>
          ) : (
            <Badge variant="destructive">Out of sync</Badge>
          )}
          <Badge variant={draft.active ? "default" : "outline"} className="text-[10px]">{draft.active ? "Active" : "Hidden"}</Badge>
        </div>
      </div>

      <div className="mb-3 text-lg">
        {priceLabel ?? <span className="text-sm text-foreground/50">No Stripe price mapped</span>}
      </div>

      <div className="mb-3">
        <Label className="text-xs">Description shown on /plans</Label>
        <Textarea
          className="mt-1"
          rows={3}
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Visible on /plans</Label>
          <Switch checked={!!draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
        </div>
        {PERK_FIELDS.map((f) => (
          <div key={String(f.key)} className="flex items-center justify-between">
            <Label className="text-xs">{f.label}</Label>
            <Switch
              checked={!!(draft as unknown as Record<string, unknown>)[f.key as string]}
              onCheckedChange={(v) => setDraft({ ...draft, [f.key]: v } as PlanRow)}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          <Save className="w-4 h-4 mr-1" /> {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye className="w-4 h-4 mr-1" /> Preview as member
        </Button>
        {dirty && <span className="text-[11px] text-amber-600">Unsaved changes</span>}
      </div>

      {price && (
        <a
          href={`https://dashboard.stripe.com/${price.livemode ? "" : "test/"}prices/${price.stripe_price_id}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 text-[11px] text-foreground/50 hover:text-foreground/80 inline-flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" /> Manage price in Stripe
        </a>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Member preview — {draft.name}</DialogTitle>
          </DialogHeader>
          <MemberPreviewCard plan={draft} priceLabel={priceLabel} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function MemberPreviewCard({ plan, priceLabel }: { plan: PlanRow; priceLabel: string | null }) {
  const features: string[] = [];
  if (plan.all_courses) features.push("All courses included");
  else if (plan.individual_course_access) features.push("Selected course access");
  if (plan.community_access) features.push("Community access");
  if (plan.events_access) features.push("Members events");
  if (plan.live_workshops_access) features.push("Live workshops");
  if (plan.exclusive_deals_access) features.push("Exclusive deals");

  return (
    <Card className="p-6 flex flex-col border-accent/30">
      <h2 className="font-serif text-2xl mb-2">{plan.name}</h2>
      {priceLabel ? (
        <div className="font-serif text-2xl mb-3" style={{ fontWeight: 300 }}>{priceLabel}</div>
      ) : (
        <div className="text-xs text-foreground/60 uppercase tracking-wide mb-3">No Stripe price</div>
      )}
      {plan.description && <p className="text-sm text-foreground/70 mb-4">{plan.description}</p>}
      <ul className="space-y-2 mb-4">
        {features.length ? features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-accent" />{f}</li>
        )) : <li className="text-xs text-foreground/50">No perks enabled</li>}
      </ul>
      <Button className="w-full" disabled>Choose (preview)</Button>
    </Card>
  );
}

function PlansEditorGrid() {
  const { data: plans = [], isLoading } = useMembershipPlans();
  if (isLoading) return <p className="text-sm text-foreground/60">Loading plans…</p>;
  if (!plans.length) return <p className="text-sm text-foreground/60">No plans yet.</p>;
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {plans.map((p) => <PlanEditorCard key={p.key} plan={p} />)}
    </div>
  );
}

export function AdminPlansInner({ embedded = false }: { embedded?: boolean }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <div>
      <PlanOverviewCards />

      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-lg font-medium">Plan editor</h2>
          <p className="text-xs text-foreground/60">Metadata and perks shown on /plans. Prices come from Stripe.</p>
        </div>
      </div>
      <PlansEditorGrid />

      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="mt-8">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs">
            <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            Advanced table view
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <AdminTablePage
            noShell={embedded}
            title="Membership plans (raw)"
            description="Low-level table for debugging. Prefer the card editor above."
            table="membership_plans"
            primaryKey="key"
            orderBy={{ column: "key", ascending: true }}
            searchFields={["name", "key"]}
            publicInvalidateKeys={[["public", "plans"]]}
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function AdminPlans() { return <AdminPlansInner />; }
