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
import PublishChecklist, { canPublish } from "@/manus/components/admin/PublishChecklist";
import {
  getCourse,
  listModules,
  PLAN_KEYS,
  type PlanKey,
  slugify,
  statusTransition,
  swapSortOrder,
} from "@/manus/lib/admin-content";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";

export default function AdminCourseDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const courseId = isNew ? null : Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: course } = useQuery({
    queryKey: ["admin", "course", courseId],
    queryFn: () => getCourse(courseId!),
    enabled: !!courseId,
  });

  const { data: modules = [], refetch: refetchModules } = useQuery({
    queryKey: ["admin", "course", courseId, "modules"],
    queryFn: () => listModules(courseId!),
    enabled: !!courseId,
  });

  const [form, setForm] = useState({
    title: "",
    slug: "",
    subtitle: "",
    description: "",
    cover_image_path: null as string | null,
    external_landing_url: "",
    access_plan_keys: [] as PlanKey[],
    sort_order: 0,
  });

  useEffect(() => {
    if (course) {
      setForm({
        title: course.title,
        slug: course.slug,
        subtitle: course.subtitle ?? "",
        description: course.description ?? "",
        cover_image_path: course.cover_image_path,
        external_landing_url: course.external_landing_url ?? "",
        access_plan_keys: course.access_plan_keys,
        sort_order: course.sort_order,
      });
    }
  }, [course]);

  const saveDraft = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || slugify(form.title),
        subtitle: form.subtitle || null,
        description: form.description || null,
        cover_image_path: form.cover_image_path,
        external_landing_url: form.external_landing_url || null,
        access_plan_keys: form.access_plan_keys,
        sort_order: form.sort_order || 0,
      };
      if (!payload.title) throw new Error("Title is required");
      if (isNew) {
        const { data, error } = await supabase.from("courses").insert({ ...payload, status: "draft" }).select().single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from("courses").update(payload).eq("id", courseId!).select().single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      toast.success("Course saved");
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
      qc.invalidateQueries({ queryKey: ["admin", "course", data.id] });
      if (isNew) navigate(`/admin/courses/${data.id}`, { replace: true });
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  const setStatus = useMutation({
    mutationFn: async (target: "published" | "archived" | "draft") => {
      if (!courseId) return;
      const { error } = await supabase.from("courses").update(statusTransition(target)).eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin", "course", courseId] });
      qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  const createModule = async () => {
    if (!courseId) return;
    const nextOrder = (modules[modules.length - 1]?.sort_order ?? 0) + 1;
    const { data, error } = await supabase
      .from("course_modules")
      .insert({ course_id: courseId, title: "New module", sort_order: nextOrder, status: "draft" })
      .select()
      .single();
    if (error) return toast.error(error.message);
    navigate(`/admin/courses/${courseId}/modules/${data.id}`);
  };

  const moveModule = async (index: number, dir: -1 | 1) => {
    const target = modules[index + dir];
    const current = modules[index];
    if (!target || !current) return;
    try {
      await swapSortOrder("course_modules", current, target);
      await refetchModules();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const checklist = [
    { label: "Title", ok: form.title.trim().length > 0 },
    { label: "Slug", ok: (form.slug || slugify(form.title)).length > 0 },
    { label: "Cover image", ok: !!form.cover_image_path },
    { label: "At least one published module", ok: modules.some((m) => m.status === "published") },
  ];

  return (
    <AdminShell
      title={isNew ? "New course" : course?.title ?? "Course"}
      crumbs={[{ label: "Courses", to: "/admin/courses" }, { label: isNew ? "New" : course?.title ?? "—" }]}
      actions={
        <>
          {!isNew && course && <StatusBadge status={course.status} />}
          <Button onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>Save</Button>
          {!isNew && course?.status !== "published" && (
            <Button variant="secondary" disabled={!canPublish(checklist)} onClick={() => setStatus.mutate("published")}>Publish</Button>
          )}
          {!isNew && course?.status === "published" && (
            <Button variant="outline" onClick={() => setStatus.mutate("draft")}>Unpublish</Button>
          )}
          {!isNew && course?.status !== "archived" && (
            <Button variant="outline" onClick={() => setStatus.mutate("archived")}>Archive</Button>
          )}
        </>
      }
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label>Slug</Label>
                <div className="flex gap-2">
                  <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder={slugify(form.title)} />
                  <Button type="button" variant="outline" onClick={() => setForm((f) => ({ ...f, slug: slugify(f.title) }))}>Auto</Button>
                </div>
              </div>
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <ThumbnailField
              value={form.cover_image_path}
              onChange={(v) => setForm((f) => ({ ...f, cover_image_path: v }))}
              folder="courses"
            />
            <div>
              <Label>External landing URL (optional)</Label>
              <Input value={form.external_landing_url} onChange={(e) => setForm((f) => ({ ...f, external_landing_url: e.target.value }))} />
            </div>
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
                      <button
                        key={k}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            access_plan_keys: active ? f.access_plan_keys.filter((x) => x !== k) : [...f.access_plan_keys, k],
                          }))
                        }
                        className={`text-xs px-2 py-1 rounded-full border ${active ? "bg-accent text-accent-foreground border-accent" : "bg-background"}`}
                      >
                        {k}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {!isNew && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Modules</h2>
                <Button size="sm" onClick={createModule}><Plus className="w-4 h-4 mr-1" /> Add module</Button>
              </div>
              {modules.length === 0 && <p className="text-sm text-foreground/60">No modules yet.</p>}
              <ul className="divide-y">
                {modules.map((m, idx) => (
                  <li key={m.id} className="py-2 flex items-center gap-3">
                    <div className="flex flex-col">
                      <button className="p-1 disabled:opacity-30" disabled={idx === 0} onClick={() => moveModule(idx, -1)}><ArrowUp className="w-3 h-3" /></button>
                      <button className="p-1 disabled:opacity-30" disabled={idx === modules.length - 1} onClick={() => moveModule(idx, 1)}><ArrowDown className="w-3 h-3" /></button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{m.title}</div>
                      <div className="text-xs text-foreground/60">order {m.sort_order}</div>
                    </div>
                    <StatusBadge status={m.status} />
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/courses/${courseId}/modules/${m.id}`)}>Open</Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="space-y-4">
          <PublishChecklist items={checklist} />
        </div>
      </div>
    </AdminShell>
  );
}
