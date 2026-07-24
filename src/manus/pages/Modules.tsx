import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import QueryStateView from "@/manus/components/QueryStateView";
import CourseCard from "@/manus/components/learning/CourseCard";
import { MemberPage, MemberPageHeader, StatusPill } from "@/manus/components/member/MemberUI";
import { supabase } from "@/integrations/supabase/client";
import { trpc } from "@/manus/lib/trpc";
import { useAuth } from "@/manus/hooks/useAuth";
import { canAccessCourse } from "@/manus/services/learning";

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

type StatusFilter = "all" | "not_started" | "in_progress" | "completed";

async function fetchCourses(): Promise<CourseRow[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id,title,slug,subtitle,status,sort_order,cover_image_path,access_plan_keys,course_modules(id,status,lessons(id,status))",
    )
    .eq("status", "published")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as unknown as CourseRow[]).map((course) => ({
    ...course,
    course_modules: (course.course_modules ?? [])
      .filter((module) => module.status === "published")
      .map((module) => ({
        ...module,
        lessons: (module.lessons ?? []).filter((lesson) => lesson.status === "published"),
      })),
  }));
}

export default function Modules() {
  const { loading: authLoading, isAdmin, isMember, hasCourseAccess, activeEntitlements } = useAuth();
  const { data: progress = [] } = trpc.lessons.progress.useQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const accessState = {
    isAdmin,
    isMember,
    hasCourseAccess,
    entitlementCourseIds: (activeEntitlements ?? []).map((item) => Number(item.course_id)).filter(Boolean),
  };
  const hasAnyPaidAccess = isAdmin || isMember || hasCourseAccess;

  const { data: courses = [], isLoading: coursesLoading, error, refetch } = useQuery({
    queryKey: ["modules-page", "courses", "published"],
    queryFn: fetchCourses,
    staleTime: 5 * 60 * 1000,
  });
  const isLoading = coursesLoading || authLoading;

  const lessonCountOf = (course: CourseRow) =>
    course.course_modules.reduce(
      (sum, module) => sum + module.lessons.filter((lesson) => lesson.status === "published").length,
      0,
    );

  const getProgress = (courseId: number, lessonCount: number) => {
    if (!progress || lessonCount === 0) return 0;
    const moduleIds = new Set(
      (courses.find((course) => course.id === courseId)?.course_modules ?? []).map((module) => module.id),
    );
    const done = (progress as Array<{ moduleId: number; completed: boolean }>).filter(
      (item) => moduleIds.has(item.moduleId) && item.completed,
    ).length;
    return Math.round((done / lessonCount) * 100);
  };

  const visibleCourses = courses.filter((course) => {
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      if (!`${course.title} ${course.subtitle ?? ""}`.toLowerCase().includes(query)) return false;
    }

    if (statusFilter !== "all") {
      const percent = getProgress(course.id, lessonCountOf(course));
      if (statusFilter === "not_started" && percent !== 0) return false;
      if (statusFilter === "in_progress" && (percent === 0 || percent === 100)) return false;
      if (statusFilter === "completed" && percent !== 100) return false;
    }

    return true;
  });

  const filters: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "not_started", label: "Not started" },
    { value: "in_progress", label: "In progress" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <MemberLayout>
      <MemberPage>
        <MemberPageHeader
          eyebrow="The Curriculum"
          title="Courses available"
          description={
            hasAnyPaidAccess
                ? "Move through the curriculum at your own pace and return exactly where you left off."
                : "Start with the courses available to you, then unlock the complete curriculum when you are ready."
          }
          action={isAdmin ? <StatusPill tone="accent">Student View</StatusPill> : undefined}
        />

        {!authLoading && !hasAnyPaidAccess ? (
          <div className="aa-panel-soft mb-7 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Unlock the complete curriculum</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                Membership gives you access to every published course and future learning releases.
              </p>
            </div>
            <Link
              to="/plans"
              className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground"
            >
              View plans
            </Link>
          </div>
        ) : null}

        <QueryStateView
          isLoading={isLoading}
          error={error}
          onRetry={() => refetch()}
          errorTitle="Failed to load courses"
          empty={!isLoading && !error && courses.length === 0}
          emptyMessage={<span className="text-sm text-muted-foreground">No courses are available yet.</span>}
        >
          <></>
        </QueryStateView>

        {!authLoading && courses.length > 0 ? (
          <>
            <div className="aa-panel mb-7 flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search courses…"
                  aria-label="Search courses"
                  className="w-full rounded-md border border-input bg-background py-2.5 pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-ring/20"
                />
              </div>

              <div className="flex flex-wrap gap-2" aria-label="Filter courses by progress">
                {filters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatusFilter(filter.value)}
                    aria-pressed={statusFilter === filter.value}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
                      statusFilter === filter.value
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-accent/35 hover:text-foreground"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {visibleCourses.length > 0 ? (
              <div data-testid="member-courses-grid" data-aa-grid="member" className="aa-course-grid">
                {visibleCourses.map((course) => {
                  const lessonCount = lessonCountOf(course);
                  const percent = getProgress(course.id, lessonCount);
                  const accessible = canAccessCourse(course.id, course.access_plan_keys, accessState);
                  const locked = !accessible;

                  return (
                    <CourseCard
                      key={course.id}
                      variant="member"
                      course={{
                        id: course.id,
                        title: course.title,
                        subtitle: course.subtitle,
                        number: course.sort_order,
                        thumbnail: course.cover_image_path,
                        lessonCount,
                        progressPercent: percent,
                        published: true,
                        locked,
                        href: locked ? "/plans" : `/courses/${course.id}`,
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="aa-empty-state">
                <Sparkles className="mx-auto mb-3 h-6 w-6 text-accent" />
                <h2 className="font-serif text-2xl text-primary">No courses match this view</h2>
                <p className="mt-2 text-sm">Clear your search or choose another progress filter.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                  className="mt-5 rounded-md border border-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary"
                >
                  Reset filters
                </button>
              </div>
            )}
          </>
        ) : null}
      </MemberPage>
    </MemberLayout>
  );
}
