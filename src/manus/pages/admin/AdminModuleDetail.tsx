import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import AdminShell from "@/manus/components/admin/AdminShell";
import ThumbnailField from "@/manus/components/admin/ThumbnailField";
import StatusBadge from "@/manus/components/admin/StatusBadge";
import { getCourse, getModule, listLessons, PLAN_KEYS, type PlanKey, statusTransition, swapSortOrder, isPlaceholderVideo } from "@/manus/lib/admin-content";
import { ArrowDown, ArrowUp, Plus, AlertTriangle } from "lucide-react";

export default function AdminModuleDetail() {
  const { id, moduleId } = useParams<{ id: string; moduleId: string }>();
  const courseId = Number(id);
  const modId = Number(moduleId);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: course } = useQuery({ queryKey: ["admin", "course", courseId], queryFn: () => getCourse(courseId) });
  const { data: mod } = useQuery({ queryKey: ["admin", "module", modId], queryFn: () => getModule(modId) });
  const { data: lessons = [], refetch } = useQuery({ queryKey: ["admin", "module", modId, "lessons"], queryFn: () => listLessons(modId) });

  const [form, setForm] = useState({
    title: "",
    description: "",
    cover_image_path: null as string | null,
    sort_order: 0,
    access_plan_keys: [] as PlanKey[],
  });

  useEffect(() => {
    if (mod) {
      setForm({
        title: mod.title,
        description: mod.description ?? "",
        cover_image_path: mod.cover_image_path,
        sort_order: mod.sort_order,
        access_plan_keys: mod.access_plan_keys,
      });
    }
  }, [mod]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("course_modules").update({
        title: form.title.trim(),
        description: form.description || null,
        cover_image_path: form.cover_image_path,
        sort_order: form.sort_order,
        access_plan_keys: form.access_plan_keys,
      }).eq("id", modId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Module saved");
      qc.invalidateQueries({ queryKey: ["admin", "module", modId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (target: "published" | "archived" | "draft") => {
      const { error } = await supabase.from("course_modules").update(statusTransition(target)).eq("id", modId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin", "module", modId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addLesson = async () => {
    const nextOrder = (lessons[lessons.length - 1]?.sort_order ?? 0) + 1;
    const { data, error } = await supabase
      .from("lessons")
      .insert({ module_id: modId, title: "New lesson", sort_order: nextOrder, status: "draft" })
      .select()
      .single();
    if (error) return toast.error(error.message);
    navigate(`/admin/courses/${courseId}/modules/${modId}/lessons/${data.id}`);
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const a = lessons[idx];
    const b = lessons[idx + dir];
    if (!a || !b) return;
    try {
      await swapSortOrder("lessons", a, b);
      await refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <AdminShell
      title={mod?.title ?? "Module"}
      crumbs={[
        { label: "Courses", to: "/admin/courses" },
        { label: course?.title ?? "—", to: `/admin/courses/${courseId}` },
        { label: mod?.title ?? "—" },
      ]}
      actions={
        <>
          {mod && <StatusBadge status={mod.status} />}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
          {mod?.status !== "published" && <Button variant="secondary" onClick={() => setStatus.mutate("published")}>Publish</Button>}
          {mod?.status === "published" && <Button variant="outline" onClick={() => setStatus.mutate("draft")}>Unpublish</Button>}
          {mod?.status !== "archived" && <Button variant="outline" onClick={() => setStatus.mutate("archived")}>Archive</Button>}
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
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <ThumbnailField value={form.cover_image_path} onChange={(v) => setForm((f) => ({ ...f, cover_image_path: v }))} folder="modules" label="Cover image (optional)" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Sort order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Access plans</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PLAN_KEYS.map((k) => {
                    const active = form.access_plan_keys.includes(k);
                    return (
                      <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, access_plan_keys: active ? f.access_plan_keys.filter((x) => x !== k) : [...f.access_plan_keys, k] }))} className={`text-xs px-2 py-1 rounded-full border ${active ? "bg-accent text-accent-foreground border-accent" : "bg-background"}`}>{k}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Lessons</h2>
              <Button size="sm" onClick={addLesson}><Plus className="w-4 h-4 mr-1" /> Add lesson</Button>
            </div>
            {lessons.length === 0 && <p className="text-sm text-foreground/60">No lessons yet.</p>}
            <ul className="divide-y">
              {lessons.map((l, idx) => (
                <li key={l.id} className="py-2 flex items-center gap-3">
                  <div className="flex flex-col">
                    <button className="p-1 disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)}><ArrowUp className="w-3 h-3" /></button>
                    <button className="p-1 disabled:opacity-30" disabled={idx === lessons.length - 1} onClick={() => move(idx, 1)}><ArrowDown className="w-3 h-3" /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {l.title}
                      {isPlaceholderVideo(l.external_video_url) && (
                        <span title="Placeholder video"><AlertTriangle className="w-3 h-3 text-amber-600" /></span>
                      )}
                      {!l.external_video_url && (
                        <span className="text-xs text-amber-700">no video</span>
                      )}
                    </div>
                    <div className="text-xs text-foreground/60">order {l.sort_order} {l.is_preview && "· preview"}</div>
                  </div>
                  <StatusBadge status={l.status} />
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/courses/${courseId}/modules/${modId}/lessons/${l.id}`)}>Open</Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
