import { supabase } from "./supabase";

export type Role = "admin" | "member" | "student" | string;

export interface Entitlement {
  id: string;
  name?: string;
  status?: string;
  expires_at?: string | null;
}

export interface Membership {
  id?: string;
  plan?: string;
  status?: "active" | "inactive" | "canceled" | "trialing" | string;
  current_period_end?: string | null;
}

export interface MeResponse {
  user: {
    id: string;
    email: string | null;
    name?: string | null;
  };
  roles: Role[];
  membership: Membership | null;
  activeEntitlements: Entitlement[];
}

/**
 * auth.me() — fonte única de verdade para acesso.
 * Tenta uma RPC `me` no Supabase existente; em caso de ausência,
 * cai para a sessão atual sem roles/entitlements.
 * Não cria tabelas nem migrations: apenas consome o que já existe.
 */
async function me(): Promise<MeResponse | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  const { data: userData } = await supabase.auth.getUser();
  const u = userData.user;
  if (!u) return null;

  let roles: Role[] = [];
  let membership: Membership | null = null;
  let activeEntitlements: Entitlement[] = [];

  try {
    const { data, error } = await supabase.rpc("me");
    if (!error && data) {
      const d = data as Partial<MeResponse>;
      roles = d.roles ?? [];
      membership = d.membership ?? null;
      activeEntitlements = d.activeEntitlements ?? [];
    }
  } catch {
    /* RPC opcional — apenas usa sessão */
  }

  return {
    user: {
      id: u.id,
      email: u.email ?? null,
      name: (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? null,
    },
    roles,
    membership,
    activeEntitlements,
  };
}

export const auth = {
  me,
  signIn: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),
  signUp: (email: string, password: string, name?: string) =>
    supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/dashboard` },
    }),
  signOut: () => supabase.auth.signOut(),
  onAuthStateChange: (cb: () => void) =>
    supabase.auth.onAuthStateChange(() => {
      cb();
    }),
};

export function resolveLanding(me: MeResponse | null): string {
  if (!me) return "/login";
  const isAdmin = me.roles.includes("admin");
  const hasActiveMembership = me.membership?.status === "active" || me.membership?.status === "trialing";
  if (isAdmin || hasActiveMembership) return "/dashboard";
  if (me.activeEntitlements.length > 0) return "/mycourses";
  return "/plans";
}
