import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";
import { usePreviewPlan } from "@/manus/lib/admin-preview";

/**
 * Single source of truth for what the current user can access.
 * Reads `user_roles`, `memberships` and `course_entitlements` directly.
 */
export type Entitlements = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMember: boolean;
  hasCommunity: boolean;
  hasEvents: boolean;
  hasWorkshops: boolean;
  hasMagazine: boolean;
  hasDeals: boolean;
  planKey: string | null;
  courseIds: number[];
  loading: boolean;
};

export function useEntitlements(): Entitlements {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const uid = user?.id ?? null;
  const previewPlan = usePreviewPlan();

  const memberships = useQuery({
    queryKey: ["entitlements", "memberships", uid],
    enabled: !!uid,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("memberships")
        .select("*")
        .eq("user_id", uid!)
        .in("status", ["active", "trialing", "past_due"])
        .or(`ends_at.is.null,ends_at.gt.${nowIso}`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const entitlementsQ = useQuery({
    queryKey: ["entitlements", "courses", uid],
    enabled: !!uid,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("course_entitlements")
        .select("course_id, status, ends_at")
        .eq("user_id", uid!)
        .in("status", ["active", "granted", "paid"]) ;
      if (error) throw error;
      type Row = { course_id: number | string; status: string; ends_at: string | null };
      return ((data ?? []) as unknown as Row[]).filter((r) => !r.ends_at || r.ends_at > nowIso);
    },
  });

  return useMemo<Entitlements>(() => {
    // Admin "view as member" override — only applies to admins.
    if (isAdmin && previewPlan) {
      if (previewPlan === "none") {
        return { isAuthenticated: false, isAdmin: false, isMember: false,
          hasCommunity: false, hasEvents: false, hasWorkshops: false,
          hasMagazine: false, hasDeals: false, planKey: null, courseIds: [], loading: false };
      }
      const asMember = previewPlan !== "free";
      return { isAuthenticated: true, isAdmin: false, isMember: asMember,
        hasCommunity: asMember, hasEvents: asMember, hasWorkshops: asMember,
        hasMagazine: asMember, hasDeals: asMember,
        planKey: previewPlan === "free" ? null : previewPlan,
        courseIds: [], loading: false };
    }
    const activeMembership = (memberships.data ?? [])[0] as { plan_key?: string | null } | undefined;
    const isMember = isAdmin || !!activeMembership;
    return {
      isAuthenticated,
      isAdmin,
      isMember,
      hasCommunity: isMember,
      hasEvents: isMember,
      hasWorkshops: isMember,
      hasMagazine: isMember,
      hasDeals: isMember,
      planKey: activeMembership?.plan_key ?? null,
      courseIds: (entitlementsQ.data ?? []).map((r) => Number(r.course_id)).filter(Boolean),
      loading: !!uid && (memberships.isLoading || entitlementsQ.isLoading),
    };
  }, [isAuthenticated, isAdmin, uid, previewPlan, memberships.data, memberships.isLoading, entitlementsQ.data, entitlementsQ.isLoading]);
}
