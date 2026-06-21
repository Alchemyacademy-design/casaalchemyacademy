import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import AdminShell from "@/manus/components/admin/AdminShell";
import StatusBadge from "@/manus/components/admin/StatusBadge";
import PublishChecklist, { canPublish } from "@/manus/components/admin/PublishChecklist";
import { getCourse, getLesson, getModule, isPlaceholderVideo, statusTransition } from "@/manus/lib/admin-content";

function isEmbeddable(url: string | null) {
  if (!url) return false;
  return /youtu\.be|youtube\.com|vimeo\.com/.test(url);
}

export default function AdminLessonDetail() {
  const { id, moduleId, lessonId } = useParams<{ id: string; moduleId: string; lessonId: string }>();
  const courseId = Number(id);
  const modId = Number(moduleId);
  const lId = Number(lessonId);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: course } = useQuery({ queryKey: ["admin", "course", courseId], queryFn: () => getCourse(courseId) });
  const { data: mod } = useQuery({ queryKey: ["admin", "module", modId], queryFn: () => getModule(modId) });
  const { data: lesson } = useQuery({ queryKey: ["admin", "lesson", lId], queryFn: () => getLesson(lId) });

  const [form, setForm] = useState({
    title: "",
    description: "",
    content_text: "",
    external_video_url: "",
    external_resource_url: "",
    duration_minutes: 0,
    duration_seconds: 0,
    is_preview: false,
    sort_order: 0,
  });

  useEffect(() => {
    if (lesson) {
      const total = lesson.duration_seconds ?? 0;
      setForm({
        title: lesson.title,
        description: lesson.description ?? "",
        content_text: lesson.content_text ?? "",
        external_video_url: lesson.external_video_url ?? "",
        external_resource_url: lesson.external_resource_url ?? "",
        duration_minutes: Math.floor(total / 60),
        duration_seconds: total % 60,
        is_preview: lesson.is_preview,
        sort_order: lesson.sort_order,
      });
    }
  }, [lesson]);

  const save = useMutation({
    mutationFn: async () => {
      const totalSec = form.duration_minutes * 60 + form.duration_seconds;
      const { error } = await supabase.from("lessons").update({
        title: form.title.trim(),
        description: form.description || null,
        content_text: form.content_text || null,
        external_video_url: form.external_video_url.trim() || null,
        external_resource_url: form.external_resource_url.trim() || null,
        duration_seconds: totalSec > 0 ? totalSec : null,
        is_preview: form.is_preview,
        sort_order: form.sort_order,
      }).eq("id", lId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lesson saved");
      qc.invalidateQueries({ queryKey: ["admin", "lesson", lId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (target: "published" | "archived" | "draft") => {
      const { error } = await supabase.from("lessons").update(statusTransition(target)).eq("id", lId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin", "lesson", lId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const checklist = [
    { label: "Title is set", ok: form.title.trim().length > 0 },
    { label: "External video URL is set", ok: form.external_video_url.trim().length > 0 },
    { label: "No legacy Manus placeholder URL", ok: !isPlaceholderVideo(form.external_video_url) },
  ];

  const embed = isEmbeddable(form.external_video_url);

  return (
    <AdminShell
      title={lesson?.title ?? "Lesson"}
      crumbs={[
        { label: "Courses", to: "/admin/courses" },
        { label: course?.title ?? "—", to: `/admin/courses/${courseId}` },
        { label: mod?.title ?? "—", to: `/admin/courses/${courseId}/modules/${modId}` },
        { label: lesson?.title ?? "—" },
      ]}
      actions={
        <>
          {lesson && <StatusBadge status={lesson.status} />}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
          {lesson?.status !== "published" && (
            <Button variant="secondary" disabled={!canPublish(checklist)} onClick={() => setStatus.mutate("published")}>Publish</Button>
          )}
          {lesson?.status === "published" && <Button variant="outline" onClick={() => setStatus.mutate("draft")}>Unpublish</Button>}
          {lesson?.status !== "archived" && <Button variant="outline" onClick={() => setStatus.mutate("archived")}>Archive</Button>}
        </>
      }
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>Short description</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Lesson content (markdown / text)</Label>
              <Textarea rows={8} value={form.content_text} onChange={(e) => setForm((f) => ({ ...f, content_text: e.target.value }))} />
            </div>
            <div>
              <Label>External video URL</Label>
              <Input value={form.external_video_url} onChange={(e) => setForm((f) => ({ ...f, external_video_url: e.target.value }))} placeholder="https://youtu.be/… or Vimeo URL" />
              {isPlaceholderVideo(form.external_video_url) && (
                <p className="text-xs text-red-600 mt-1">This is a legacy Manus placeholder. Replace with a real hosted URL.</p>
              )}
            </div>
            <div>
              <Label>External resource URL (PDF, slides…)</Label>
              <Input value={form.external_resource_url} onChange={(e) => setForm((f) => ({ ...f, external_resource_url: e.target.value }))} />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label>Duration (minutes)</Label>
                <Input type="number" min={0} value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Duration (seconds)</Label>
                <Input type="number" min={0} max={59} value={form.duration_seconds} onChange={(e) => setForm((f) => ({ ...f, duration_seconds: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_preview} onCheckedChange={(v) => setForm((f) => ({ ...f, is_preview: v }))} />
              <Label>Free preview (visible without subscription)</Label>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <PublishChecklist items={checklist} />
          {embed && (
            <Card className="p-3">
              <div className="text-xs font-medium mb-2">Video preview</div>
              <div className="aspect-video bg-black rounded overflow-hidden">
                <iframe
                  src={form.external_video_url.replace("youtu.be/", "www.youtube.com/embed/").replace("watch?v=", "embed/")}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </Card>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
