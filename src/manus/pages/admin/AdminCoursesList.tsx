import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Edit3, ChevronDown, ChevronRight, AlertTriangle, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AdminShell from "@/manus/components/admin/AdminShell";
import StatusBadge from "@/manus/components/admin/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { isPlaceholderVideo } from "@/manus/lib/admin-content";

type Lesson = {
  id: number;
  title: string;
  sort_order: number;
  status: string;
  external_video_url: string | null;
  description: string | null;
};
type Module = {
  id: number;
  title: string;
  sort_order: number;
  lessons: Lesson[];
};
type CourseTree = {
  id: number;
  title: string;
  slug: string;
  status: string;
  sort_order: number;
  subtitle: string | null;
  access_plan_keys: string[] | null;
  course_modules: Module[];
};

async function listCoursesTree(): Promise<CourseTree[]> {
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id,title,slug,status,sort_order,subtitle,access_plan_keys,course_modules(id,title,sort_order,lessons(id,title,sort_order,status,external_video_url,description))",
    )
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const courses = (data ?? []) as unknown as CourseTree[];
  for (const c of courses) {
    c.course_modules = (c.course_modules ?? []).sort((a, b) => a.sort_order - b.sort_order);
    for (const m of c.course_modules) {
      m.lessons = (m.lessons ?? []).sort((a, b) => a.sort_order - b.sort_order);
    }
  }
  return courses;
}

export default function AdminCoursesList() {
  const navigate = useNavigate();
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const { data: courses = [], isLoading, error } = useQuery({
    queryKey: ["admin", "courses-tree"],
    queryFn: listCoursesTree,
  });

  const toggle = (id: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalLessons = courses.reduce(
    (s, c) => s + c.course_modules.reduce((s2, m) => s2 + m.lessons.length, 0),
    0,
  );
  const missingVideos = courses.reduce(
    (s, c) =>
      s +
      c.course_modules.reduce(
        (s2, m) => s2 + m.lessons.filter((l) => !l.external_video_url || isPlaceholderVideo(l.external_video_url)).length,
        0,
      ),
    0,
  );

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
          <Button onClick={() => navigate("/admin/courses/new")}>
            <Plus className="w-4 h-4 mr-1" /> New course
          </Button>
        </>
      }
    >
      {!isLoading && (
        <p className="text-xs text-foreground/60 mb-4">
          {courses.length} courses · {totalLessons} lessons · {missingVideos} pending video URLs
        </p>
      )}

      {error && (
        <Card className="p-4 mb-4 border-destructive/40 text-sm text-destructive">
          Failed to load courses: {(error as Error).message}
        </Card>
      )}

      <div className="space-y-3">
        {isLoading && <Card className="p-6 text-center text-foreground/60">Loading…</Card>}
        {!isLoading && courses.length === 0 && (
          <Card className="p-6 text-center text-foreground/60">No courses yet.</Card>
        )}
        {courses.map((c) => {
          const open = openIds.has(c.id);
          const lessons = c.course_modules.flatMap((m) => m.lessons);
          const pendingHere = lessons.filter((l) => !l.external_video_url || isPlaceholderVideo(l.external_video_url)).length;
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
                </div>
                <StatusBadge status={c.status} />
                <span className="text-xs text-foreground/60 hidden md:inline">{lessons.length} lessons</span>
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
                  {c.subtitle && (
                    <p className="text-xs text-foreground/70 italic mb-3">{c.subtitle}</p>
                  )}
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
                          const missing = !l.external_video_url || isPlaceholderVideo(l.external_video_url);
                          return (
                            <li key={l.id} className="flex items-center gap-2 text-sm py-1">
                              <span className="text-xs font-mono text-foreground/50 w-10">
                                {c.sort_order}.{idx + 1}
                              </span>
                              <span className="flex-1 truncate">{l.title}</span>
                              {missing ? (
                                <span className="text-xs text-amber-700 flex items-center gap-1" title="No video URL">
                                  <AlertTriangle className="w-3 h-3" /> no video
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
