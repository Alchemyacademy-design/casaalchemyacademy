import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/manus/lib/query-client";
import type {
  CertificateRow,
  CheckoutSessionRow,
  CommunityPostRow,
  EntitlementRow,
  LessonRow,
  MembershipRow,
  ModuleRow,
  PaymentRow,
  ProfileRow,
  ProgressRow,
  SupplierRow,
  UserAdminRow,
} from "@/manus/lib/types";

// Dynamic Supabase facade: PostgREST tables are referenced by string name,
// so we deliberately widen the typed client to allow arbitrary table access.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;
const nowIso = () => new Date().toISOString();

type Input = Record<string, unknown> | undefined;

async function requireUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.user) throw new Error("Authentication required");
  return session.user;
}

async function authMe() {
  const user = await requireUser();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (token) {
    const invoked = await supabase.functions.invoke("auth-me", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!invoked.error && invoked.data) return invoked.data;
  }
  const [{ data: profile }, { data: roles }, { data: memberships }, { data: entitlements }] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", user.id),
    db.from("memberships").select("plan_key,status,ends_at,starts_at").eq("user_id", user.id).eq("status", "active").gt("ends_at", nowIso()).order("ends_at", { ascending: false }).limit(1),
    db.from("course_entitlements").select("id,course_id,active,starts_at,ends_at,stripe_checkout_session_id,stripe_price_id").eq("user_id", user.id).eq("active", true).gt("ends_at", nowIso()),
  ]);
  return {
    profile: (profile as ProfileRow | null) ?? null,
    roles: ((roles as Array<{ role: string }> | null) ?? []).map((r) => r.role),
    membership: ((memberships as MembershipRow[] | null) ?? [])[0] ?? null,
    activeEntitlements: (entitlements as EntitlementRow[] | null) ?? [],
  };
}

const mapModule = (m: ModuleRow): ModuleRow => ({
  ...m,
  number: m.sort_order,
  tagline: m.description ?? undefined,
  lessonCount: m.lesson_count ?? 0,
  isPublished: m.status === "published",
});
const mapLesson = (l: LessonRow): LessonRow => ({
  ...l,
  number: l.sort_order,
  videoUrl: l.external_video_url,
  content: l.content_text,
  moduleId: Number(l.module_id),
});

async function modulesList() {
  // Member-facing routes always render the student catalogue. Admin-only draft
  // access stays in the Admin Center via admin-content-catalog.
  const { data, error } = await db
    .from("course_modules")
    .select("*")
    .eq("status", "published")
    .is("archived_at", null)
    .order("sort_order");
  if (error) throw error;
  return ((data as ModuleRow[] | null) ?? []).map(mapModule);
}
async function moduleById(input?: Input) {
  const id = (input as { id?: number | string } | undefined)?.id;
  const { data, error } = await db
    .from("course_modules")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Module not found");
  return mapModule(data as ModuleRow);
}
async function lessonsByModule(input?: Input) {
  const moduleId = (input as { moduleId?: number | string } | undefined)?.moduleId;
  const { data, error } = await db
    .from("lessons")
    .select("*")
    .eq("module_id", moduleId)
    .eq("status", "published")
    .is("archived_at", null)
    .order("sort_order");
  if (error) throw error;
  return ((data as LessonRow[] | null) ?? []).map(mapLesson);
}
async function lessonProgress(): Promise<ProgressRow[]> {
  const user = await requireUser();
  const { data, error } = await db
    .from("lesson_progress")
    .select("lesson_id,completed_at,last_watched_at,lessons(module_id)")
    .eq("user_id", user.id);
  if (error) throw error;
  type Row = {
    lesson_id: number;
    completed_at: string | null;
    last_watched_at: string | null;
    lessons?: { module_id: number } | null;
  };
  return ((data as Row[] | null) ?? []).map((r) => ({
    lessonId: Number(r.lesson_id),
    moduleId: Number(r.lessons?.module_id),
    completed: Boolean(r.completed_at),
    last_watched_at: r.last_watched_at ?? null,
  }));
}
async function moduleProgress(input?: Input) {
  const moduleId = (input as { moduleId?: number } | undefined)?.moduleId;
  const rows = await lessonProgress();
  return rows.filter((r) => r.moduleId === moduleId);
}
async function markLesson(input?: Input) {
  const user = await requireUser();
  const data = (input ?? {}) as { lessonId: number; completed?: boolean };
  const completed = data.completed ?? true;
  const now = nowIso();
  const { error } = await db.from("lesson_progress").upsert({
    user_id: user.id,
    lesson_id: data.lessonId,
    watched_seconds: 0,
    watched_percent: completed ? 100 : 0,
    completed_at: completed ? now : null,
    last_watched_at: now,
    updated_at: now,
  }, { onConflict: "user_id,lesson_id" });
  if (error) throw error;
  return { success: true };
}
async function suppliersList(): Promise<SupplierRow[]> {
  const { data, error } = await db.from("suppliers").select("*,supplier_categories(name)").eq("status", "published").order("name");
  if (error) throw error;
  return ((data as SupplierRow[] | null) ?? []).map((s) => ({
    ...s,
    websiteUrl: s.website_url ?? undefined,
    category: s.supplier_categories?.name ?? null,
    priceTier: null,
    room: null,
  }));
}
async function communityPosts(): Promise<CommunityPostRow[]> {
  const { data, error } = await db
    .from("community_posts")
    .select("*")
    .eq("status", "published")
    .order("pinned", { ascending: false })
    .order("last_activity_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const posts = (data as CommunityPostRow[] | null) ?? [];
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id).filter(Boolean))) as string[];
  if (!authorIds.length) return posts;
  const { data: profiles } = await db
    .from("profiles")
    .select("id,full_name,display_name,avatar_path")
    .in("id", authorIds);
  const map = new Map(((profiles as ProfileRow[] | null) ?? []).map((p) => [p.id, p]));
  return posts.map((p) => ({ ...p, profiles: map.get(p.author_id as string) ?? null }));
}
async function createPost(input?: Input) {
  const user = await requireUser();
  const data = (input ?? {}) as { channelId?: number | string; body?: string; content?: string; title?: string };
  let channelId = data.channelId;
  if (!channelId) {
    const { data: ch } = await db.from("community_channels").select("id").eq("slug", "general").maybeSingle();
    channelId = (ch as { id?: number | string } | null)?.id;
  }
  if (!channelId) throw new Error("Community channel is not configured");
  const body = data.body?.trim() || data.content?.trim();
  if (!body) throw new Error("Post body is required");
  const { data: created, error } = await db.from("community_posts").insert({
    channel_id: channelId,
    author_id: user.id,
    title: data.title?.trim() || "Discussion",
    body,
    status: "published",
    pinned: false,
    locked: false,
    last_activity_at: nowIso(),
  }).select().single();
  if (error) throw error;
  return created;
}
async function paymentStatus(input?: Input) {
  const user = await requireUser();
  const sessionId = (input as { sessionId?: string } | undefined)?.sessionId;
  const [{ data: sessions }, { data: memberships }, { data: entitlements }] = await Promise.all([
    db.from("stripe_checkout_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
    db.from("memberships").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5),
    db.from("course_entitlements").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(10),
  ]);
  const memberRows = (memberships as MembershipRow[] | null) ?? [];
  const entRows = (entitlements as EntitlementRow[] | null) ?? [];
  const sessRows = (sessions as CheckoutSessionRow[] | null) ?? [];
  const activeMembership = memberRows.find((m) => m.status === "active" && (m.ends_at ?? "") > nowIso()) ?? null;
  const activeEntitlements = entRows.filter((e) => e.active && e.ends_at > nowIso());
  return {
    checkoutSession: sessionId
      ? sessRows.find((s) => s.stripe_session_id === sessionId) ?? null
      : sessRows[0] ?? null,
    activeMembership,
    memberships: memberRows,
    activeEntitlements,
    entitlements: entRows,
    accessConfirmed: Boolean(activeMembership || activeEntitlements.length),
  };
}
async function createCheckout(input?: Input) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in first");
  const response = await fetch("https://omzwtfnqffseemrlylwu.supabase.co/functions/v1/create-checkout-session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "",
      "Content-Type": "application/json",
      "x-idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify(input ?? {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || payload.error || "Checkout unavailable");
  return payload;
}
async function adminStats() {
  const counts: Record<string, number> = {};
  for (const table of ["profiles", "memberships", "community_posts"]) {
    const { count } = await db.from(table).select("*", { count: "exact", head: true });
    counts[table] = (count as number | null) ?? 0;
  }
  const { data: payments } = await db.from("stripe_payments").select("amount").eq("status", "paid");
  const rows = (payments as PaymentRow[] | null) ?? [];
  return {
    totalUsers: counts.profiles,
    activeMembers: counts.memberships,
    totalPosts: counts.community_posts,
    totalRevenue: rows.reduce((s, p) => s + Number(p.amount ?? 0), 0),
  };
}
async function adminUsers(): Promise<UserAdminRow[]> {
  const [{ data: profiles, error }, { data: roles }, { data: memberships }] = await Promise.all([
    db.from("profiles").select("*").order("created_at", { ascending: false }),
    db.from("user_roles").select("user_id,role"),
    db.from("memberships").select("user_id,plan_key,status,ends_at"),
  ]);
  if (error) throw error;
  const rolesByUser = new Map<string, Array<{ role: string }>>();
  ((roles as Array<{ user_id: string; role: string }> | null) ?? []).forEach((r) => {
    const arr = rolesByUser.get(r.user_id) ?? [];
    arr.push({ role: r.role });
    rolesByUser.set(r.user_id, arr);
  });
  const memByUser = new Map<string, Array<{ plan_key?: string; status?: string; ends_at?: string }>>();
  ((memberships as Array<{ user_id: string; plan_key?: string; status?: string; ends_at?: string }> | null) ?? []).forEach((m) => {
    const arr = memByUser.get(m.user_id) ?? [];
    arr.push({ plan_key: m.plan_key, status: m.status, ends_at: m.ends_at });
    memByUser.set(m.user_id, arr);
  });
  return ((profiles as ProfileRow[] | null) ?? []).map((p) => ({
    ...p,
    user_roles: rolesByUser.get(p.id) ?? [],
    memberships: memByUser.get(p.id) ?? [],
  })) as UserAdminRow[];
}
async function adminAllPosts(): Promise<CommunityPostRow[]> {
  const { data, error } = await db.from("community_posts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  const posts = (data as CommunityPostRow[] | null) ?? [];
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id).filter(Boolean))) as string[];
  if (!authorIds.length) return posts;
  const { data: profiles } = await db.from("profiles").select("id,full_name,email").in("id", authorIds);
  const map = new Map(((profiles as ProfileRow[] | null) ?? []).map((p) => [p.id, p]));
  return posts.map((p) => ({ ...p, profiles: map.get(p.author_id as string) ?? null }));
}
async function updateMembership(input?: Input) {
  const data = (input ?? {}) as { userId: string; planKey: string; durationDays?: number };
  const ends = new Date();
  ends.setDate(ends.getDate() + (data.durationDays ?? 365));
  const { data: created, error } = await db.from("memberships").insert({
    user_id: data.userId,
    plan_key: data.planKey,
    status: "active",
    starts_at: nowIso(),
    ends_at: ends.toISOString(),
    source: "admin",
    metadata: { assigned_by: "admin_panel" },
  }).select().single();
  if (error) throw error;
  return created;
}
async function deletePost(input?: Input) {
  const postId = (input as { postId?: number | string } | undefined)?.postId;
  const { error } = await db.from("community_posts").update({ status: "deleted", deleted_at: nowIso() }).eq("id", postId);
  if (error) throw error;
  return { success: true };
}
// ---------------------------------------------------------------------------
// Certificates — course-specific (Phase 2). Every entry point takes { courseId }.
// Implementation lives in src/manus/services/certificate.ts so the rules can
// be unit-tested in isolation.
// ---------------------------------------------------------------------------
import {
  completionPercentageForCourse,
  eligibilityForCourse,
  issueCertificateForCourse,
  myCertificateForCourse,
} from "@/manus/services/certificate";

function requireCourseId(input?: Input): number {
  const cid = Number((input as { courseId?: number | string } | undefined)?.courseId);
  if (!Number.isFinite(cid) || cid <= 0) {
    throw new Error("courseId is required");
  }
  return cid;
}

async function certificateCompletion(input?: Input) {
  return completionPercentageForCourse(requireCourseId(input));
}
async function certificateEligibility(input?: Input) {
  return (await eligibilityForCourse(requireCourseId(input))).eligible;
}
async function certificateEligibilityReport(input?: Input) {
  return eligibilityForCourse(requireCourseId(input));
}
async function myCertificate(input?: Input): Promise<CertificateRow | null> {
  const cert = await myCertificateForCourse(requireCourseId(input));
  if (!cert) return null;
  return {
    ...cert,
    completionPercentage: Number(cert.metadata?.completion_percentage ?? 100),
    issuedAt: cert.issued_at,
  } as CertificateRow;
}
async function issueCertificate(input?: Input) {
  return issueCertificateForCourse(requireCourseId(input));
}

// Rating is intentionally disabled in Phase 2: the module_ratings table does
// not exist (RATING_STATUS = DEFERRED_NO_SCHEMA). Stubs preserve the trpc
// surface so any leftover call fails loudly instead of hitting a missing
// table.
async function ratingDeferred(): Promise<never> {
  throw new Error("RATING_STATUS=DEFERRED_NO_SCHEMA: module ratings are unavailable in pre-launch.");
}


type QueryOptions = Record<string, unknown>;
type MutationOptions = Record<string, unknown>;

const q = (key: string, fn: (input?: Input) => Promise<unknown>) => ({
  useQuery: (input?: Input, options?: QueryOptions) =>
    useQuery({ queryKey: [key, input], queryFn: () => fn(input), ...(options ?? {}) }),
});
const m = (fn: (input?: Input) => Promise<unknown>) => ({
  useMutation: (options?: MutationOptions) => useMutation({ mutationFn: fn, ...(options ?? {}) }),
});

// The trpc proxy is intentionally loose: the migrated pages call it with the
// same shape as the original tRPC client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc: any = {
  useUtils: () => ({
    lessons: { progress: { invalidate: () => queryClient.invalidateQueries({ queryKey: ["lessons.progress"] }) } },
    modules: { list: { invalidate: () => queryClient.invalidateQueries({ queryKey: ["modules.list"] }) } },
  }),
  auth: { me: q("auth.me", authMe) },
  modules: { list: q("modules.list", modulesList), byId: q("modules.byId", moduleById), get: q("modules.get", moduleById) },
  lessons: { byModule: q("lessons.byModule", lessonsByModule), progress: q("lessons.progress", lessonProgress), markComplete: m(markLesson) },
  progress: { moduleProgress: q("progress.moduleProgress", moduleProgress), markLesson: m(markLesson) },
  suppliers: { publicList: q("suppliers.publicList", suppliersList) },
  community: { posts: q("community.posts", communityPosts), createPost: m(createPost) },
  stripe: { getPaymentStatus: q("stripe.getPaymentStatus", paymentStatus), createCheckoutSession: m(createCheckout) },
  admin: { stats: q("admin.stats", adminStats), users: q("admin.users", adminUsers), allPosts: q("admin.allPosts", adminAllPosts), updateMembership: m(updateMembership), deletePost: m(deletePost) },
  analytics: {
    overview: q("analytics.overview", adminStats),
    allUsers: q("analytics.allUsers", adminUsers),
    access: q("analytics.access", async () => ({ memberships: [], entitlements: [] })),
    revenue: q("analytics.revenue", async () => ({ payments: [], totalRevenue: (await adminStats()).totalRevenue })),
    user: q("analytics.user", async () => null),
  },
  certificates: {
    completionPercentage: q("certificates.completionPercentage", certificateCompletion),
    isEligible: q("certificates.isEligible", certificateEligibility),
    eligibilityReport: q("certificates.eligibilityReport", certificateEligibilityReport),
    myCertificate: q("certificates.myCertificate", myCertificate),
    issueCertificate: m(issueCertificate),
  },
  // RATING_STATUS = DEFERRED_NO_SCHEMA — see services/quiz.ts / docs PHASE_2.
  moduleRatings: {
    get: q("moduleRatings.get", ratingDeferred),
    average: q("moduleRatings.average", ratingDeferred),
    submit: m(ratingDeferred),
  },
};

