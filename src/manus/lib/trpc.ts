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
  const invoked = await supabase.functions.invoke("auth-me", { method: "POST" });
  if (!invoked.error && invoked.data) return invoked.data;
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
  const { data, error } = await db.from("course_modules").select("*").eq("status", "published").order("sort_order");
  if (error) throw error;
  return ((data as ModuleRow[] | null) ?? []).map(mapModule);
}
async function moduleById(input?: Input) {
  const id = (input as { id?: number | string } | undefined)?.id;
  const { data, error } = await db.from("course_modules").select("*").eq("id", id).eq("status", "published").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Module not found");
  return mapModule(data as ModuleRow);
}
async function lessonsByModule(input?: Input) {
  const moduleId = (input as { moduleId?: number | string } | undefined)?.moduleId;
  const { data, error } = await db.from("lessons").select("*").eq("module_id", moduleId).eq("status", "published").order("sort_order");
  if (error) throw error;
  return ((data as LessonRow[] | null) ?? []).map(mapLesson);
}
async function lessonProgress(): Promise<ProgressRow[]> {
  const user = await requireUser();
  const { data, error } = await db.from("lesson_progress").select("lesson_id,completed_at,lessons(module_id)").eq("user_id", user.id);
  if (error) throw error;
  type Row = { lesson_id: number; completed_at: string | null; lessons?: { module_id: number } | null };
  return ((data as Row[] | null) ?? []).map((r) => ({
    lessonId: Number(r.lesson_id),
    moduleId: Number(r.lessons?.module_id),
    completed: Boolean(r.completed_at),
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
  const { data, error } = await db.from("profiles").select("*,user_roles(role),memberships(plan_key,status,ends_at)").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as UserAdminRow[] | null) ?? [];
}
async function adminAllPosts(): Promise<CommunityPostRow[]> {
  const { data, error } = await db.from("community_posts").select("*,profiles:author_id(full_name,email)").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as CommunityPostRow[] | null) ?? [];
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
async function certificateCompletion() {
  const user = await requireUser();
  const { data: lessons } = await db.from("lessons").select("id").eq("status", "published");
  const lessonRows = (lessons as Array<{ id: number }> | null) ?? [];
  if (!lessonRows.length) return 0;
  const { count } = await db.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", user.id).not("completed_at", "is", null).in("lesson_id", lessonRows.map((l) => l.id));
  return Math.min(100, Math.round((((count as number | null) ?? 0) / lessonRows.length) * 100));
}
async function myCertificate(): Promise<CertificateRow | null> {
  const user = await requireUser();
  const { data, error } = await db.from("certificates").select("*").eq("user_id", user.id).is("revoked_at", null).order("issued_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const cert = data as CertificateRow;
  return { ...cert, completionPercentage: Number(cert.metadata?.completion_percentage ?? 100), issuedAt: cert.issued_at };
}
async function issueCertificate() {
  const completion = await certificateCompletion();
  if (completion < 80) throw new Error("Complete at least 80% before requesting a certificate");
  const user = await requireUser();
  const existing = await myCertificate();
  if (existing) return existing;
  const { data: course } = await db.from("courses").select("id").eq("status", "published").order("sort_order").limit(1).maybeSingle();
  if (!course) throw new Error("No published course is available");
  const courseRow = course as { id: number | string };
  const issuedAt = nowIso();
  const { data, error } = await db.from("certificates").insert({
    user_id: user.id,
    course_id: courseRow.id,
    certificate_number: `AA-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    issued_at: issuedAt,
    metadata: { completion_percentage: completion },
  }).select().single();
  if (error) throw error;
  return data;
}
async function ratingGet(input?: Input) {
  const user = await requireUser();
  const moduleId = (input as { moduleId?: number } | undefined)?.moduleId;
  const { data } = await db.from("module_ratings").select("rating").eq("user_id", user.id).eq("module_id", moduleId).maybeSingle();
  return data;
}
async function ratingAverage(input?: Input) {
  const moduleId = (input as { moduleId?: number } | undefined)?.moduleId;
  const { data, error } = await db.from("module_ratings").select("rating").eq("module_id", moduleId);
  if (error) throw error;
  const rows = (data as Array<{ rating: number }> | null) ?? [];
  return {
    average: rows.length ? rows.reduce((s, r) => s + Number(r.rating), 0) / rows.length : 0,
    count: rows.length,
  };
}
async function ratingSubmit(input?: Input) {
  const user = await requireUser();
  const data = (input ?? {}) as { moduleId: number; rating: number };
  const { data: row, error } = await db.from("module_ratings").upsert({
    user_id: user.id,
    module_id: data.moduleId,
    rating: data.rating,
    updated_at: nowIso(),
  }, { onConflict: "user_id,module_id" }).select().single();
  if (error) throw error;
  return row;
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
    isEligible: q("certificates.isEligible", async () => (await certificateCompletion()) >= 80),
    myCertificate: q("certificates.myCertificate", myCertificate),
    issueCertificate: m(issueCertificate),
  },
  moduleRatings: { get: q("moduleRatings.get", ratingGet), average: q("moduleRatings.average", ratingAverage), submit: m(ratingSubmit) },
};
