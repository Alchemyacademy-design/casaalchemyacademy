import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type WorkshopRow = Database["public"]["Tables"]["live_workshops"]["Row"];
type MagazineRow = Database["public"]["Tables"]["magazine_issues"]["Row"];
type PlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];
type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
type DealRow = Database["public"]["Tables"]["exclusive_deals"]["Row"];
type RegistrationRow = Database["public"]["Tables"]["registrations"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];

export function describeError(e: unknown, op: string): { title: string; description: string } {
  const err = e as { code?: string; message?: string; details?: string; hint?: string };
  const code = err?.code ?? "";
  const msg = err?.message ?? String(e ?? "");
  const lc = `${code} ${msg}`.toLowerCase();
  if (code === "42501" || code === "PGRST301" || lc.includes("row-level security") || lc.includes("permission denied")) {
    return { title: `Cannot ${op} — permission denied`, description: "Sign out and sign back in. If it persists, your role does not allow this action." };
  }
  if (code === "401" || code === "PGRST302" || lc.includes("jwt")) {
    return { title: "Session expired", description: "Please sign in again." };
  }
  if (code === "23505") return { title: "Duplicate value", description: msg };
  if (code === "23503") return { title: "Linked record missing", description: msg };
  if (code === "23502") return { title: "Missing required field", description: msg };
  return { title: `Failed to ${op}`, description: msg };
}

/* ===== Events ===== */
export function useUpcomingEvents() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["public", "events", "upcoming"],
    queryFn: async (): Promise<EventRow[]> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .is("archived_at", null)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    const uniq = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`public-events:${uniq}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        qc.invalidateQueries({ queryKey: ["public", "events"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return query;
}

export function usePastEvents(limit = 6) {
  return useQuery({
    queryKey: ["public", "events", "past", limit],
    queryFn: async (): Promise<EventRow[]> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .is("archived_at", null)
        .lt("starts_at", nowIso)
        .order("starts_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ===== Live workshops ===== */
export function useUpcomingWorkshops() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["public", "workshops", "upcoming"],
    queryFn: async (): Promise<WorkshopRow[]> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("live_workshops")
        .select("*")
        .eq("status", "published")
        .is("archived_at", null)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    const uniq = Math.random().toString(36).slice(2, 8);
    const ch = supabase
      .channel(`public-workshops:${uniq}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_workshops" }, () => {
        qc.invalidateQueries({ queryKey: ["public", "workshops"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return query;
}

export function usePastWorkshops(limit = 6) {
  return useQuery({
    queryKey: ["public", "workshops", "past", limit],
    queryFn: async (): Promise<WorkshopRow[]> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("live_workshops")
        .select("*")
        .eq("status", "published")
        .is("archived_at", null)
        .lt("starts_at", nowIso)
        .order("starts_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ===== Magazine ===== */
export function useMagazineIssues() {
  return useQuery({
    queryKey: ["public", "magazine"],
    queryFn: async (): Promise<MagazineRow[]> => {
      const { data, error } = await supabase
        .from("magazine_issues")
        .select("*")
        .eq("status", "published")
        .order("published_on", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ===== Membership plans ===== */
export function useMembershipPlans() {
  return useQuery({
    queryKey: ["public", "plans"],
    queryFn: async (): Promise<PlanRow[]> => {
      const { data, error } = await supabase
        .from("membership_plans")
        .select("*")
        .eq("active", true)
        .order("duration", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ===== Stripe default prices per plan_key (source of truth for pricing UI) ===== */
export type StripePriceDefault = {
  plan_key: string;
  stripe_price_id: string;
  currency: string;
  unit_amount: number;
  recurring_interval: string | null;
  recurring_interval_count: number | null;
  livemode: boolean;
};
export function useStripePriceDefaults() {
  return useQuery({
    queryKey: ["public", "stripe_price_defaults"],
    queryFn: async (): Promise<Record<string, StripePriceDefault>> => {
      const { data, error } = await supabase
        .from("stripe_prices")
        .select("plan_key, stripe_price_id, currency, unit_amount, recurring_interval, recurring_interval_count, livemode, active, is_checkout_default, course_id")
        .eq("active", true)
        .eq("is_checkout_default", true)
        .is("course_id", null);
      if (error) throw error;
      const map: Record<string, StripePriceDefault> = {};
      for (const row of data ?? []) {
        map[String(row.plan_key)] = {
          plan_key: String(row.plan_key),
          stripe_price_id: row.stripe_price_id as string,
          currency: row.currency as string,
          unit_amount: row.unit_amount as number,
          recurring_interval: (row.recurring_interval as string | null) ?? null,
          recurring_interval_count: (row.recurring_interval_count as number | null) ?? null,
          livemode: !!row.livemode,
        };
      }
      return map;
    },
  });
}

export function formatStripePriceLabel(p?: StripePriceDefault | null): string | null {
  if (!p) return null;
  const amount = (p.unit_amount / 100).toLocaleString(undefined, {
    style: "currency", currency: p.currency.toUpperCase(),
    minimumFractionDigits: p.unit_amount % 100 === 0 ? 0 : 2,
  });
  if (!p.recurring_interval) return `${amount} one-time`;
  const n = p.recurring_interval_count ?? 1;
  const unit = p.recurring_interval;
  if (n === 1) return `${amount} / ${unit}`;
  return `${amount} every ${n} ${unit}s`;
}

/* ===== Published courses (public catalog) ===== */
export function usePublishedCourses(limit?: number) {
  return useQuery({
    queryKey: ["public", "courses", limit ?? "all"],
    queryFn: async (): Promise<CourseRow[]> => {
      let q = supabase
        .from("courses")
        .select("*")
        .eq("status", "published")
        .is("archived_at", null)
        .order("sort_order", { ascending: true });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Home/landing course list. When `includeDrafts=true` (admins only),
 * returns non-archived courses regardless of status so that drafts are
 * visible behind an "Admin Preview" badge on the real Home route. RLS
 * remains the security authority — admins must already have read
 * access; non-admins always get the published-only list.
 */
export function useHomeCourses({ includeDrafts }: { includeDrafts: boolean } = { includeDrafts: false }) {
  return useQuery({
    queryKey: ["public", "courses", "home", includeDrafts ? "with-drafts" : "published"],
    queryFn: async (): Promise<CourseRow[]> => {
      let q = supabase
        .from("courses")
        .select("*")
        .is("archived_at", null)
        .order("sort_order", { ascending: true });
      if (!includeDrafts) q = q.eq("status", "published");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ===== Deals ===== */
export function useActiveDeals() {
  return useQuery({
    queryKey: ["public", "deals"],
    queryFn: async (): Promise<DealRow[]> => {
      const { data, error } = await supabase
        .from("exclusive_deals")
        .select("*")
        .eq("status", "published")
        .order("starts_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ===== My registrations ===== */
export function useMyRegistrations() {
  return useQuery({
    queryKey: ["me", "registrations"],
    queryFn: async (): Promise<RegistrationRow[]> => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .neq("status", "cancelled");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRegisterForTarget() {
  const qc = useQueryClient();
  type InviteResult = { ok?: boolean; status?: string; masked_email?: string; reason?: string; already?: boolean };
  type RegisterResult = { registration: unknown; invite: InviteResult | null };
  return useMutation<RegisterResult, Error, { target_type: "event" | "live_workshop"; target_id: number }>({
    mutationFn: async ({ target_type, target_id }) => {
      const { data, error } = await supabase.rpc("register_for_event", { target_type, target_id });
      if (error) throw error;
      let invite: InviteResult | null = null;
      try {
        const res = await supabase.functions.invoke("invite-user-to-google-event", {
          body: { target_type, target_id, action: "invite" },
        });
        if (!res.error && res.data) invite = res.data as InviteResult;
      } catch {
        // swallowed — registration itself already succeeded
      }
      return { registration: data, invite };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["me", "registrations"] });
      const inv = result?.invite;
      if (inv?.ok && inv.status === "invited") {
        toast.success("Participation confirmed!", {
          description: `Invite sent to ${inv.masked_email ?? "your email"}. Open it and accept to add this event to your Google Calendar.`,
        });
      } else if (inv?.status === "invited" && inv.already) {
        toast.success("Your invite for this event was already sent.");
      } else {
        toast.success("Participation confirmed!", {
          description: "Your spot is saved. You can also add this event to your calendar manually below.",
        });
      }
    },
    onError: (e) => {
      const d = describeError(e, "register");
      toast.error(d.title, { description: d.description });
    },
  });
}

/* ===== Profile ===== */
export function useMyProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["me", "profile", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateMyProfile(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ProfileRow>) => {
      if (!userId) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "profile"] });
      toast.success("Profile updated");
    },
    onError: (e) => {
      const d = describeError(e, "save");
      toast.error(d.title, { description: d.description });
    },
  });
}

/* ===== My memberships ===== */
export function useMyMemberships() {
  return useQuery({
    queryKey: ["me", "memberships"],
    queryFn: async (): Promise<MembershipRow[]> => {
      const { data, error } = await supabase
        .from("memberships")
        .select("*")
        .order("ends_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* ===== Supplier favourites ===== */
export function useMySupplierFavorites(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["me", "supplier_favorites", userId],
    enabled: !!userId,
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase.from("supplier_favorites").select("supplier_id").eq("user_id", userId!);
      if (error) throw error;
      type Row = { supplier_id: number | string | null };
      return ((data ?? []) as Row[]).map((r) => Number(r.supplier_id)).filter(Boolean);
    },
  });
}

export function useToggleSupplierFavorite(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ supplier_id, currentlyFavorited }: { supplier_id: number; currentlyFavorited: boolean }) => {
      if (!userId) throw new Error("Sign in to save favourites");
      if (currentlyFavorited) {
        const { error } = await supabase
          .from("supplier_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("supplier_id", supplier_id);
        if (error) throw error;
        return { removed: true };
      }
      const { error } = await supabase
        .from("supplier_favorites")
        .insert({ user_id: userId, supplier_id });
      if (error) throw error;
      return { added: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "supplier_favorites"] });
    },
    onError: (e) => {
      const d = describeError(e, "save favourite");
      toast.error(d.title, { description: d.description });
    },
  });
}

