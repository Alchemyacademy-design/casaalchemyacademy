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
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("public-events")
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
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("public-workshops")
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

/* ===== Published courses (public catalog) ===== */
export function usePublishedCourses(limit?: number) {
  return useQuery({
    queryKey: ["public", "courses", limit ?? "all"],
    queryFn: async (): Promise<CourseRow[]> => {
      let q = supabase.from("courses").select("*").eq("status", "published").order("sort_order", { ascending: true });
      if (limit) q = q.limit(limit);
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
  return useMutation({
    mutationFn: async ({ target_type, target_id }: { target_type: "event" | "live_workshop"; target_id: number }) => {
      const { data, error } = await supabase.rpc("register_for_event", { target_type, target_id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "registrations"] });
      toast.success("You're registered");
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
