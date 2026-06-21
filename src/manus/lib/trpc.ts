import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/manus/lib/query-client";

const db = supabase as any;
const nowIso = () => new Date().toISOString();

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
  return { profile: profile ?? null, roles: (roles ?? []).map((r: any) => r.role), membership: memberships?.[0] ?? null, activeEntitlements: entitlements ?? [] };
}

const mapModule = (m: any) => ({ ...m, number: m.sort_order, tagline: m.description, lessonCount: m.lesson_count ?? 0, isPublished: m.status === "published" });
const mapLesson = (l: any) => ({ ...l, number: l.sort_order, videoUrl: l.external_video_url, content: l.content_text, moduleId: Number(l.module_id) });

async function modulesList() {
  const { data, error } = await db.from("course_modules").select("*").eq("status", "published").order("sort_order");
  if (error) throw error; return (data ?? []).map(mapModule);
}
async function moduleById(input: any) {
  const { data, error } = await db.from("course_modules").select("*").eq("id", input.id).eq("status", "published").maybeSingle();
  if (error) throw error; if (!data) throw new Error("Module not found"); return mapModule(data);
}
async function lessonsByModule(input: any) {
  const { data, error } = await db.from("lessons").select("*").eq("module_id", input.moduleId).eq("status", "published").order("sort_order");
  if (error) throw error; return (data ?? []).map(mapLesson);
}
async function lessonProgress() {
  const user = await requireUser();
  const { data, error } = await db.from("lesson_progress").select("lesson_id,completed_at,lessons(module_id)").eq("user_id", user.id);
  if (error) throw error; return (data ?? []).map((r: any) => ({ lessonId: Number(r.lesson_id), moduleId: Number(r.lessons?.module_id), completed: Boolean(r.completed_at) }));
}
async function moduleProgress(input: any) {
  const rows = await lessonProgress(); return rows.filter((r: any) => r.moduleId === input.moduleId);
}
async function markLesson(input: any) {
  const user = await requireUser(); const completed = input.completed ?? true; const now = nowIso();
  const { error } = await db.from("lesson_progress").upsert({ user_id: user.id, lesson_id: input.lessonId, watched_seconds: 0, watched_percent: completed ? 100 : 0, completed_at: completed ? now : null, last_watched_at: now, updated_at: now }, { onConflict: "user_id,lesson_id" });
  if (error) throw error; return { success: true };
}
async function suppliersList() {
  const { data, error } = await db.from("suppliers").select("*,supplier_categories(name)").eq("status", "published").order("name");
  if (error) throw error; return (data ?? []).map((s: any) => ({ ...s, websiteUrl: s.website_url, category: s.supplier_categories?.name ?? null, priceTier: null, room: null }));
}
async function communityPosts() {
  const { data, error } = await db.from("community_posts").select("*,profiles:author_id(id,full_name,display_name,avatar_path)").eq("status", "published").order("pinned", { ascending: false }).order("last_activity_at", { ascending: false }).limit(100);
  if (error) throw error; return data ?? [];
}
async function createPost(input: any) {
  const user = await requireUser(); let channelId = input.channelId;
  if (!channelId) { const { data } = await db.from("community_channels").select("id").eq("slug", "general").maybeSingle(); channelId = data?.id; }
  if (!channelId) throw new Error("Community channel is not configured");
  const body = input.body?.trim() || input.content?.trim(); if (!body) throw new Error("Post body is required");
  const { data, error } = await db.from("community_posts").insert({ channel_id: channelId, author_id: user.id, title: input.title?.trim() || "Discussion", body, status: "published", pinned: false, locked: false, last_activity_at: nowIso() }).select().single();
  if (error) throw error; return data;
}
async function paymentStatus(input: any) {
  const user = await requireUser();
  const [{ data: sessions }, { data: memberships }, { data: entitlements }] = await Promise.all([
    db.from("stripe_checkout_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
    db.from("memberships").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5),
    db.from("course_entitlements").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(10),
  ]);
  const activeMembership = (memberships ?? []).find((m: any) => m.status === "active" && m.ends_at > nowIso()) ?? null;
  const activeEntitlements = (entitlements ?? []).filter((e: any) => e.active && e.ends_at > nowIso());
  return { checkoutSession: input?.sessionId ? (sessions ?? []).find((s: any) => s.stripe_session_id === input.sessionId) ?? null : sessions?.[0] ?? null, activeMembership, memberships: memberships ?? [], activeEntitlements, entitlements: entitlements ?? [], accessConfirmed: Boolean(activeMembership || activeEntitlements.length) };
}
async function createCheckout(input: any) {
  const { data: { session } } = await supabase.auth.getSession(); if (!session) throw new Error("Sign in first");
  const response = await fetch("https://omzwtfnqffseemrlylwu.supabase.co/functions/v1/create-checkout-session", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "", "Content-Type": "application/json", "x-idempotency-key": crypto.randomUUID() }, body: JSON.stringify(input) });
  const payload = await response.json(); if (!response.ok) throw new Error(payload.message || payload.error || "Checkout unavailable"); return payload;
}
async function adminStats() {
  const counts: any = {}; for (const table of ["profiles", "memberships", "community_posts"]) { const { count } = await db.from(table).select("*", { count: "exact", head: true }); counts[table] = count ?? 0; }
  const { data: payments } = await db.from("stripe_payments").select("amount").eq("status", "paid");
  return { totalUsers: counts.profiles, activeMembers: counts.memberships, totalPosts: counts.community_posts, totalRevenue: (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0) };
}
async function adminUsers() { const { data, error } = await db.from("profiles").select("*,user_roles(role),memberships(plan_key,status,ends_at)").order("created_at", { ascending: false }); if (error) throw error; return data ?? []; }
async function adminAllPosts() { const { data, error } = await db.from("community_posts").select("*,profiles:author_id(full_name,email)").order("created_at", { ascending: false }); if (error) throw error; return data ?? []; }
async function updateMembership(input: any) { const ends = new Date(); ends.setDate(ends.getDate() + (input.durationDays ?? 365)); const { data, error } = await db.from("memberships").insert({ user_id: input.userId, plan_key: input.planKey, status: "active", starts_at: nowIso(), ends_at: ends.toISOString(), source: "admin", metadata: { assigned_by: "admin_panel" } }).select().single(); if (error) throw error; return data; }
async function deletePost(input: any) { const { error } = await db.from("community_posts").update({ status: "deleted", deleted_at: nowIso() }).eq("id", input.postId); if (error) throw error; return { success: true }; }
async function certificateCompletion() { const user = await requireUser(); const { data: lessons } = await db.from("lessons").select("id").eq("status", "published"); if (!lessons?.length) return 0; const { count } = await db.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", user.id).not("completed_at", "is", null).in("lesson_id", lessons.map((l: any) => l.id)); return Math.min(100, Math.round(((count ?? 0) / lessons.length) * 100)); }
async function myCertificate() { const user = await requireUser(); const { data, error } = await db.from("certificates").select("*").eq("user_id", user.id).is("revoked_at", null).order("issued_at", { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data ? { ...data, completionPercentage: Number(data.metadata?.completion_percentage ?? 100), issuedAt: data.issued_at } : null; }
async function issueCertificate() { const completion = await certificateCompletion(); if (completion < 80) throw new Error("Complete at least 80% before requesting a certificate"); const user = await requireUser(); const existing = await myCertificate(); if (existing) return existing; const { data: course } = await db.from("courses").select("id").eq("status", "published").order("sort_order").limit(1).maybeSingle(); if (!course) throw new Error("No published course is available"); const issuedAt = nowIso(); const { data, error } = await db.from("certificates").insert({ user_id: user.id, course_id: course.id, certificate_number: `AA-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, issued_at: issuedAt, metadata: { completion_percentage: completion } }).select().single(); if (error) throw error; return data; }
async function ratingGet(input: any) { const user = await requireUser(); const { data } = await db.from("module_ratings").select("rating").eq("user_id", user.id).eq("module_id", input.moduleId).maybeSingle(); return data; }
async function ratingAverage(input: any) { const { data, error } = await db.from("module_ratings").select("rating").eq("module_id", input.moduleId); if (error) throw error; const rows = data ?? []; return { average: rows.length ? rows.reduce((s: number, r: any) => s + Number(r.rating), 0) / rows.length : 0, count: rows.length }; }
async function ratingSubmit(input: any) { const user = await requireUser(); const { data, error } = await db.from("module_ratings").upsert({ user_id: user.id, module_id: input.moduleId, rating: input.rating, updated_at: nowIso() }, { onConflict: "user_id,module_id" }).select().single(); if (error) throw error; return data; }

const q = (key: string, fn: (input?: any) => Promise<any>) => ({ useQuery: (input?: any, options?: any) => useQuery({ queryKey: [key, input], queryFn: () => fn(input), ...(options ?? {}) }) });
const m = (fn: (input?: any) => Promise<any>) => ({ useMutation: (options?: any) => useMutation({ mutationFn: fn, ...(options ?? {}) }) });

export const trpc: any = {
  useUtils: () => ({ lessons: { progress: { invalidate: () => queryClient.invalidateQueries({ queryKey: ["lessons.progress"] }) } }, modules: { list: { invalidate: () => queryClient.invalidateQueries({ queryKey: ["modules.list"] }) } } }),
  auth: { me: q("auth.me", authMe) },
  modules: { list: q("modules.list", modulesList), byId: q("modules.byId", moduleById), get: q("modules.get", moduleById) },
  lessons: { byModule: q("lessons.byModule", lessonsByModule), progress: q("lessons.progress", lessonProgress), markComplete: m(markLesson) },
  progress: { moduleProgress: q("progress.moduleProgress", moduleProgress), markLesson: m(markLesson) },
  suppliers: { publicList: q("suppliers.publicList", suppliersList) },
  community: { posts: q("community.posts", communityPosts), createPost: m(createPost) },
  stripe: { getPaymentStatus: q("stripe.getPaymentStatus", paymentStatus), createCheckoutSession: m(createCheckout) },
  admin: { stats: q("admin.stats", adminStats), users: q("admin.users", adminUsers), allPosts: q("admin.allPosts", adminAllPosts), updateMembership: m(updateMembership), deletePost: m(deletePost) },
  analytics: { overview: q("analytics.overview", adminStats), allUsers: q("analytics.allUsers", adminUsers), access: q("analytics.access", async () => ({ memberships: [], entitlements: [] })), revenue: q("analytics.revenue", async () => ({ payments: [], totalRevenue: (await adminStats()).totalRevenue })), user: q("analytics.user", async () => null) },
  certificates: { completionPercentage: q("certificates.completionPercentage", certificateCompletion), isEligible: q("certificates.isEligible", async () => (await certificateCompletion()) >= 80), myCertificate: q("certificates.myCertificate", myCertificate), issueCertificate: m(issueCertificate) },
  moduleRatings: { get: q("moduleRatings.get", ratingGet), average: q("moduleRatings.average", ratingAverage), submit: m(ratingSubmit) },
};
