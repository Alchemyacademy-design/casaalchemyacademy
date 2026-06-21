import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trpc } from "@/manus/lib/trpc";
import type { Session, User } from "@supabase/supabase-js";

export interface ActiveEntitlement {
  id: number;
  course_id: number;
  starts_at: string;
  ends_at: string;
  stripe_checkout_session_id?: string | null;
  stripe_price_id?: string | null;
}

export interface AuthUser extends User {
  name?: string;
  membershipTier?: string;
  profile?: {
    full_name?: string | null;
    display_name?: string | null;
    avatar_path?: string | null;
    email?: string | null;
  } | null;
  roles?: string[];
  role?: string;
  membership?: {
    plan_key?: string;
    status: string;
    ends_at: string;
  } | null;
  activeEntitlements?: ActiveEntitlement[];
}

function mergeUser(user: User, profileData: any): AuthUser {
  const profile = profileData?.profile ?? null;
  const membership = profileData?.membership ?? null;
  const activeEntitlements = profileData?.activeEntitlements ?? [];
  const name =
    profile?.display_name ||
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "Member";

  return {
    ...user,
    name,
    membershipTier: membership?.plan_key,
    profile,
    roles: profileData?.roles ?? [],
    role: (profileData?.roles ?? [])[0],
    membership,
    activeEntitlements,
  } as AuthUser;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session ?? null);
      setSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setSessionLoading(false);
      setError(null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!session?.access_token,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const user = useMemo(() => {
    if (!session?.user) return null;
    return mergeUser(session.user, meQuery.data);
  }, [session?.user, meQuery.data]);

  const roles = user?.roles ?? [];
  const activeEntitlements = user?.activeEntitlements ?? [];
  const isAdmin = roles.includes("admin");
  const isMember = user?.membership?.status === "active" && Boolean(user.membership.ends_at && user.membership.ends_at > new Date().toISOString());
  const hasCourseAccess = activeEntitlements.length > 0;
  const hasPaidAccess = isAdmin || isMember || hasCourseAccess;
  const defaultPath = isAdmin || isMember
    ? "/dashboard"
    : hasCourseAccess
      ? "/mycourses"
      : "/plans";

  const logout = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }
    setSession(null);
  };

  return {
    user,
    session,
    loading: sessionLoading || (!!session && meQuery.isLoading),
    error: error ?? meQuery.error?.message ?? null,
    isAuthenticated: !!user,
    isAdmin,
    isMember,
    hasCourseAccess,
    hasPaidAccess,
    activeEntitlements,
    defaultPath,
    logout,
    refresh: () => meQuery.refetch(),
  };
}
