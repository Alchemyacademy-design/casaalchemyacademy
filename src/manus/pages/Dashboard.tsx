import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Calendar, Clock, TrendingUp } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import { CertificateSection } from "@/manus/components/CertificateSection";
import {
  MemberPage,
  MemberPageHeader,
  ProgressBar,
  SectionHeader,
  StatCard,
  StatusPill,
} from "@/manus/components/member/MemberUI";
import { trpc } from "@/manus/lib/trpc";
import { useAuth } from "@/manus/hooks/useAuth";
import type { ModuleRow, ProgressRow } from "@/manus/lib/types";
import { getCoursesTree } from "@/manus/services/admin-content";
import {
  useMyRegistrations,
  useRegisterForTarget,
  useUpcomingEvents,
  useUpcomingWorkshops,
} from "@/manus/hooks/usePublicContent";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  const { data: progress = [] } = trpc.lessons.progress.useQuery(undefined, { enabled: !isAdmin });
  const memberModules = trpc.modules.list.useQuery(undefined, {
    enabled: !isAdmin,
    staleTime: 5 * 60 * 1000,
  });
  const adminModules = useQuery({
    queryKey: ["dashboard", "admin-modules"],
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ModuleRow[]> => {
      const catalog = await getCoursesTree();
      return catalog.courses.flatMap((course) =>
        course.course_modules.map((module) => ({
          ...module,
          course_id: course.id,
          number: module.sort_order,
          tagline: module.description ?? undefined,
          lessonCount: module.lessons.length,
          isPublished: module.status === "published",
        })),
      );
    },
  });

  const modules = isAdmin ? (adminModules.data ?? []) : (memberModules.data ?? []);

  if (loading) {
    return (
      <div className="aa-member-shell flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-secondary border-t-accent" />
          <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const allModules = modules as ModuleRow[];
  const progressRows = progress as ProgressRow[];
  const startedIds = new Set(progressRows.map((item) => item.moduleId));
  const enrolledModules = isAdmin
    ? allModules
    : [
        ...allModules.filter((module) => startedIds.has(module.id)),
        ...allModules.filter((module) => !startedIds.has(module.id)),
      ];

  const totalLessons = allModules.reduce((sum, module) => sum + (module.lessonCount || 0), 0);
  const completedLessons = progressRows.filter((item) => item.completed).length;
  const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const accessLabel = isAdmin
    ? "Administrator"
    : ((user as { membershipTier?: string } | null)?.membershipTier || "Free access");

  const primaryCourseId = (allModules.find((module) => module.course_id != null)?.course_id ?? null) as
    | number
    | string
    | null;
  const primaryCourseTitle = (
    allModules.find((module) => module.course_id != null) as { course_title?: string } | undefined
  )?.course_title ?? null;

  return (
    <MemberLayout>
      <MemberPage>
        <MemberPageHeader
          eyebrow="Your Academy"
          title={<>Welcome back, {user?.name || "Alchemist"}</>}
          description={
            <div className="flex flex-wrap items-center gap-2">
              <span>Continue building confidence through every room, lesson and decision.</span>
              <StatusPill tone={isAdmin ? "accent" : "neutral"}>{accessLabel}</StatusPill>
            </div>
          }
          action={
            <Link
              to="/mycourses"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground transition hover:bg-primary/90"
            >
              Browse courses <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />

        <section className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Learning summary">
          <StatCard
            label="Overall progress"
            value={`${overallProgress}%`}
            detail={totalLessons > 0 ? `${completedLessons} of ${totalLessons} lessons complete` : "Your progress will appear here."}
            icon={<TrendingUp className="h-6 w-6" />}
            progress={overallProgress}
          />
          <StatCard
            label="Lessons completed"
            value={completedLessons}
            detail={totalLessons > 0 ? `${Math.max(totalLessons - completedLessons, 0)} lessons remaining` : "Start a course to begin tracking."}
            icon={<BookOpen className="h-6 w-6" />}
          />
        </section>

        <ComingUp />

        <section className="mb-12">
          <SectionHeader
            title="Your certificate"
            description="Completion milestones and certificate eligibility stay connected to your primary course."
          />
          <div className="aa-panel overflow-hidden p-1 sm:p-2">
            <CertificateSection
              courseId={primaryCourseId != null ? Number(primaryCourseId) : null}
              courseTitle={primaryCourseTitle}
            />
          </div>
        </section>

        <section className="mb-4">
          <SectionHeader
            title="Continue learning"
            description="Return to what you started or choose the next module in your path."
            action={
              <Link to="/mycourses" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />

          {enrolledModules.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {enrolledModules.slice(0, 4).map((module: ModuleRow) => {
                const courseId =
                  typeof module.course_id === "number" || typeof module.course_id === "string"
                    ? module.course_id
                    : null;
                const moduleProgress = progressRows.filter((item) => item.moduleId === module.id);
                const lessonCount = module.lessonCount ?? 0;
                const completedHere = moduleProgress.filter((item) => item.completed).length;
                const percent = lessonCount > 0 ? Math.round((completedHere / lessonCount) * 100) : 0;
                const href = courseId ? `/courses/${courseId}` : `/modules/${module.id}`;

                return (
                  <Link key={module.id} to={href} className="aa-panel group block p-5 transition hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-float">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <p className="aa-eyebrow">Module {String(module.number ?? 0).padStart(2, "0")}</p>
                        <h3 className="font-serif text-2xl leading-tight text-primary">{module.title}</h3>
                      </div>
                      <StatusPill tone={percent === 100 ? "success" : percent > 0 ? "accent" : "neutral"}>
                        {percent === 100 ? "Complete" : percent > 0 ? "In progress" : "Not started"}
                      </StatusPill>
                    </div>
                    <ProgressBar value={percent} label={`${completedHere} of ${lessonCount} lessons`} />
                    <div className="mt-5 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                      {percent > 0 ? "Continue" : "Start"}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="aa-empty-state">
              <BookOpen className="mx-auto mb-3 h-6 w-6 text-accent" />
              <h3 className="font-serif text-2xl text-primary">Your learning path is ready</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7">
                Explore the curriculum and open your first course to begin tracking progress.
              </p>
              <Link
                to="/mycourses"
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground"
              >
                Browse courses <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </section>
      </MemberPage>
    </MemberLayout>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function ComingUp() {
  const { isAuthenticated } = useAuth();
  const { data: workshops = [] } = useUpcomingWorkshops();
  const { data: events = [] } = useUpcomingEvents();
  const { data: registrations = [] } = useMyRegistrations();
  const register = useRegisterForTarget();
  const workshop = workshops[0];
  const event = events[0];
  const workshopRegistered = workshop
    ? registrations.some((registration) => registration.live_workshop_id === workshop.id)
    : false;
  const eventRegistered = event ? registrations.some((registration) => registration.event_id === event.id) : false;

  if (!workshop && !event) return null;

  return (
    <section className="mb-12">
      <SectionHeader title="Coming up" description="Your next live moments inside the Academy." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {workshop ? (
          <UpcomingCard
            eyebrow="Live workshop"
            title={workshop.title}
            startsAt={workshop.starts_at}
            endsAt={workshop.ends_at}
            registered={workshopRegistered}
            pending={register.isPending}
            enabled={isAuthenticated}
            onRegister={() => register.mutate({ target_type: "live_workshop", target_id: workshop.id })}
          />
        ) : null}
        {event ? (
          <UpcomingCard
            eyebrow="Event"
            title={event.title}
            description={event.description}
            startsAt={event.starts_at}
            endsAt={event.ends_at}
            registered={eventRegistered}
            pending={register.isPending}
            enabled={isAuthenticated}
            onRegister={() => register.mutate({ target_type: "event", target_id: event.id })}
          />
        ) : null}
      </div>
    </section>
  );
}

function UpcomingCard({
  eyebrow,
  title,
  description,
  startsAt,
  endsAt,
  registered,
  pending,
  enabled,
  onRegister,
}: {
  eyebrow: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  registered: boolean;
  pending: boolean;
  enabled: boolean;
  onRegister: () => void;
}) {
  return (
    <article className="aa-panel p-5">
      <p className="aa-eyebrow">{eyebrow}</p>
      <h3 className="font-serif text-2xl text-primary">{title}</h3>
      {description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      <div className="mt-5 grid gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" />
          <span>{formatDate(startsAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" />
          <span>{formatTime(startsAt)}{endsAt ? ` – ${formatTime(endsAt)}` : ""}</span>
        </div>
      </div>
      <button
        type="button"
        className="mt-5 w-full rounded-md border border-primary bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground transition disabled:cursor-not-allowed disabled:border-border disabled:bg-secondary disabled:text-muted-foreground"
        disabled={registered || pending || !enabled}
        onClick={onRegister}
      >
        {registered ? "Registered" : pending ? "Registering…" : "Register"}
      </button>
    </article>
  );
}
