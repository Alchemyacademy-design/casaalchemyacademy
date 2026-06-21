import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";

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
      return (data ?? []).filter((r: any) => !r.ends_at || r.ends_at > nowIso);
    },
  });

  return useMemo<Entitlements>(() => {
    const activeMembership = (memberships.data ?? [])[0];
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
      planKey: (activeMembership?.plan_key as string | undefined) ?? null,
      courseIds: (entitlementsQ.data ?? []).map((r: any) => Number(r.course_id)).filter(Boolean),
      loading: !!uid && (memberships.isLoading || entitlementsQ.isLoading),
    };
  }, [isAuthenticated, isAdmin, uid, memberships.data, memberships.isLoading, entitlementsQ.data, entitlementsQ.isLoading]);
}
