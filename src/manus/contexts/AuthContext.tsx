import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  membership?: { plan_key?: string; status: string; ends_at: string } | null;
  activeEntitlements?: ActiveEntitlement[];
}

interface AccessData {
  profile: AuthUser["profile"];
  roles: string[];
  membership: AuthUser["membership"];
  activeEntitlements: ActiveEntitlement[];
  source: "auth-me" | "fallback";
}

export interface AuthContextValue {
  session: Session | null;
  user: AuthUser | null;
  profile: AuthUser["profile"];
  roles: string[];
  membership: AuthUser["membership"];
  activeEntitlements: ActiveEntitlement[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMember: boolean;
  hasCourseAccess: boolean;
  hasPaidAccess: boolean;
  authReady: boolean;
  accessReady: boolean;
  accessSource: "auth-me" | "fallback" | null;
  loading: boolean;
  error: string | null;
  defaultPath: string;
  refreshAccess: () => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeRoles(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((role) => String(role).trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function mergeUser(user: User, access: AccessData | null): AuthUser {
  const profile = access?.profile ?? null;
  const membership = access?.membership ?? null;
  const name =
    profile?.display_name ||
    profile?.full_name ||
    (user.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined ||
    user.email ||
    "Member";
  return {
    ...user,
    name,
    membershipTier: membership?.plan_key,
    profile,
    roles: access?.roles ?? [],
    role: (access?.roles ?? [])[0],
    membership,
    activeEntitlements: access?.activeEntitlements ?? [],
  } as AuthUser;
}

async function loadAccessViaEdge(): Promise<AccessData | null | "stale_session"> {
  const { data, error } = await supabase.functions.invoke("auth-me", { method: "POST" });
  if (error) {
    // A 401 here means the JWT is stale/expired — the caller will fall back
    // to direct queries. Don't throw: it's an expected signed-out state, not
    // a runtime error, and throwing surfaces a blank-screen telemetry event.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const status = (error as any)?.context?.status ?? (error as any)?.status;
    if (status === 401) return "stale_session";
    throw error;
  }
  if (!data) return null;
  const payload = data as Record<string, unknown>;
  return {
    profile: (payload.profile as AccessData["profile"]) ?? null,
    roles: normalizeRoles(payload.roles),
    membership: (payload.membership as AccessData["membership"]) ?? null,
    activeEntitlements: (payload.activeEntitlements as ActiveEntitlement[]) ?? [],
    source: "auth-me",
  };
}

async function loadAccessViaFallback(userId: string): Promise<AccessData> {
  const nowIso = new Date().toISOString();
  const [profileRes, rolesRes, membershipRes, entitlementsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("memberships")
      .select("plan_key,status,ends_at,starts_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("ends_at", nowIso)
      .order("ends_at", { ascending: false })
      .limit(1),
    supabase
      .from("course_entitlements")
      .select("id,course_id,active,starts_at,ends_at,stripe_checkout_session_id,stripe_price_id")
      .eq("user_id", userId)
      .eq("active", true)
      .gt("ends_at", nowIso),
  ]);
  if (rolesRes.error) throw rolesRes.error;
  return {
    profile: (profileRes.data as AccessData["profile"]) ?? null,
    roles: normalizeRoles(((rolesRes.data as Array<{ role: string }> | null) ?? []).map((r) => r.role)),
    membership: ((membershipRes.data as Array<NonNullable<AccessData["membership"]>> | null) ?? [])[0] ?? null,
    activeEntitlements: ((entitlementsRes.data as ActiveEntitlement[] | null) ?? []),
    source: "fallback",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [access, setAccess] = useState<AccessData | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  const loadAccess = useCallback(async (userId: string) => {
    if (inflightRef.current) return inflightRef.current;
    setAccessLoading(true);
    setError(null);
    const promise = (async () => {
      try {
        let next: AccessData | null = null;
        try {
          const edgeResult = await loadAccessViaEdge();
          if (edgeResult === "stale_session") {
            // Server-side session is gone (session_not_found). Clear the
            // stale local JWT so we stop looping 401s and end up signed out.
            await supabase.auth.signOut().catch(() => {});
            setAccess(null);
            setAccessReady(true);
            return;
          }
          next = edgeResult;
        } catch (edgeErr) {
          if (import.meta.env.DEV) console.warn("[auth-me] failed, using fallback", edgeErr);
        }
        if (!next) next = await loadAccessViaFallback(userId);
        setAccess(next);
        setAccessReady(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (import.meta.env.DEV) console.error("[auth] access load failed", err);
        setError(message);
        setAccess(null);
        setAccessReady(true);
      } finally {
        setAccessLoading(false);
        inflightRef.current = null;
      }
    })();
    inflightRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session ?? null);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthReady(true);
      if (event === "SIGNED_OUT" || !nextSession?.user) {
        lastUserIdRef.current = null;
        setAccess(null);
        setAccessReady(true);
        setError(null);
        return;
      }
      if (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "INITIAL_SESSION"].includes(event)) {
        if (lastUserIdRef.current !== nextSession.user.id) {
          setAccessReady(false);
          setAccess(null);
        }
        lastUserIdRef.current = nextSession.user.id;
        void loadAccess(nextSession.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadAccess]);

  // First-mount load when getSession resolves with an existing session
  useEffect(() => {
    if (!authReady || !session?.user) return;
    if (lastUserIdRef.current === session.user.id && accessReady) return;
    lastUserIdRef.current = session.user.id;
    void loadAccess(session.user.id);
  }, [authReady, session, accessReady, loadAccess]);

  const refreshAccess = useCallback(async () => {
    if (!session?.user) return;
    setAccessReady(false);
    await loadAccess(session.user.id);
  }, [session, loadAccess]);

  const logout = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }
    setSession(null);
    setAccess(null);
    setAccessReady(true);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ? mergeUser(session.user, access) : null;
    const roles = access?.roles ?? [];
    const isAdmin = roles.includes("admin");
    const membership = access?.membership ?? null;
    const activeEntitlements = access?.activeEntitlements ?? [];
    const realIsMember =
      membership?.status === "active" &&
      Boolean(membership.ends_at && membership.ends_at > new Date().toISOString());
    // Admins get the full member experience by default so they can preview the
    // platform exactly as paying students see it.
    const isMember = isAdmin || realIsMember;
    const hasCourseAccess = isAdmin || activeEntitlements.length > 0;
    const hasPaidAccess = isAdmin || realIsMember || activeEntitlements.length > 0;
    const defaultPath = isAdmin
      ? "/admin"
      : isMember
        ? "/dashboard"
        : hasCourseAccess
          ? "/mycourses"
          : "/plans";
    return {
      session,
      user,
      profile: access?.profile ?? null,
      roles,
      membership,
      activeEntitlements,
      isAuthenticated: !!user,
      isAdmin,
      isMember,
      hasCourseAccess,
      hasPaidAccess,
      authReady,
      accessReady: accessReady || !session,
      accessSource: access?.source ?? null,
      loading: !authReady || (!!session && !accessReady),
      error,
      defaultPath,
      refreshAccess,
      refresh: refreshAccess,
      logout,
    };
  }, [session, access, authReady, accessReady, error, refreshAccess, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const FALLBACK_AUTH: AuthContextValue = {
  session: null,
  user: null,
  profile: null,
  roles: [],
  membership: null,
  activeEntitlements: [],
  isAuthenticated: false,
  isAdmin: false,
  isMember: false,
  hasCourseAccess: false,
  hasPaidAccess: false,
  authReady: false,
  accessReady: false,
  accessSource: null,
  loading: true,
  error: null,
  defaultPath: "/login",
  refreshAccess: async () => {},
  refresh: async () => {},
  logout: async () => {},
};

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    if (import.meta.env.DEV) {
      console.warn("[auth] useAuthContext called outside <AuthProvider>; returning fallback");
    }
    return FALLBACK_AUTH;
  }
  return ctx;
}
