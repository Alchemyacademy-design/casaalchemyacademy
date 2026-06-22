import MemberLayout from "@/manus/components/MemberLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { trpc } from "@/manus/lib/trpc";
import { useAuth } from "@/manus/hooks/useAuth";
import { getCoursesTree } from "@/manus/services/admin-content";
import { canAccessCourse } from "@/manus/services/learning";
import { Lock, CheckCircle, ArrowRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";


type CourseRow = {
  id: number;
  title: string;
  slug: string;
  subtitle: string | null;
  status: "draft" | "published" | "archived";
  sort_order: number;
  cover_image_path: string | null;
  access_plan_keys: string[] | null;
  course_modules: Array<{
    id: number;
    status: string;
    lessons: Array<{ id: number; status: string }>;
  }>;
};

async function fetchCourses(includeDrafts: boolean): Promise<CourseRow[]> {
  if (includeDrafts) {
    const catalog = await getCoursesTree();
    return catalog.courses as unknown as CourseRow[];
  }

  let query = supabase
    .from("courses")
    .select(
      "id,title,slug,subtitle,status,sort_order,cover_image_path,access_plan_keys,course_modules(id,status,lessons(id,status))",
    )
    .order("sort_order", { ascending: true });
  if (!includeDrafts) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as CourseRow[];
}

export default function Modules() {
  const { isAdmin, isMember, hasCourseAccess, activeEntitlements } = useAuth();
  const { data: progress = [] } = trpc.lessons.progress.useQuery(undefined, { enabled: !isAdmin });

  const accessState = {
    isAdmin,
    isMember,
    hasCourseAccess,
    entitlementCourseIds: (activeEntitlements ?? []).map((e) => Number(e.course_id)).filter(Boolean),
  };
  const hasAnyPaidAccess = isAdmin || isMember || hasCourseAccess;

  const { data: courses = [], isLoading, error, refetch } = useQuery({
    queryKey: ["modules-page", "courses", { admin: isAdmin }],
    queryFn: () => fetchCourses(isAdmin),
    staleTime: 5 * 60 * 1000,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "not_started" | "in_progress" | "completed">("all");

  const lessonCountOf = (c: CourseRow) =>
    c.course_modules.reduce(
      (s, m) => s + m.lessons.filter((l) => isAdmin || l.status === "published").length,
      0,
    );

  const getProgress = (courseId: number, lessonCount: number) => {
    if (!progress || lessonCount === 0) return 0;
    const moduleIds = new Set(
      (courses.find((c) => c.id === courseId)?.course_modules ?? []).map((m) => m.id),
    );
    const done = (progress as Array<{ moduleId: number; completed: boolean }>).filter(
      (p) => moduleIds.has(p.moduleId) && p.completed,
    ).length;
    return Math.round((done / lessonCount) * 100);
  };

  const isCourseAccessible = (c: CourseRow) =>
    canAccessCourse(c.id, c.access_plan_keys, accessState);


  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        <div className="mb-10">
          <p className="section-label mb-2">The Curriculum</p>
          <h1 className="font-serif text-3xl md:text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Courses Available
          </h1>
          <p className="text-sm max-w-xl" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            {isAdmin
              ? "Admin preview: drafts are visible to you only. Students see published courses."
              : isFullMember
              ? "You have full access to all modules. Work through them at your own pace."
              : "You have access to free modules. Upgrade to unlock the full curriculum."}
          </p>
        </div>

        {!isFullMember && (
          <div className="mb-8 p-4 rounded-lg border border-border/50" style={{ backgroundColor: "var(--aa-gold-light)" }}>
            <p className="text-sm" style={{ color: "var(--aa-olive-dark)" }}>
              Upgrade to access all modules and unlock the complete curriculum.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg border border-destructive/40 text-sm text-destructive">
            Failed to load courses: {(error as Error).message}
          </div>
        )}

        {isLoading && (
          <div className="text-sm text-foreground/60">Loading courses…</div>
        )}

        {!isLoading && courses.length === 0 && (
          <div className="text-sm text-foreground/60">No courses available yet.</div>
        )}

        {courses.length > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--aa-text-light)" }} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search courses…"
                aria-label="Search courses"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border/50 bg-white focus:outline-none focus:ring-1"
                style={{ color: "var(--aa-olive-dark)" }}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", "not_started", "in_progress", "completed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded-md border transition ${statusFilter === s ? "border-transparent" : "border-border/40"}`}
                  style={{
                    backgroundColor: statusFilter === s ? "var(--aa-gold)" : "white",
                    color: statusFilter === s ? "var(--aa-cacao)" : "var(--aa-text-mid)",
                    fontFamily: "'DM Sans', sans-serif",
                    letterSpacing: "0.05em",
                  }}
                >
                  {s === "all" ? "All" : s === "not_started" ? "Not started" : s === "in_progress" ? "In progress" : "Completed"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses
            .filter((c) => {
              if (search.trim()) {
                const q = search.trim().toLowerCase();
                const hay = `${c.title} ${c.subtitle ?? ""}`.toLowerCase();
                if (!hay.includes(q)) return false;
              }
              if (statusFilter !== "all") {
                const lc = lessonCountOf(c);
                const pct = getProgress(c.id, lc);
                if (statusFilter === "not_started" && pct !== 0) return false;
                if (statusFilter === "in_progress" && (pct === 0 || pct === 100)) return false;
                if (statusFilter === "completed" && pct !== 100) return false;
              }
              return true;
            })
            .map((c) => {
            const lessonCount = lessonCountOf(c);
            const pct = getProgress(c.id, lessonCount);
            const accessible = isCourseAccessible(c);
            const locked = !accessible;
            const isDraft = c.status !== "published";
            const thumbnail = c.cover_image_path ?? undefined;

            return (
              <div
                key={c.id}
                className="p-6 rounded-lg border border-border/50 hover:border-border transition flex flex-col relative overflow-hidden group min-h-[260px]"
                style={{
                  backgroundColor: "white",
                  backgroundImage: thumbnail ? `url(${thumbnail})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {thumbnail && <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition" />}
                <div className="relative z-10 flex flex-col flex-1">
                  <div className="mb-4">
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: thumbnail ? "white" : "var(--aa-gold)",
                        fontFamily: "'DM Sans', sans-serif",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {String(c.sort_order).padStart(2, "0")}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      {isDraft && (
                        <span className="text-xs px-2 py-0.5" style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "white", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.08em" }}>
                          Draft
                        </span>
                      )}
                      {locked && (
                        <Lock size={14} style={{ color: thumbnail ? "white" : "var(--aa-text-light)" }} />
                      )}
                      {pct === 100 && !locked && (
                        <CheckCircle size={14} style={{ color: "var(--aa-gold)" }} />
                      )}
                    </div>
                  </div>

                  <h3 className="font-serif text-xl mb-2" style={{ color: thumbnail ? "white" : "var(--aa-olive-dark)", fontWeight: 400 }}>
                    {c.title}
                  </h3>
                  {c.subtitle && (
                    <p className="text-xs mb-4 flex-1 leading-relaxed" style={{ color: thumbnail ? "rgba(255,255,255,0.9)" : "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
                      {c.subtitle}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xs" style={{ color: thumbnail ? "rgba(255,255,255,0.8)" : "var(--aa-text-light)", fontFamily: "'DM Sans', sans-serif" }}>
                      {lessonCount} lesson{lessonCount === 1 ? "" : "s"} {pct > 0 ? `· ${pct}% done` : ""}
                    </span>
                    {!locked ? (
                      <Link to={`/courses/${c.id}`}>
                        <span className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: thumbnail ? "white" : "var(--aa-olive-dark)", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, letterSpacing: "0.08em" }}>
                          {pct > 0 ? "Continue" : "Start"} <ArrowRight size={12} />
                        </span>
                      </Link>
                    ) : (
                      <Link to="/#pricing">
                        <span className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: thumbnail ? "white" : "var(--aa-gold)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.08em" }}>
                          Unlock <ArrowRight size={12} />
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-12 pt-6 border-t border-border/50">
          <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 hover:bg-card transition">
            ← Back
          </a>
          <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg btn-gold transition">
            Exit
          </a>
        </div>
      </div>
    </MemberLayout>
  );
}
