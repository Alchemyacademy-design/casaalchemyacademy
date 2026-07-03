import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ListChecks,
  Users,
  AlertTriangle,
  Image as ImageIcon,
  ArrowRight,
  Calendar,
  Activity,
  Shield,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminShell from "@/manus/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { isLegacyAssetPath, isPlaceholderVideo } from "@/manus/lib/admin-content";
import { fetchAuditSafe, type AuditResult } from "@/manus/lib/admin-audit-safe";
import AdminHealthStrip, { type HealthItem } from "@/manus/components/admin/AdminHealthStrip";

interface Kpi {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "good";
}

function KpiCard({ k }: { k: Kpi }) {
  const bg =
    k.tone === "warning"
      ? "rgba(196,160,90,.15)"
      : k.tone === "good"
        ? "rgba(70,120,80,.12)"
        : "rgba(60,58,42,.08)";
  const fg = k.tone === "warning" ? "var(--aa-gold)" : "var(--aa-olive-dark)";
  return (
    <Card className="p-5 flex items-start gap-4">
      <div
        className="h-11 w-11 rounded flex items-center justify-center flex-shrink-0"
        style={{ background: bg, color: fg }}
      >
        <k.icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-[0.12em] text-foreground/60">{k.label}</div>
        <div className="font-serif text-3xl mt-1" style={{ color: "var(--aa-olive-dark)" }}>
          {k.value}
        </div>
        {k.hint && <div className="text-xs text-foreground/55 mt-1">{k.hint}</div>}
      </div>
    </Card>
  );
}

export default function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview", "v2"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [
        coursesRes,
        modulesRes,
        lessonsRes,
        profilesCount,
        activeMembersCount,
        eventsRes,
        workshopsRes,
        pendingPostsCount,
        progressRes,
        recentAuditRes,
      ] = await Promise.all([
        supabase.from("courses").select("id,status,cover_image_path"),
        supabase.from("course_modules").select("id,cover_image_path"),
        supabase.from("lessons").select("id,status,external_video_url"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gt("ends_at", nowIso),
        supabase
          .from("events")
          .select("id,title,starts_at")
          .gt("starts_at", nowIso)
          .order("starts_at", { ascending: true })
          .limit(3),
        supabase
          .from("live_workshops")
          .select("id,title,starts_at")
          .gt("starts_at", nowIso)
          .order("starts_at", { ascending: true })
          .limit(3),
        supabase
          .from("community_posts")
          .select("id", { count: "exact", head: true })
          .eq("status", "hidden"),
        supabase.from("lesson_progress").select("watched_percent").limit(5000),
        fetchAuditSafe({ limit: 5, columns: "id,action,entity_type,created_at,actor_user_id,target_user_id" }),
      ]);

      const courses = (coursesRes.data ?? []) as unknown as Array<{ id: number; status: string; cover_image_path: string | null }>;
      const modules = (modulesRes.data ?? []) as unknown as Array<{ id: number; cover_image_path: string | null }>;
      const lessons = (lessonsRes.data ?? []) as unknown as Array<{ id: number; status: string; external_video_url: string | null }>;
      const progressRows = (progressRes.data ?? []) as Array<{ watched_percent: number | null }>;
      const avgProgress = progressRows.length
        ? Math.round(
            progressRows.reduce((s, p) => s + Number(p.watched_percent ?? 0), 0) /
              progressRows.length,
          )
        : 0;

      return {
        totalCourses: courses.length,
        publishedCourses: courses.filter((c) => c.status === "published").length,
        draftCourses: courses.filter((c) => c.status === "draft").length,
        totalModules: modules.length,
        totalLessons: lessons.length,
        missingVideos: lessons.filter(
          (l) => !l.external_video_url || isPlaceholderVideo(l.external_video_url),
        ).length,
        missingThumbs: courses.filter(
          (c) => !c.cover_image_path || isLegacyAssetPath(c.cover_image_path),
        ).length,
        missingLessonThumbs: modules.filter(
          (m) => !m.cover_image_path || isLegacyAssetPath(m.cover_image_path),
        ).length,
        students: profilesCount.count ?? 0,
        activeMembers: activeMembersCount.count ?? 0,
        upcomingEvents: eventsRes.data ?? [],
        upcomingWorkshops: workshopsRes.data ?? [],
        pendingPosts: pendingPostsCount.count ?? 0,
        avgProgress,
        recentAudit: recentAuditRes as AuditResult,
      };
    },
  });

  const v = <T,>(value: T | undefined): T | "—" =>
    isLoading ? ("—" as const) : (value ?? ("—" as const));

  const kpis: Kpi[] = [
    { label: "Total profiles", value: v(data?.students), hint: `${v(data?.activeMembers)} active members`, icon: Users },
    { label: "Courses", value: v(data?.totalCourses), hint: `${data?.publishedCourses ?? 0} published · ${data?.draftCourses ?? 0} draft`, icon: BookOpen },
    { label: "Modules", value: v(data?.totalModules), hint: `${v(data?.totalLessons)} lessons total`, icon: ListChecks },
    { label: "Avg. progress", value: isLoading ? "—" : `${data?.avgProgress ?? 0}%`, hint: "Across all lesson_progress rows", icon: TrendingUp, tone: "good" },
    { label: "Lessons missing video", value: v(data?.missingVideos), hint: "Add URL or upload in Courses / Bulk", icon: AlertTriangle, tone: "warning" },
    { label: "Missing thumbnails", value: isLoading ? "—" : (data?.missingThumbs ?? 0) + (data?.missingLessonThumbs ?? 0), hint: `${data?.missingThumbs ?? 0} courses · ${data?.missingLessonThumbs ?? 0} lessons`, icon: ImageIcon, tone: "warning" },
    { label: "Pending posts", value: v(data?.pendingPosts), hint: "Awaiting moderation", icon: Shield, tone: data?.pendingPosts ? "warning" : "default" },
    { label: "Upcoming events", value: isLoading ? "—" : (data?.upcomingEvents.length ?? 0) + (data?.upcomingWorkshops.length ?? 0), hint: `${data?.upcomingEvents.length ?? 0} events · ${data?.upcomingWorkshops.length ?? 0} workshops`, icon: Calendar },
  ];

  return (
    <AdminShell title="Overview" description="All metrics below come live from Supabase — no mocked data.">
      <AdminHealthStrip
        items={
          [
            {
              key: "video",
              label: "Lessons missing / broken video",
              count: data?.missingVideos ?? 0,
              tone: (data?.missingVideos ?? 0) > 0 ? "warn" : "ok",
              to: "/admin/tools/link-scanner",
              cta: "Scan",
            },
            {
              key: "thumbs",
              label: "Missing thumbnails",
              count: (data?.missingThumbs ?? 0) + (data?.missingLessonThumbs ?? 0),
              tone: (data?.missingThumbs ?? 0) + (data?.missingLessonThumbs ?? 0) > 0 ? "warn" : "ok",
              to: "/admin/course-management",
              cta: "Fix",
            },
            {
              key: "posts",
              label: "Pending community posts",
              count: data?.pendingPosts ?? 0,
              tone: (data?.pendingPosts ?? 0) > 0 ? "warn" : "ok",
              to: "/community",
              cta: "Review",
            },
            {
              key: "drafts",
              label: "Courses in draft",
              count: data?.draftCourses ?? 0,
              tone: (data?.draftCourses ?? 0) > 0 ? "warn" : "ok",
              to: "/admin/course-management",
              cta: "Publish",
            },
          ] as HealthItem[]
        }
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
        {kpis.map((k) => <KpiCard key={k.label} k={k} />)}
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="p-5">
          <h3 className="font-serif text-xl mb-1" style={{ color: "var(--aa-olive-dark)" }}>Edit courses</h3>
          <p className="text-sm text-foreground/70 mb-4">Manage all courses, modules and lessons. Drag-and-drop ordering, inline edit, publish or archive.</p>
          <Button asChild><Link to="/admin/courses">Open courses <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
        </Card>
        <Card className="p-5">
          <h3 className="font-serif text-xl mb-1" style={{ color: "var(--aa-olive-dark)" }}>Bulk lesson editor</h3>
          <p className="text-sm text-foreground/70 mb-4">Paste video URLs and titles for many lessons at once.</p>
          <Button asChild variant="outline"><Link to="/admin/course-management?tab=bulk">Open bulk editor <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
        </Card>
        <Card className="p-5">
          <h3 className="font-serif text-xl mb-1" style={{ color: "var(--aa-olive-dark)" }}>Manage students</h3>
          <p className="text-sm text-foreground/70 mb-4">Grant memberships, course access, promote admins. Every action is audited.</p>
          <Button asChild variant="outline"><Link to="/admin/students">Open students <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-serif text-lg mb-3 flex items-center gap-2" style={{ color: "var(--aa-olive-dark)" }}>
            <Calendar className="w-4 h-4" /> Upcoming events & workshops
          </h3>
          {isLoading ? (
            <p className="text-sm text-foreground/60">Loading…</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {[
                ...(data?.upcomingEvents ?? []).map((e) => ({ ...e, kind: "event" as const })),
                ...(data?.upcomingWorkshops ?? []).map((w) => ({ ...w, kind: "workshop" as const })),
              ]
                .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                .slice(0, 6)
                .map((row) => (
                  <li key={`${row.kind}-${row.id}`} className="flex justify-between border-b border-border/30 py-1.5">
                    <span className="truncate mr-2">
                      <span className="text-xs uppercase tracking-wide text-foreground/50 mr-2">{row.kind}</span>
                      {row.title}
                    </span>
                    <span className="text-xs text-foreground/60 whitespace-nowrap">
                      {new Date(row.starts_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              {!(data?.upcomingEvents.length || data?.upcomingWorkshops.length) && (
                <li className="text-foreground/60">No upcoming items scheduled.</li>
              )}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-serif text-lg mb-3 flex items-center gap-2" style={{ color: "var(--aa-olive-dark)" }}>
            <Activity className="w-4 h-4" /> Recent admin activity
          </h3>
          {isLoading || !data ? (
            <p className="text-sm text-foreground/60">Loading…</p>
          ) : !data.recentAudit.available ? (
            <p className="text-sm text-foreground/60">
              Audit log unavailable ({data.recentAudit.reason}): {data.recentAudit.message}.
            </p>
          ) : data.recentAudit.rows.length === 0 ? (
            <p className="text-sm text-foreground/60">No admin activity recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.recentAudit.rows.map((a) => (
                <li key={a.id} className="flex justify-between border-b border-border/30 py-1.5">
                  <span className="truncate mr-2">
                    <span className="font-mono text-xs">{a.action}</span>
                    {a.entity_type && (
                      <span className="text-xs text-foreground/50"> · {a.entity_type}</span>
                    )}
                  </span>
                  <span className="text-xs text-foreground/60 whitespace-nowrap">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
