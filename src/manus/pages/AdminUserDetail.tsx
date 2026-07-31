import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAuditSafe, type AuditResult } from "@/manus/lib/admin-audit-safe";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, ShieldCheck, ShieldOff, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/manus/hooks/useAuth";
import {
  DESIGNATED_ADMIN_EMAIL,
  isDesignatedAdminEmail,
  maskStripeId,
  manageStripeSubscription,
  manageUserAccess,
  deleteUserAccount,
} from "@/manus/lib/admin-api";
import { toast } from "sonner";

export default function AdminUserDetail() {
  const { id: userId = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, loading, user: actor } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = useMemo(() => ["admin", "user", userId], [userId]);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: !!userId && isAdmin,
    queryFn: async () => {
      const [
        { data: profile },
        { data: roles },
        { data: memberships },
        { data: entitlements },
        { data: customer },
        { data: subscription },
        { data: payments },
        { data: courses },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("memberships").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("course_entitlements").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("stripe_customers").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("stripe_subscriptions").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("stripe_payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        supabase.from("courses").select("id,title").eq("status", "published").order("sort_order"),
      ]);
      const audit = await fetchAuditSafe({ targetUserId: userId, limit: 50 });
      return {
        profile,
        roles: (roles ?? []).map((r) => r.role),
        memberships: memberships ?? [],
        entitlements: entitlements ?? [],
        customer,
        subscription,
        payments: payments ?? [],
        courses: courses ?? [],
        audit: audit as AuditResult,
      };
    },
  });

  const [busy, setBusy] = useState<string | null>(null);
  const [grantPlan, setGrantPlan] = useState<"monthly_member" | "annual_member">("monthly_member");
  const [grantReason, setGrantReason] = useState("");
  const [grantCourseId, setGrantCourseId] = useState<string>("");
  const [grantCourseDays, setGrantCourseDays] = useState("90");
  const [confirmDialog, setConfirmDialog] = useState<null | "cancel_period" | "cancel_now" | "demote" | "delete_user">(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deleteReason, setDeleteReason] = useState("");

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!isAdmin) { navigate("/"); return null; }
  if (!data && !isLoading) return <div className="p-10">User not found.</div>;

  const profile = data?.profile;
  const roles = data?.roles ?? [];
  const isDesignated = isDesignatedAdminEmail(profile?.email);
  const targetIsAdmin = roles.includes("admin");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    refetch();
  };

  const handle = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      toast.success(`${label} ok`);
      refresh();
    } catch (e) {
      toast.error(`${label} failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const promote = () =>
    handle("Promote to admin", () =>
      manageUserAccess({ action: "promote_admin", target_user_id: userId }),
    );

  const demote = () => {
    if (isDesignated) return toast.error("Designated platform admin cannot be demoted.");
    setConfirmDialog("demote");
  };

  const confirmDemote = () =>
    handle("Demote to student", () =>
      manageUserAccess({ action: "demote_admin", target_user_id: userId }),
    ).finally(() => setConfirmDialog(null));

  const grantMembership = () =>
    handle("Grant membership", () =>
      manageUserAccess({
        action: "grant_membership",
        target_user_id: userId,
        plan_key: grantPlan,
        reason: grantReason || undefined,
      }),
    );

  const grantCourse = () => {
    const cid = Number(grantCourseId);
    if (!cid) return toast.error("Choose a course");
    const days = Math.max(1, Number(grantCourseDays) || 90);
    const now = new Date();
    const ends = new Date(now.getTime() + days * 86400000);
    return handle("Grant course access", () =>
      manageUserAccess({
        action: "grant_course_entitlement",
        target_user_id: userId,
        course_id: cid,
        starts_at: now.toISOString(),
        ends_at: ends.toISOString(),
        reason: grantReason || undefined,
      }),
    );
  };

  const revokeMembership = (id: number) =>
    handle("Revoke membership", () =>
      manageUserAccess({ action: "revoke_membership", target_user_id: userId, membership_id: id }),
    );

  const revokeEntitlement = (id: number) =>
    handle("Revoke entitlement", () =>
      manageUserAccess({ action: "revoke_course_entitlement", target_user_id: userId, entitlement_id: id }),
    );

  const cancelAtPeriodEnd = () => setConfirmDialog("cancel_period");
  const cancelImmediately = () => setConfirmDialog("cancel_now");

  const confirmDeleteUser = async () => {
    setBusy("Delete user");
    try {
      await deleteUserAccount(userId, deleteEmail.trim(), deleteReason || undefined);
      toast.success("User deleted permanently");
      setConfirmDialog(null);
      setDeleteEmail("");
      setDeleteReason("");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      navigate("/admin/students");
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const runStripe = (action: "cancel_at_period_end" | "cancel_immediately" | "resync_subscription") => {
    const subId = data?.subscription?.stripe_subscription_id;
    if (!subId) return toast.error("No Stripe subscription on file");
    return handle(action, () =>
      manageStripeSubscription({
        action,
        target_user_id: userId,
        stripe_subscription_id: subId,
        confirmation_email: action === "cancel_immediately" ? confirmEmail : undefined,
      }),
    ).finally(() => {
      setConfirmDialog(null);
      setConfirmEmail("");
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card">
        <div className="container flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{profile?.display_name || profile?.full_name || profile?.email || userId}</h1>
              <p className="text-xs text-foreground/60">{userId}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {targetIsAdmin ? (
              <Button variant="outline" onClick={demote} disabled={isDesignated || !!busy}>
                <ShieldOff className="w-4 h-4 mr-2" />
                Demote to student
              </Button>
            ) : (
              <Button onClick={promote} disabled={!!busy}>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Promote to admin
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8">
        {isDesignated && (
          <Card className="p-4 mb-6 border-accent/40 bg-accent/5 text-sm">
            Designated platform administrator. Role is permanent and cannot be removed.
          </Card>
        )}

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="access">Access</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="p-6 grid md:grid-cols-2 gap-4 text-sm">
              <div><span className="text-foreground/60">Email:</span> {profile?.email ?? "—"}</div>
              <div><span className="text-foreground/60">Name:</span> {profile?.full_name ?? "—"}</div>
              <div><span className="text-foreground/60">Role:</span> {roles.join(", ") || "student"}</div>
              <div><span className="text-foreground/60">Joined:</span> {profile?.created_at ? new Date(profile.created_at).toLocaleString() : "—"}</div>
              <div><span className="text-foreground/60">Stripe customer:</span> {maskStripeId(data?.customer?.stripe_customer_id)}</div>
              <div><span className="text-foreground/60">Stripe subscription:</span> {maskStripeId(data?.subscription?.stripe_subscription_id)}</div>
            </Card>
          </TabsContent>

          <TabsContent value="access">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-medium mb-3">Grant membership (manual)</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <Label>Plan</Label>
                    <select className="w-full mt-1 border rounded px-2 py-2 bg-background" value={grantPlan} onChange={(e) => setGrantPlan(e.target.value as "monthly_member" | "annual_member")}>
                      <option value="monthly_member">monthly_member (30 days)</option>
                      <option value="annual_member">annual_member (365 days)</option>
                    </select>
                  </div>
                  <div>
                    <Label>Reason (optional)</Label>
                    <Input value={grantReason} onChange={(e) => setGrantReason(e.target.value)} />
                  </div>
                  <Button onClick={grantMembership} disabled={!!busy}>Grant membership</Button>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-medium mb-3">Current memberships</h3>
                <ul className="space-y-2 text-sm">
                  {(data?.memberships ?? []).map((m) => (
                    <li key={m.id} className="flex items-center justify-between border-b border-border/30 py-2">
                      <div>
                        <div>{m.plan_key} · {m.status} · {m.source}</div>
                        <div className="text-xs text-foreground/60">until {m.ends_at ? new Date(m.ends_at).toLocaleDateString() : "—"}</div>
                      </div>
                      {m.source === "manual" && m.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => revokeMembership(m.id as number)} disabled={!!busy}>Revoke</Button>
                      )}
                    </li>
                  ))}
                  {(data?.memberships ?? []).length === 0 && <li className="text-foreground/60">None.</li>}
                </ul>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="courses">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-medium mb-3">Grant course access (manual)</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <Label>Course</Label>
                    <select className="w-full mt-1 border rounded px-2 py-2 bg-background" value={grantCourseId} onChange={(e) => setGrantCourseId(e.target.value)}>
                      <option value="">— select —</option>
                      {(data?.courses ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Days</Label>
                    <Input type="number" min={1} value={grantCourseDays} onChange={(e) => setGrantCourseDays(e.target.value)} />
                  </div>
                  <div>
                    <Label>Reason (optional)</Label>
                    <Input value={grantReason} onChange={(e) => setGrantReason(e.target.value)} />
                  </div>
                  <Button onClick={grantCourse} disabled={!!busy}>Grant course access</Button>
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-medium mb-3">Active entitlements</h3>
                <ul className="space-y-2 text-sm">
                  {(data?.entitlements ?? []).map((e) => (
                    <li key={e.id} className="flex items-center justify-between border-b border-border/30 py-2">
                      <div>
                        <div>Course #{e.course_id} · {e.active ? "active" : "inactive"} · {e.source}</div>
                        <div className="text-xs text-foreground/60">until {e.ends_at ? new Date(e.ends_at).toLocaleDateString() : "—"}</div>
                      </div>
                      {e.source === "manual" && e.active && (
                        <Button size="sm" variant="outline" onClick={() => revokeEntitlement(e.id as number)} disabled={!!busy}>Revoke</Button>
                      )}
                    </li>
                  ))}
                  {(data?.entitlements ?? []).length === 0 && <li className="text-foreground/60">None.</li>}
                </ul>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="billing">
            <Card className="p-6">
              <div className="grid md:grid-cols-3 gap-3 text-sm mb-6">
                <div><span className="text-foreground/60">Status:</span> {data?.subscription?.status ?? "—"}</div>
                <div><span className="text-foreground/60">Period end:</span> {data?.subscription?.current_period_end ? new Date(data.subscription.current_period_end).toLocaleString() : "—"}</div>
                <div><span className="text-foreground/60">Cancel at period end:</span> {String(data?.subscription?.cancel_at_period_end ?? false)}</div>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                <Button variant="outline" onClick={() => runStripe("resync_subscription")} disabled={!data?.subscription?.stripe_subscription_id || !!busy}>Resync Stripe</Button>
                <Button variant="outline" onClick={cancelAtPeriodEnd} disabled={!data?.subscription?.stripe_subscription_id || !!busy}>Cancel at period end</Button>
                <Button variant="destructive" onClick={cancelImmediately} disabled={!data?.subscription?.stripe_subscription_id || !!busy}>Cancel immediately</Button>
              </div>

              <h3 className="font-medium mb-2">Recent payments</h3>
              <ul className="space-y-1 text-sm">
                {(data?.payments ?? []).map((p) => (
                  <li key={p.id} className="flex justify-between border-b border-border/30 py-1">
                    <span>{new Date(p.created_at).toLocaleString()}</span>
                    <span>{p.status} · {(Number(p.amount ?? 0) / 100).toFixed(2)} {p.currency?.toUpperCase()}</span>
                  </li>
                ))}
                {(data?.payments ?? []).length === 0 && <li className="text-foreground/60">No payments on file.</li>}
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card className="p-6">
              {!data ? (
                <p className="text-sm text-foreground/60">Loading…</p>
              ) : !data.audit.available ? (
                <p className="text-sm text-foreground/60">
                  Audit log unavailable ({data.audit.reason}): {data.audit.message}.
                </p>
              ) : data.audit.rows.length === 0 ? (
                <p className="text-sm text-foreground/60">No actions recorded for this user.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.audit.rows.map((a) => (
                    <li key={a.id} className="border-b border-border/30 py-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{a.action}</span>
                        <span className="text-xs text-foreground/60">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-foreground/60">{a.entity_type} {a.entity_id} {a.reason ? `· ${a.reason}` : ""}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        {/* Danger zone — permanent account removal */}
        <Card className="p-6 mt-8 border-destructive/40">
          <h3 className="font-medium text-destructive flex items-center gap-2 mb-2">
            <Trash2 className="w-4 h-4" /> Danger zone
          </h3>
          <p className="text-sm text-foreground/70 mb-4">
            Permanently delete this account and all of its access (memberships, course entitlements,
            roles, progress, community activity). This cannot be undone.
          </p>
          <Button
            variant="destructive"
            disabled={isDesignated || !!busy || userId === actor?.id}
            onClick={() => setConfirmDialog("delete_user")}
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete user permanently
          </Button>
          {(isDesignated || userId === actor?.id) && (
            <p className="text-xs text-foreground/60 mt-2">
              {isDesignated ? "Designated platform admin cannot be deleted." : "You cannot delete your own account."}
            </p>
          )}
        </Card>
      </main>

      {/* Confirmation dialogs */}
      <Dialog open={confirmDialog === "cancel_period"} onOpenChange={(o) => !o && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel at end of period?</DialogTitle>
            <DialogDescription>
              The subscription will remain active until the end of the current billing period. Access continues until then.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button onClick={() => runStripe("cancel_at_period_end")} disabled={!!busy}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog === "cancel_now"} onOpenChange={(o) => { if (!o) { setConfirmDialog(null); setConfirmEmail(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel immediately?</DialogTitle>
            <DialogDescription>
              This cancels the Stripe subscription now and may revoke access right away. No refund is issued. Type the user&apos;s email to confirm:
              <br /><span className="font-mono text-xs">{profile?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder={profile?.email ?? ""} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setConfirmDialog(null); setConfirmEmail(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => runStripe("cancel_immediately")} disabled={!!busy || confirmEmail.trim().toLowerCase() !== (profile?.email ?? "").trim().toLowerCase()}>Confirm cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog === "demote"} onOpenChange={(o) => !o && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demote admin to student?</DialogTitle>
            <DialogDescription>
              {userId === actor?.id
                ? "You are about to remove your own admin role. You will lose access to the admin panel."
                : `Removes admin role from ${profile?.email}. They will lose admin access.`}
              {DESIGNATED_ADMIN_EMAIL === (profile?.email ?? "").toLowerCase() && " — designated platform admin cannot be demoted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDemote} disabled={!!busy || isDesignated}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDialog === "delete_user"}
        onOpenChange={(o) => { if (!o) { setConfirmDialog(null); setDeleteEmail(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete user permanently?</DialogTitle>
            <DialogDescription>
              This removes the login, the profile and every access record for this person.
              Stripe history is kept for accounting. Type the user&apos;s email to confirm:
              <br /><span className="font-mono text-xs">{profile?.email}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} placeholder={profile?.email ?? ""} />
            <div>
              <Label className="text-xs">Reason (optional)</Label>
              <Input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="e.g. test account cleanup" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setConfirmDialog(null); setDeleteEmail(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteUser}
              disabled={!!busy || deleteEmail.trim().toLowerCase() !== (profile?.email ?? "").trim().toLowerCase()}
            >
              {busy === "Delete user" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
