import MemberLayout from "@/manus/components/MemberLayout";
import { useAuth } from "@/manus/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, LogOut, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { useMyProfile, useUpdateMyProfile, useMyMemberships } from "@/manus/hooks/usePublicContent";
import AvatarUpload from "@/manus/components/AvatarUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NOTIFICATION_PREFS = [
  { key: "reply", label: "Replies to my posts and comments" },
  { key: "mention", label: "Mentions of my name" },
  { key: "workshop_reminder", label: "Live workshop reminders" },
  { key: "billing", label: "Billing and subscription updates" },
] as const;

export default function Profile() {
  const navigate = useNavigate();
  const { user, isAdmin, logout, refreshAccess } = useAuth();
  const { data: profile, isLoading } = useMyProfile(user?.id);
  const update = useUpdateMyProfile(user?.id);
  const { data: memberships = [] } = useMyMemberships();

  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setDisplayName(profile.display_name ?? "");
    }
  }, [profile]);

  const onSave = async () => {
    await update.mutateAsync({ full_name: fullName || null, display_name: displayName || null });
    await refreshAccess();
  };

  const activeMembership = memberships.find(m => m.status === "active" || new Date(m.ends_at) > new Date());
  const prefs = (profile?.notification_prefs as Record<string, boolean> | null) ?? {};
  const setPref = async (key: string, next: boolean) => {
    await update.mutateAsync({ notification_prefs: { ...prefs, [key]: next } });
  };

  const [portalLoading, setPortalLoading] = useState(false);
  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-customer-portal-session", { body: {} });
      if (error) throw error;
      const url = (data as { portal_url?: string })?.portal_url;
      if (!url) throw new Error("No portal URL");
      window.location.href = url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Couldn't open billing portal", { description: msg.includes("NO_STRIPE_CUSTOMER") ? "You don't have an active Stripe subscription yet." : msg });
      setPortalLoading(false);
    }
  };

  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        <Link to="/dashboard" className="flex items-center gap-2 mb-8 text-sm" style={{ color: "var(--aa-text-mid)" }}>
          <ArrowLeft size={16} /><span>Back to Dashboard</span>
        </Link>

        <div className="mb-12">
          <h1 className="font-serif text-4xl md:text-5xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>Profile Settings</h1>
          <p className="text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif" }}>Manage your account information and preferences.</p>
        </div>

        <div className="max-w-2xl space-y-6">
          <div className="p-8" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
            <h2 className="font-serif text-2xl mb-6" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>Account Information</h2>

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--aa-text-mid)" }}><Loader2 className="animate-spin" size={16} /> Loading…</div>
            ) : (
              <div className="space-y-6">
                {user && (
                  <div>
                    <label className="text-xs mb-2 block uppercase tracking-wider" style={{ color: "var(--aa-text-light)" }}>Profile picture</label>
                    <AvatarUpload
                      userId={user.id}
                      currentUrl={profile?.avatar_path ?? null}
                      displayName={displayName || fullName || user.email || "Member"}
                      onChange={async (newUrl) => {
                        await update.mutateAsync({ avatar_path: newUrl });
                      }}
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs mb-2 block uppercase tracking-wider" style={{ color: "var(--aa-text-light)" }}>Full Name</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2 text-sm" style={{ backgroundColor: "var(--aa-white)", color: "var(--aa-text-dark)", border: "1px solid var(--aa-cream-dark)" }} />
                </div>
                <div>
                  <label className="text-xs mb-2 block uppercase tracking-wider" style={{ color: "var(--aa-text-light)" }}>Display Name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2 text-sm" style={{ backgroundColor: "var(--aa-white)", color: "var(--aa-text-dark)", border: "1px solid var(--aa-cream-dark)" }} />
                </div>
                <div>
                  <label className="text-xs mb-2 block uppercase tracking-wider" style={{ color: "var(--aa-text-light)" }}>Email Address</label>
                  <input type="email" value={user?.email ?? ""} disabled
                    className="w-full px-4 py-2 text-sm" style={{ backgroundColor: "var(--aa-cream-dark)", color: "var(--aa-text-mid)", border: "1px solid var(--aa-cream-dark)" }} />
                </div>
                <div>
                  <label className="text-xs mb-2 block uppercase tracking-wider" style={{ color: "var(--aa-text-light)" }}>Current Plan</label>
                  <div className="px-4 py-2 text-sm" style={{ backgroundColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)", border: "1px solid var(--aa-cream-dark)", fontWeight: 500 }}>
                    {isAdmin ? "Administrator — full access" : activeMembership ? `${activeMembership.plan_key} (until ${new Date(activeMembership.ends_at).toLocaleDateString()})` : "Free"}
                  </div>
                </div>
                <button onClick={onSave} disabled={update.isPending}
                  className="px-6 py-2 rounded text-sm font-medium disabled:opacity-60"
                  style={{ backgroundColor: "var(--aa-olive-dark)", color: "white" }}>
                  {update.isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>

          <div className="p-8" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
            <h2 className="font-serif text-2xl mb-4" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>Security</h2>
            <button onClick={() => navigate("/forgot-password")}
              className="w-full px-4 py-3 text-left text-sm"
              style={{ backgroundColor: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)", border: "1px solid var(--aa-cream-dark)", fontWeight: 500 }}>
              Change Password
            </button>
          </div>

          {!isAdmin && activeMembership && (
            <div className="p-8" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
              <h2 className="font-serif text-2xl mb-2" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>Billing</h2>
              <p className="text-sm mb-4" style={{ color: "var(--aa-text-mid)" }}>Update your card, download invoices, or cancel your subscription in the Stripe billing portal.</p>
              <button onClick={openPortal} disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-3 text-sm disabled:opacity-60"
                style={{ backgroundColor: "var(--aa-olive-dark)", color: "white", fontWeight: 500 }}>
                {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                {portalLoading ? "Opening…" : "Manage subscription"}
              </button>
            </div>
          )}

          <div className="p-8" style={{ border: "1px solid var(--aa-cream-dark)", backgroundColor: "var(--aa-white)" }}>
            <h2 className="font-serif text-2xl mb-4" style={{ color: "var(--aa-olive-dark)", fontWeight: 400 }}>Session</h2>
            <button onClick={async () => { await logout(); navigate("/login"); }}
              className="flex items-center gap-2 px-4 py-3 text-sm"
              style={{ backgroundColor: "var(--aa-olive-dark)", color: "white", fontWeight: 500 }}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </MemberLayout>
  );
}
