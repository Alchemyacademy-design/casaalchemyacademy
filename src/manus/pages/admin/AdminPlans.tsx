import { useEffect, useMemo, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, DollarSign, TrendingUp, AlertCircle, Check, Eye, Save, ChevronDown, ExternalLink, Zap, XCircle, RefreshCw, Plus, Trash2, ShieldAlert, Copy, ArrowUpDown, Loader2, Wand2 } from "lucide-react";
import AdminTablePage from "@/manus/components/admin/AdminTablePage";
import { useStripePriceDefaults, formatStripePriceLabel, describeError } from "@/manus/hooks/usePublicContent";
import type { Database } from "@/integrations/supabase/types";

type PlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];
type PlanKey = Database["public"]["Enums"]["membership_plan_key"];

// Keep in sync with the `membership_plan_key` enum in Postgres.
// Add new values via `ALTER TYPE ... ADD VALUE` migration before using them.
const KNOWN_PLAN_KEYS: PlanKey[] = ["annual_member", "monthly_member", "individual_course"];

type StripeCheckResult = {
  products: { id: string; name: string; livemode: boolean; active: boolean }[];
  prices: {
    id: string; product: string; unit_amount: number | null; currency: string;
    recurring: { interval: string; interval_count: number } | null;
    livemode: boolean; active: boolean;
  }[];
};

function useAllMembershipPlans() {
  return useQuery({
    queryKey: ["admin", "all_membership_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_plans")
        .select("*")
        .order("key", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
  });
}

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

function stripeDashboardHost(livemode: boolean | undefined | null) {
  return `https://dashboard.stripe.com/${livemode ? "" : "test/"}`;
}

function openStripePrice(priceId: string, livemode: boolean | undefined | null) {
  window.open(`${stripeDashboardHost(livemode)}prices/${priceId}`, "_blank", "noopener");
}

function openStripeNewPrice(planKey: string) {
  // Opens the Prices list filtered so admin can create a new price with metadata.plan_key set.
  window.open(
    `https://dashboard.stripe.com/prices/create?metadata[plan_key]=${encodeURIComponent(planKey)}`,
    "_blank",
    "noopener",
  );
}

/* ===== Sync with Stripe dialog ===== */
function SyncWithStripeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: plans = [] } = useAllMembershipPlans();
  const { data: priceMap = {} } = useStripePriceDefaults();

  const rows = plans.map((plan) => {
    const price = priceMap[plan.key];
    return { plan, price, synced: !!price };
  });
  const outOfSync = rows.filter((r) => !r.synced);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Verify & sync with Stripe</DialogTitle>
          <DialogDescription>
            Compares each plan against active default prices in <code>stripe_prices</code>.
            Plans without a matching Live/Test price are marked out of sync.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-auto">
          {rows.map(({ plan, price, synced }) => (
            <div key={plan.key} className="flex items-center justify-between gap-2 border rounded p-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{plan.name}</div>
                <div className="text-[10px] font-mono text-foreground/50 truncate">{plan.key}</div>
              </div>
              {synced ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={price!.livemode ? "default" : "secondary"}>{price!.livemode ? "Live" : "Test"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => openStripePrice(price!.stripe_price_id, price!.livemode)}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Open
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="destructive">Out of sync</Badge>
                  <Button size="sm" onClick={() => openStripeNewPrice(plan.key)}>
                    <Plus className="w-3 h-3 mr-1" /> Create price
                  </Button>
                </div>
              )}
            </div>
          ))}
          {!rows.length && <p className="text-sm text-foreground/60">No plans configured.</p>}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <p className="text-xs text-foreground/60">
            {outOfSync.length
              ? `${outOfSync.length} plan${outOfSync.length === 1 ? "" : "s"} out of sync`
              : "All plans mapped"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["public", "stripe_price_defaults"] });
                qc.invalidateQueries({ queryKey: ["admin"] });
                toast.success("Refreshed from Supabase");
              }}
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Refresh
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===== New plan dialog ===== */
function NewPlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: existingPlans = [] } = useAllMembershipPlans();
  const usedKeys = new Set(existingPlans.map((p) => p.key));
  const availableKeys = KNOWN_PLAN_KEYS.filter((k) => !usedKeys.has(k));

  const [key, setKey] = useState<PlanKey | "">("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("1 month");
  const [perks, setPerks] = useState<Record<string, boolean>>({});
  const [checkResult, setCheckResult] = useState<StripeCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [forceDespiteDuplicate, setForceDespiteDuplicate] = useState(false);

  useEffect(() => {
    setCheckResult(null);
    setForceDespiteDuplicate(false);
    if (!key) return;
    let cancelled = false;
    setChecking(true);
    supabase.functions
      .invoke("admin-stripe-plan-sync", { body: { action: "check_plan_key", plan_key: key } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Stripe check failed", { description: error.message });
          return;
        }
        setCheckResult(data as StripeCheckResult);
      })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [key]);

  const stripeHasDuplicate = !!checkResult && (checkResult.prices?.length ?? 0) > 0;

  const create = useMutation({
    mutationFn: async () => {
      if (!key) throw new Error("Pick a plan key");
      if (!name.trim()) throw new Error("Name is required");
      if (stripeHasDuplicate && !forceDespiteDuplicate) {
        throw new Error("Stripe already has a Price for this plan_key. Confirm the override to continue.");
      }
      const { data, error } = await supabase
        .from("membership_plans")
        .insert({
          key: key as PlanKey,
          name: name.trim(),
          description: description.trim() || null,
          duration,
          active: true,
          ...PERK_FIELDS.reduce<Record<string, boolean>>((acc, f) => {
            acc[String(f.key)] = !!perks[String(f.key)];
            return acc;
          }, {}),
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as PlanRow;
    },
    onSuccess: (row) => {
      toast.success(`Plan “${row.name}” created`, {
        description: "Next: create a Stripe Price with metadata.plan_key = " + row.key,
        action: {
          label: "Open Stripe",
          onClick: () => openStripeNewPrice(row.key),
        },
      });
      qc.invalidateQueries({ queryKey: ["public", "plans"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
      onOpenChange(false);
      setKey(""); setName(""); setDescription(""); setPerks({});
      setCheckResult(null); setForceDespiteDuplicate(false);
    },
    onError: (e) => {
      const d = describeError(e, "create plan");
      toast.error(d.title, { description: d.description });
    },
  });

  const enumSql = `-- Run this migration first to add a new enum value, then reopen New plan.
ALTER TYPE public.membership_plan_key ADD VALUE 'your_new_key';`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New membership plan</DialogTitle>
          <DialogDescription>
            Creates the row in <code>membership_plans</code>. Pricing is set separately in Stripe.
          </DialogDescription>
        </DialogHeader>

        {availableKeys.length === 0 ? (
          <div className="space-y-3">
            <div className="text-sm text-amber-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>All existing enum keys already have a plan row. To add a brand new plan, first extend the <code>membership_plan_key</code> enum via migration.</span>
            </div>
            <div className="relative">
              <pre className="bg-muted text-xs p-3 rounded overflow-auto">{enumSql}</pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-1 right-1"
                onClick={() => { navigator.clipboard.writeText(enumSql); toast.success("Copied"); }}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Plan key (enum)</Label>
              <Select value={key} onValueChange={(v) => setKey(v as PlanKey)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Pick an unused enum key" /></SelectTrigger>
                <SelectContent>
                  {availableKeys.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea className="mt-1" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Duration (Postgres interval)</Label>
              <Input className="mt-1" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="1 month" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Perks</Label>
              {PERK_FIELDS.map((f) => (
                <div key={String(f.key)} className="flex items-center justify-between">
                  <span className="text-xs">{f.label}</span>
                  <Switch checked={!!perks[String(f.key)]} onCheckedChange={(v) => setPerks({ ...perks, [String(f.key)]: v })} />
                </div>
              ))}
            </div>

            {key && (
              <div className="rounded border p-3 text-xs space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Stripe pre-check for <code>{key}</code>
                </div>
                {checking && <p className="text-foreground/60">Querying Stripe…</p>}
                {!checking && checkResult && (
                  <>
                    {checkResult.prices.length === 0 && checkResult.products.length === 0 && (
                      <p className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" /> No existing Product/Price found. Safe to create.</p>
                    )}
                    {checkResult.prices.length > 0 && (
                      <>
                        <p className="text-amber-600 flex items-start gap-1"><AlertCircle className="w-3 h-3 mt-0.5" /> Stripe already has {checkResult.prices.length} active Price{checkResult.prices.length === 1 ? "" : "s"} tagged with this plan_key:</p>
                        <ul className="space-y-1">
                          {checkResult.prices.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-2">
                              <span className="font-mono truncate">
                                {p.id} · {(p.unit_amount ?? 0) / 100} {p.currency.toUpperCase()}
                                {p.recurring ? ` / ${p.recurring.interval}` : ""}
                              </span>
                              <a
                                className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1"
                                href={`${stripeDashboardHost(p.livemode)}prices/${p.id}`}
                                target="_blank" rel="noreferrer"
                              >
                                <ExternalLink className="w-3 h-3" /> Open
                              </a>
                            </li>
                          ))}
                        </ul>
                        <label className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            checked={forceDespiteDuplicate}
                            onChange={(e) => setForceDespiteDuplicate(e.target.checked)}
                          />
                          <span>I understand — create the plan row anyway</span>
                        </label>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {availableKeys.length > 0 && (
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending || !key || !name.trim() || checking ||
                (stripeHasDuplicate && !forceDespiteDuplicate)
              }
            >
              <Plus className="w-4 h-4 mr-1" /> {create.isPending ? "Creating…" : "Create plan"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ===== Delete plan (protected) ===== */
function DeletePlanDialog({
  plan,
  activeSubs,
  open,
  onOpenChange,
}: {
  plan: PlanRow;
  activeSubs: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [typed, setTyped] = useState("");
  const canDelete = typed.trim() === plan.key;

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("membership_plans").delete().eq("key", plan.key);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Plan ${plan.key} deleted`);
      qc.invalidateQueries({ queryKey: ["public", "plans"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
      onOpenChange(false);
      setTyped("");
    },
    onError: (e) => {
      const d = describeError(e, "delete plan");
      toast.error(d.title, { description: d.description });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTyped(""); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-4 h-4" /> Delete membership plan
          </DialogTitle>
          <DialogDescription>
            This removes only the local metadata row. Stripe prices and existing subscriptions are unaffected — but the app will stop resolving this plan for new checkouts and members.
          </DialogDescription>
        </DialogHeader>

        {activeSubs > 0 && (
          <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <strong>{activeSubs}</strong> active or trialing subscriber{activeSubs === 1 ? "" : "s"} currently rely on this plan.
              Cancel or migrate them in Stripe before deleting, or the app will show missing-plan errors on their next renewal.
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs">
            Type the plan key <code className="text-foreground">{plan.key}</code> to confirm
          </Label>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={plan.key} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!canDelete || del.isPending}
            onClick={() => del.mutate()}
          >
            <Trash2 className="w-4 h-4 mr-1" /> {del.isPending ? "Deleting…" : "Delete plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useRecentRevenue() {
  return useQuery({
    queryKey: ["admin", "plan_recent_revenue"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("stripe_payments")
        .select("amount, currency, status, paid_at, stripe_subscription_id")
        .gte("paid_at", since)
        .eq("status", "succeeded" as never);
      if (error) return [] as { amount: number; currency: string; stripe_subscription_id: string | null }[];
      return (data ?? []) as { amount: number; currency: string; stripe_subscription_id: string | null }[];
    },
  });
}

function useSubscriptionsWithId() {
  return useQuery({
    queryKey: ["admin", "subs_with_id"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stripe_subscriptions")
        .select("stripe_subscription_id, stripe_price_id");
      if (error) throw error;
      return (data ?? []) as { stripe_subscription_id: string; stripe_price_id: string | null }[];
    },
  });
}

function usePlanRevenueMap() {
  const { data: payments = [] } = useRecentRevenue();
  const { data: subs = [] } = useSubscriptionsWithId();
  return useMemo(() => {
    const priceBySub = new Map<string, string>();
    for (const s of subs) if (s.stripe_price_id) priceBySub.set(s.stripe_subscription_id, s.stripe_price_id);
    const map: Record<string, number> = {};
    for (const p of payments) {
      const priceId = p.stripe_subscription_id ? priceBySub.get(p.stripe_subscription_id) : null;
      if (!priceId) continue;
      map[priceId] = (map[priceId] ?? 0) + (p.amount ?? 0);
    }
    return map;
  }, [payments, subs]);
}

function PlanOverviewCards() {
  const { data: plans = [] } = useAllMembershipPlans();
  const { data: priceMap = {} } = useStripePriceDefaults();
  const { data: subs = [] } = useSubscriberStats();
  const { data: payments = [] } = useRecentRevenue();

  const revenue30d = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const currency = payments[0]?.currency ?? "usd";
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

function PlanEditorCard({ plan, activeSubs }: { plan: PlanRow; activeSubs: number }) {
  const qc = useQueryClient();
  const { data: priceMap = {} } = useStripePriceDefaults();
  const price = priceMap[plan.key];
  const priceLabel = formatStripePriceLabel(price);

  const [draft, setDraft] = useState<PlanRow>(plan);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(plan), [draft, plan]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="w-4 h-4" />
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

      <DeletePlanDialog plan={plan} activeSubs={activeSubs} open={deleteOpen} onOpenChange={setDeleteOpen} />
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
  const { data: plans = [], isLoading } = useAllMembershipPlans();
  const { data: priceMap = {} } = useStripePriceDefaults();
  const { data: subs = [] } = useSubscriberStats();
  if (isLoading) return <p className="text-sm text-foreground/60">Loading plans…</p>;
  if (!plans.length) return <p className="text-sm text-foreground/60">No plans yet.</p>;
  const activeByPlanKey = (planKey: string) => {
    const priceId = priceMap[planKey]?.stripe_price_id;
    if (!priceId) return 0;
    return subs.filter((s) => s.stripe_price_id === priceId && ["active", "trialing"].includes(s.status)).length;
  };
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {plans.map((p) => <PlanEditorCard key={p.key} plan={p} activeSubs={activeByPlanKey(p.key)} />)}
    </div>
  );
}

/* ===== Diagnostics table used inside Advanced view ===== */
function PlanDiagnosticsTable() {
  const { data: plans = [] } = useAllMembershipPlans();
  const { data: priceMap = {} } = useStripePriceDefaults();
  const { data: subs = [] } = useSubscriberStats();
  const revenueMap = usePlanRevenueMap();

  type StatusFilter = "all" | "live" | "test" | "out";
  type SortKey = "name" | "subs" | "revenue";
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDesc, setSortDesc] = useState(false);

  const rows = useMemo(() => {
    const enriched = plans.map((plan) => {
      const price = priceMap[plan.key];
      const activeSubs = price
        ? subs.filter((s) => s.stripe_price_id === price.stripe_price_id && ["active", "trialing"].includes(s.status)).length
        : 0;
      const revenue30dCents = price ? (revenueMap[price.stripe_price_id] ?? 0) : 0;
      const bucket: StatusFilter = !price ? "out" : price.livemode ? "live" : "test";
      return { plan, price, activeSubs, revenue30dCents, bucket };
    });
    const filtered = status === "all" ? enriched : enriched.filter((r) => r.bucket === status);
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.plan.name.localeCompare(b.plan.name);
      else if (sortKey === "subs") cmp = a.activeSubs - b.activeSubs;
      else if (sortKey === "revenue") cmp = a.revenue30dCents - b.revenue30dCents;
      return sortDesc ? -cmp : cmp;
    });
  }, [plans, priceMap, subs, revenueMap, status, sortKey, sortDesc]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDesc((v) => !v);
    else { setSortKey(k); setSortDesc(k !== "name"); }
  }

  const counts = useMemo(() => {
    const c = { all: plans.length, live: 0, test: 0, out: 0 };
    for (const p of plans) {
      const price = priceMap[p.key];
      if (!price) c.out++;
      else if (price.livemode) c.live++;
      else c.test++;
    }
    return c;
  }, [plans, priceMap]);

  const currencyGuess = (Object.values(priceMap)[0]?.currency ?? "usd").toUpperCase();
  const fmtCents = (cents: number) =>
    (cents / 100).toLocaleString(undefined, { style: "currency", currency: currencyGuess, maximumFractionDigits: 0 });

  return (
    <Card className="p-0 overflow-hidden mb-4">
      <div className="px-4 py-3 border-b bg-muted/30 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium">Diagnostics</div>
          <div className="text-xs text-foreground/60">Live status per plan, resolved from Supabase + Stripe cache.</div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(["all", "live", "test", "out"] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={status === k ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setStatus(k)}
            >
              {k === "all" ? "All" : k === "live" ? "Live" : k === "test" ? "Test" : "Out of sync"}
              <span className="ml-1 text-[10px] opacity-70">({counts[k]})</span>
            </Button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-foreground/60">
            <tr className="border-b">
              <th className="text-left px-3 py-2">
                <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("name")}>
                  Plan <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-left px-3 py-2">Key</th>
              <th className="text-left px-3 py-2">Price status</th>
              <th className="text-left px-3 py-2">Price ID</th>
              <th className="text-right px-3 py-2">
                <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("subs")}>
                  Active subs <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-3 py-2">
                <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("revenue")}>
                  Revenue 30d <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ plan, price, activeSubs, revenue30dCents }) => (
              <tr key={plan.key} className="border-b last:border-0">
                <td className="px-3 py-2">{plan.name}{!plan.active && <span className="ml-2 text-[10px] text-foreground/50">(hidden)</span>}</td>
                <td className="px-3 py-2 font-mono text-xs">{plan.key}</td>
                <td className="px-3 py-2">
                  {price ? (
                    <Badge variant={price.livemode ? "default" : "secondary"}>{price.livemode ? "Live" : "Test"}</Badge>
                  ) : (
                    <Badge variant="destructive">Out of sync</Badge>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-foreground/60 max-w-[220px] truncate">{price?.stripe_price_id ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{activeSubs}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCents(revenue30dCents)}</td>
                <td className="px-3 py-2 text-right">
                  {price ? (
                    <Button size="sm" variant="ghost" onClick={() => openStripePrice(price.stripe_price_id, price.livemode)}>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => openStripeNewPrice(plan.key)}>
                      <Plus className="w-3 h-3 mr-1" /> Create
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-foreground/50 text-sm">No plans match this filter</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function AdminPlansInner({ embedded = false }: { embedded?: boolean }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  return (
    <div>
      <PlanOverviewCards />

      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h2 className="text-lg font-medium">Plan editor</h2>
          <p className="text-xs text-foreground/60">Metadata and perks shown on /plans. Prices come from Stripe.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setSyncOpen(true)}>
            <RefreshCw className="w-4 h-4 mr-1" /> Verify & sync with Stripe
          </Button>
          <Button size="sm" variant="outline" onClick={() => setReconcileOpen(true)}>
            <Wand2 className="w-4 h-4 mr-1" /> Auto-reconcile
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> New plan
          </Button>
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
          <PlanDiagnosticsTable />
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

      <SyncWithStripeDialog open={syncOpen} onOpenChange={setSyncOpen} />
      <NewPlanDialog open={newOpen} onOpenChange={setNewOpen} />
      <AutoReconcileDialog open={reconcileOpen} onOpenChange={setReconcileOpen} />
    </div>
  );
}

export default function AdminPlans() { return <AdminPlansInner />; }

/* ===== Auto-reconcile dialog ===== */
function AutoReconcileDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: plans = [] } = useAllMembershipPlans();
  const { data: priceMap = {} } = useStripePriceDefaults();
  const outOfSync = plans.filter((p) => !priceMap[p.key]);

  const [amountMap, setAmountMap] = useState<Record<string, string>>({});
  const [currency, setCurrency] = useState("usd");
  const [interval, setIntervalValue] = useState<"month" | "year" | "week">("month");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<{ key: string; status: "ok" | "err"; message: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, boolean> = {};
    for (const p of outOfSync) next[p.key] = true;
    setSelected(next);
    setLog([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outOfSync.length]);

  async function runReconcile() {
    setRunning(true);
    setLog([]);
    for (const plan of outOfSync) {
      if (!selected[plan.key]) continue;
      const amountDollars = Number(amountMap[plan.key]);
      if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
        setLog((l) => [...l, { key: plan.key, status: "err", message: "Enter a positive price" }]);
        continue;
      }
      try {
        const { data, error } = await supabase.functions.invoke("admin-stripe-plan-sync", {
          body: {
            action: "reconcile_plan",
            plan_key: plan.key,
            name: plan.name,
            description: plan.description ?? undefined,
            unit_amount: Math.round(amountDollars * 100),
            currency,
            interval,
            interval_count: 1,
          },
        });
        if (error) throw error;
        const res = data as { price_id: string };
        setLog((l) => [...l, { key: plan.key, status: "ok", message: `Created ${res.price_id}` }]);
      } catch (e) {
        setLog((l) => [...l, { key: plan.key, status: "err", message: (e as Error).message }]);
      }
    }
    setRunning(false);
    setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["public", "stripe_price_defaults"] });
      qc.invalidateQueries({ queryKey: ["admin"] });
    }, 2500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="w-4 h-4" /> Auto-reconcile with Stripe</DialogTitle>
          <DialogDescription>
            For each selected out-of-sync plan, creates (or reuses) a Product tagged with <code>metadata.plan_key</code>
            and a fresh recurring Price. The webhook activates it in <code>stripe_prices</code> automatically.
          </DialogDescription>
        </DialogHeader>

        {outOfSync.length === 0 ? (
          <p className="text-sm text-emerald-600 flex items-center gap-1"><Check className="w-4 h-4" /> All plans already have a mapped Stripe price.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Currency</Label>
                <Input className="mt-1 uppercase" value={currency} onChange={(e) => setCurrency(e.target.value.toLowerCase())} maxLength={3} />
              </div>
              <div>
                <Label className="text-xs">Billing interval</Label>
                <Select value={interval} onValueChange={(v) => setIntervalValue(v as "month" | "year" | "week")}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                    <SelectItem value="week">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="max-h-[40vh] overflow-auto space-y-2 mt-2">
              {outOfSync.map((plan) => {
                const entry = log.find((l) => l.key === plan.key);
                return (
                  <div key={plan.key} className="border rounded p-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!selected[plan.key]}
                      onChange={(e) => setSelected({ ...selected, [plan.key]: e.target.checked })}
                      disabled={running}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{plan.name}</div>
                      <div className="text-[10px] font-mono text-foreground/50 truncate">{plan.key}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-foreground/60">{currency.toUpperCase()}</span>
                      <Input
                        className="w-24 h-8"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="9.99"
                        value={amountMap[plan.key] ?? ""}
                        onChange={(e) => setAmountMap({ ...amountMap, [plan.key]: e.target.value })}
                        disabled={running}
                      />
                    </div>
                    {entry && (
                      entry.status === "ok" ? (
                        <Badge variant="default" className="ml-1">Live</Badge>
                      ) : (
                        <Badge variant="destructive" className="ml-1" title={entry.message}>Error</Badge>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {log.length > 0 && (
              <div className="text-xs text-foreground/60 mt-2">
                {log.filter((l) => l.status === "ok").length}/{log.length} reconciled — webhook will finalise the Live status.
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {outOfSync.length > 0 && (
            <Button onClick={runReconcile} disabled={running || !Object.values(selected).some(Boolean)}>
              {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
              {running ? "Reconciling…" : "Auto-reconcile"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
