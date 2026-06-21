import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Edit3, ChevronDown, ChevronRight, AlertTriangle, Video, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AdminShell from "@/manus/components/admin/AdminShell";
import StatusBadge from "@/manus/components/admin/StatusBadge";
import { useAuth } from "@/manus/hooks/useAuth";
import {
  getCoursesTree,
  isPlaceholderVideo,
  type AdminCatalog,
  type AdminCourse,
  AdminContentError,
} from "@/manus/services/admin-content";

export default function AdminCoursesList() {
  const navigate = useNavigate();
  const { authReady, accessReady, isAdmin, session } = useAuth();
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  const query = useQuery<AdminCatalog>({
    queryKey: ["admin", "courses-tree", session?.user.id ?? null],
    queryFn: getCoursesTree,
    enabled: authReady && accessReady && isAdmin && !!session,
    retry: 2,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  const catalog = query.data;
  const courses: AdminCourse[] = catalog?.courses ?? [];

  const toggle = (id: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AdminShell
      title="Courses"
      description="Edit any course or lesson. Open a course to update its title, description and video URL."
      crumbs={[{ label: "Courses" }]}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/admin/lessons">Bulk lessons</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/diagnostics">Diagnostics</Link>
          </Button>
          <Button onClick={() => navigate("/admin/courses/new")}>
            <Plus className="w-4 h-4 mr-1" /> New course
          </Button>
        </>
      }
    >
      {catalog && (
        <p className="text-xs text-foreground/60 mb-4">
          {catalog.counts.courses} courses · {catalog.counts.modules} modules · {catalog.counts.lessons} lessons ·{" "}
          {catalog.counts.missing_video_urls} pending video URLs
          <span className="ml-2 text-foreground/40">[source: {catalog.source}]</span>
        </p>
      )}

      {query.isError && (
        <Card className="p-4 mb-4 border-destructive/40 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-destructive mb-1">Failed to load courses</div>
              {query.error instanceof AdminContentError ? (
                <ul className="text-xs space-y-0.5 text-foreground/70 font-mono">
                  <li>message: {query.error.message}</li>
                  {query.error.code && <li>code: {query.error.code}</li>}
                  {query.error.details && <li>details: {query.error.details}</li>}
                  {query.error.hint && <li>hint: {query.error.hint}</li>}
                </ul>
              ) : (
                <p className="text-xs text-foreground/70">{(query.error as Error).message}</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw className="w-3 h-3 mr-1" /> Retry
            </Button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {query.isLoading && <Card className="p-6 text-center text-foreground/60">Loading…</Card>}

        {query.isSuccess && courses.length === 0 && (
          <Card className="p-6 text-center text-foreground/60">No courses yet.</Card>
        )}

        {courses.map((c) => {
          const open = openIds.has(c.id);
          const lessons = c.course_modules.flatMap((m) => m.lessons);
          const pendingHere = lessons.filter((l) => isPlaceholderVideo(l.external_video_url)).length;
          return (
            <Card key={c.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(c.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20"
              >
                {open ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                <span className="text-xs font-mono text-foreground/50 w-6">{c.sort_order}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="text-xs text-foreground/55 font-mono truncate">{c.slug}</div>
                  {c.subtitle && <div className="text-xs text-foreground/60 truncate italic">{c.subtitle}</div>}
                </div>
                <StatusBadge status={c.status} />
                <span className="text-xs text-foreground/60 hidden md:inline">
                  {c.course_modules.length} mod · {lessons.length} lessons
                </span>
                {pendingHere > 0 && (
                  <span className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {pendingHere} no video
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link to={`/admin/courses/${c.id}`}>
                    <Edit3 className="w-4 h-4 mr-1" /> Manage
                  </Link>
                </Button>
              </button>

              {open && (
                <div className="border-t border-border/40 bg-muted/10 px-4 py-3">
                  {c.course_modules.length === 0 && (
                    <p className="text-xs text-foreground/55">No modules.</p>
                  )}
                  {c.course_modules.map((m) => (
                    <div key={m.id} className="mb-3 last:mb-0">
                      <div className="text-xs uppercase tracking-[0.12em] text-foreground/55 mb-2">
                        {m.title}
                      </div>
                      <ul className="space-y-1">
                        {m.lessons.map((l, idx) => {
                          const missing = isPlaceholderVideo(l.external_video_url);
                          return (
                            <li key={l.id} className="flex items-center gap-2 text-sm py-1">
                              <span className="text-xs font-mono text-foreground/50 w-10">
                                {c.sort_order}.{idx + 1}
                              </span>
                              <span className="flex-1 truncate">{l.title}</span>
                              {missing ? (
                                <span className="text-xs text-amber-700 flex items-center gap-1" title="No video URL">
                                  <AlertTriangle className="w-3 h-3" /> missing
                                </span>
                              ) : (
                                <span className="text-xs text-emerald-700 flex items-center gap-1" title="Video URL set">
                                  <Video className="w-3 h-3" />
                                </span>
                              )}
                              <StatusBadge status={l.status} />
                              <Button size="sm" variant="ghost" asChild>
                                <Link to={`/admin/courses/${c.id}`}>
                                  <Edit3 className="w-3 h-3 mr-1" /> Edit
                                </Link>
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
