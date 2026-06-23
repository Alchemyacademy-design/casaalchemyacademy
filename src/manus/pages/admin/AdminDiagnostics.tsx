import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import AdminShell from "@/manus/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/manus/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getCoursesTree, type AdminCatalog } from "@/manus/services/admin-content";

const PROJECT_REF = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ?? "—";
const MASTER_ADMIN_EMAIL = "contact@casaalchemystudio.com";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-b-0">
      <span className="text-xs uppercase tracking-[0.12em] text-foreground/55">{label}</span>
      <span className="text-sm font-mono text-right break-all">{value}</span>
    </div>
  );
}

function yn(v: boolean | undefined | null) {
  if (v === undefined || v === null) return "—";
  return v ? "yes" : "no";
}

type SecretFlag = { configured: boolean; prefixValid?: boolean; environmentCompatible?: boolean; urlValid?: boolean };
type BillingStatus = {
  stripeRuntimeMode: "test" | "live";
  stripeExpectedLivemode: "test" | "live";
  stripeLiveEnabled: boolean;
  secrets: {
    stripeSecret: SecretFlag;
    stripeWebhookSecret: SecretFlag;
    stripeExpectedLivemode: SecretFlag;
    stripeLiveEnabled: SecretFlag;
    checkoutAllowedOrigin: SecretFlag;
    checkoutSuccessUrl: SecretFlag;
    checkoutCancelUrl: SecretFlag;
    urlsShareOrigin: boolean;
  };
  prices: {
    monthly: { mapped: boolean; termsValid: boolean };
    annual: { mapped: boolean; termsValid: boolean };
    individual: { mapped: boolean; termsValid: boolean };
  };
  functions: {
    checkout: { functionConfigured: boolean; functionDeploymentKnown: boolean; functionOperationallyTested: boolean; deploymentStatus: string };
    webhook:  { functionConfigured: boolean; functionDeploymentKnown: boolean; functionOperationallyTested: boolean; deploymentStatus: string };
  };
  operations: {
    processedWebhookCount: number;
    failedWebhookCount: number;
    lastWebhookStatus: string | null;
    lastWebhookAt: string | null;
    completedCheckoutSessionCount: number;
    succeededPaymentCount: number;
    activeMembershipCount: number;
  };
  configurationReady: boolean;
  checkoutGateEnabled: boolean;
  operationallyValidated: boolean;
};

export default function AdminDiagnostics() {
  const auth = useAuth();
  const [authMeStatus, setAuthMeStatus] = useState<{ ok: boolean; status?: number; error?: string } | null>(null);
  const [authMeChecking, setAuthMeChecking] = useState(false);

  const catalog = useQuery<AdminCatalog>({
    queryKey: ["admin", "diagnostics-catalog", auth.session?.user.id ?? null],
    queryFn: getCoursesTree,
    enabled: auth.authReady && auth.accessReady && auth.isAdmin && !!auth.session,
    retry: 1,
    refetchOnMount: "always",
  });

  const billing = useQuery<BillingStatus>({
    queryKey: ["admin", "billing-config-status", auth.session?.user.id ?? null],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<BillingStatus>("billing-config-status", { method: "POST" });
      if (error) throw error;
      if (!data) throw new Error("billing-config-status returned empty body");
      return data;
    },
    enabled: auth.authReady && auth.accessReady && auth.isAdmin && !!auth.session,
    retry: 1,
  });

  const pingAuthMe = useCallback(async () => {
    setAuthMeChecking(true);
    try {
      const { error } = await supabase.functions.invoke("auth-me", { method: "POST" });
      setAuthMeStatus({ ok: !error, error: error?.message });
    } catch (err) {
      setAuthMeStatus({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setAuthMeChecking(false);
    }
  }, []);

  useEffect(() => {
    if (auth.session) void pingAuthMe();
  }, [auth.session, pingAuthMe]);

  const b = billing.data;
  const report = {
    user_id: auth.session?.user.id ?? null,
    email: auth.session?.user.email ?? null,
    session_exists: !!auth.session,
    authReady: auth.authReady,
    accessReady: auth.accessReady,
    accessSource: auth.accessSource,
    roles: auth.roles,
    isAdmin: auth.isAdmin,
    project_ref: PROJECT_REF,
    auth_me: authMeStatus,
    counts: catalog.data?.counts ?? null,
    catalog_source: catalog.data?.source ?? null,
    billing: b ?? null,
    error: auth.error ?? (catalog.error instanceof Error ? catalog.error.message : null),
  };
  const signedInWithDifferentAccount = Boolean(
    report.email && report.email.toLowerCase() !== MASTER_ADMIN_EMAIL,
  );

  return (
    <AdminShell title="Diagnostics" description="Admin authorization + content catalog + Stripe billing health." crumbs={[{ label: "Diagnostics" }]}>
      {signedInWithDifferentAccount && (
        <Card className="p-4 mb-4 border-amber-300 bg-amber-50 text-sm text-amber-900">
          You are signed in with a different account.
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-serif text-lg mb-3">Authorization</h3>
          <Row label="User ID" value={report.user_id ?? "—"} />
          <Row label="Email" value={report.email ?? "—"} />
          <Row label="Session" value={report.session_exists ? "yes" : "no"} />
          <Row label="authReady" value={String(report.authReady)} />
          <Row label="accessReady" value={String(report.accessReady)} />
          <Row label="accessSource" value={report.accessSource ?? "—"} />
          <Row label="Roles" value={report.roles.length ? report.roles.join(", ") : "—"} />
          <Row label="isAdmin" value={String(report.isAdmin)} />
          <Row label="Project Ref" value={PROJECT_REF} />
          <Row
            label="auth-me"
            value={
              authMeChecking ? "checking…" : authMeStatus
                ? authMeStatus.ok ? "ok" : `error: ${authMeStatus.error ?? "unknown"}`
                : "—"
            }
          />
          {report.error && <Row label="Last error" value={<span className="text-destructive">{report.error}</span>} />}
        </Card>

        <Card className="p-4">
          <h3 className="font-serif text-lg mb-3">Content catalog</h3>
          <Row label="Source" value={catalog.data?.source ?? (catalog.isLoading ? "loading…" : "—")} />
          <Row label="Courses" value={catalog.data?.counts.courses ?? "—"} />
          <Row label="Modules" value={catalog.data?.counts.modules ?? "—"} />
          <Row label="Lessons" value={catalog.data?.counts.lessons ?? "—"} />
          <Row label="Published courses" value={catalog.data?.counts.published_courses ?? "—"} />
          <Row label="Draft courses" value={catalog.data?.counts.draft_courses ?? "—"} />
          <Row label="Lessons missing video" value={catalog.data?.counts.missing_video_urls ?? "—"} />
          {catalog.error instanceof Error && (
            <Row label="Catalog error" value={<span className="text-destructive">{catalog.error.message}</span>} />
          )}
        </Card>

        <Card className="p-4 md:col-span-2">
          <h3 className="font-serif text-lg mb-3">Stripe — readiness (layered, honest)</h3>
          <p className="text-xs text-foreground/55 mb-3">
            Booleans only. Secret values, key prefixes and lengths are never shown here.
            Function deployment is reported as <span className="font-mono">unknown_from_runtime</span> unless a
            real call has landed in the database.
          </p>
          <Row label="Runtime mode" value={b?.stripeRuntimeMode ?? (billing.isLoading ? "loading…" : "—")} />
          <Row label="Expected livemode" value={b?.stripeExpectedLivemode ?? "—"} />
          <Row label="STRIPE_LIVE_ENABLED" value={b ? yn(b.stripeLiveEnabled) : "—"} />
          <Row label="configurationReady" value={b ? yn(b.configurationReady) : "—"} />
          <Row label="checkoutGateEnabled" value={b ? yn(b.checkoutGateEnabled) : "—"} />
          <Row label="operationallyValidated" value={b ? yn(b.operationallyValidated) : "—"} />
        </Card>

        <Card className="p-4">
          <h3 className="font-serif text-lg mb-3">Secrets (presence + shape only)</h3>
          <Row label="STRIPE_SECRET_KEY" value={b ? `${yn(b.secrets.stripeSecret.configured)} · prefix ${yn(b.secrets.stripeSecret.prefixValid)} · env ${yn(b.secrets.stripeSecret.environmentCompatible)}` : "—"} />
          <Row label="STRIPE_WEBHOOK_SECRET" value={b ? `${yn(b.secrets.stripeWebhookSecret.configured)} · prefix ${yn(b.secrets.stripeWebhookSecret.prefixValid)} · env ${yn(b.secrets.stripeWebhookSecret.environmentCompatible)}` : "—"} />
          <Row label="STRIPE_EXPECTED_LIVEMODE" value={b ? yn(b.secrets.stripeExpectedLivemode.configured) : "—"} />
          <Row label="STRIPE_LIVE_ENABLED (configured)" value={b ? yn(b.secrets.stripeLiveEnabled.configured) : "—"} />
          <Row label="CHECKOUT_ALLOWED_ORIGIN" value={b ? `${yn(b.secrets.checkoutAllowedOrigin.configured)} · url ${yn(b.secrets.checkoutAllowedOrigin.urlValid)}` : "—"} />
          <Row label="CHECKOUT_SUCCESS_URL" value={b ? `${yn(b.secrets.checkoutSuccessUrl.configured)} · url ${yn(b.secrets.checkoutSuccessUrl.urlValid)}` : "—"} />
          <Row label="CHECKOUT_CANCEL_URL" value={b ? `${yn(b.secrets.checkoutCancelUrl.configured)} · url ${yn(b.secrets.checkoutCancelUrl.urlValid)}` : "—"} />
          <Row label="URLs share origin" value={b ? yn(b.secrets.urlsShareOrigin) : "—"} />
        </Card>

        <Card className="p-4">
          <h3 className="font-serif text-lg mb-3">Canonical prices (live defaults)</h3>
          <Row label="monthly_member"    value={b ? `mapped ${yn(b.prices.monthly.mapped)} · terms ${yn(b.prices.monthly.termsValid)}` : "—"} />
          <Row label="annual_member"     value={b ? `mapped ${yn(b.prices.annual.mapped)} · terms ${yn(b.prices.annual.termsValid)}` : "—"} />
          <Row label="individual_course" value={b ? `mapped ${yn(b.prices.individual.mapped)} · terms ${yn(b.prices.individual.termsValid)}` : "—"} />
        </Card>

        <Card className="p-4 md:col-span-2">
          <h3 className="font-serif text-lg mb-3">Edge functions (honest)</h3>
          <Row label="checkout function" value={b ? `configured ${yn(b.functions.checkout.functionConfigured)} · deployment known ${yn(b.functions.checkout.functionDeploymentKnown)} · ops-tested ${yn(b.functions.checkout.functionOperationallyTested)} · status ${b.functions.checkout.deploymentStatus}` : "—"} />
          <Row label="webhook function"  value={b ? `configured ${yn(b.functions.webhook.functionConfigured)} · deployment known ${yn(b.functions.webhook.functionDeploymentKnown)} · ops-tested ${yn(b.functions.webhook.functionOperationallyTested)} · status ${b.functions.webhook.deploymentStatus}` : "—"} />
        </Card>

        <Card className="p-4 md:col-span-2">
          <h3 className="font-serif text-lg mb-3">Operational evidence</h3>
          <Row label="Processed webhooks (live)" value={b?.operations.processedWebhookCount ?? "—"} />
          <Row label="Failed webhooks" value={b?.operations.failedWebhookCount ?? "—"} />
          <Row label="Last webhook status" value={b?.operations.lastWebhookStatus ?? "—"} />
          <Row label="Last webhook at" value={b?.operations.lastWebhookAt ?? "—"} />
          <Row label="Completed checkout sessions" value={b?.operations.completedCheckoutSessionCount ?? "—"} />
          <Row label="Succeeded payments (live)" value={b?.operations.succeededPaymentCount ?? "—"} />
          <Row label="Active memberships" value={b?.operations.activeMembershipCount ?? "—"} />
          {billing.error instanceof Error && (
            <Row label="Billing status error" value={<span className="text-destructive">{billing.error.message}</span>} />
          )}
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void auth.refreshAccess()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh access
        </Button>
        <Button variant="outline" onClick={() => void pingAuthMe()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Re-test auth-me
        </Button>
        <Button variant="outline" onClick={() => void catalog.refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Reload courses
        </Button>
        <Button variant="outline" onClick={() => void billing.refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Re-check billing
        </Button>
        <Button
          variant="outline"
          onClick={() => void navigator.clipboard.writeText(JSON.stringify(report, null, 2))}
        >
          <Copy className="w-4 h-4 mr-1" /> Copy diagnostic report
        </Button>
      </div>
    </AdminShell>
  );
}
