import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import AdminShell from "@/manus/components/admin/AdminShell";
import {
  isPlaceholderVideo,
  statusTransition,
  updateLesson,
  uploadCoverImage,
  type ContentStatus,
} from "@/manus/lib/admin-content";
import { Save, Trash2, Upload, ExternalLink } from "lucide-react";

interface Row {
  id: number;
  module_id: number;
  module_title: string;
  course_id: number;
  course_title: string;
  sort_order: number;
  title: string;
  description: string | null;
  external_video_url: string | null;
  cover_image_path: string | null;
  status: ContentStatus;
}

type Patch = Partial<Pick<Row, "title" | "description" | "external_video_url" | "cover_image_path" | "status">>;

const STATUSES: ContentStatus[] = ["draft", "published", "archived"];

export default function AdminLessonsBulk() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Record<number, Patch>>({});
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterFlag, setFilterFlag] = useState<"all" | "no-video" | "no-thumb">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("lessons")
        .select("id, module_id, sort_order, title, description, external_video_url, cover_image_path, status, course_modules!inner(id, title, course_id, sort_order, courses!inner(id, title, sort_order))")
        .order("sort_order", { ascending: true })
        .limit(1000);
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      type RawLesson = {
        id: number;
        module_id: number;
        sort_order: number;
        title: string | null;
        description: string | null;
        external_video_url: string | null;
        cover_image_path: string | null;
        status: ContentStatus;
        course_modules?: {
          title?: string | null;
          courses?: { id?: number | null; title?: string | null } | null;
        } | null;
      };
      const mapped: Row[] = ((data ?? []) as unknown as RawLesson[]).map((l) => ({
        id: l.id,
        module_id: l.module_id,
        module_title: l.course_modules?.title ?? "",
        course_id: l.course_modules?.courses?.id ?? 0,
        course_title: l.course_modules?.courses?.title ?? "",
        sort_order: l.sort_order,
        title: l.title ?? "",
        description: l.description,
        external_video_url: l.external_video_url,
        cover_image_path: l.cover_image_path,
        status: l.status,
      }));
      mapped.sort((a, b) =>
        a.course_title.localeCompare(b.course_title) ||
        a.module_title.localeCompare(b.module_title) ||
        a.sort_order - b.sort_order,
      );
      setRows(mapped);
      setLoading(false);
    })();
  }, []);

  const courses = useMemo(() => {
    const m = new Map<number, string>();
    rows.forEach((r) => m.set(r.course_id, r.course_title));
    return Array.from(m.entries()).map(([id, title]) => ({ id, title }));
  }, [rows]);

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (filterCourse !== "all" && String(r.course_id) !== filterCourse) return false;
      const effStatus = (dirty[r.id]?.status ?? r.status) as ContentStatus;
      if (filterStatus !== "all" && effStatus !== filterStatus) return false;
      const effUrl = dirty[r.id]?.external_video_url ?? r.external_video_url;
      const effCover = dirty[r.id]?.cover_image_path ?? r.cover_image_path;
      if (filterFlag === "no-video" && effUrl && !isPlaceholderVideo(effUrl)) return false;
      if (filterFlag === "no-thumb" && effCover) return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, dirty, filterCourse, filterStatus, filterFlag, search]);

  const patch = (id: number, p: Patch) => {
    setDirty((d) => ({ ...d, [id]: { ...d[id], ...p } }));
  };

  const dirtyCount = Object.keys(dirty).length;

  const saveAll = async () => {
    const entries = Object.entries(dirty);
    if (!entries.length) return;
    let ok = 0, fail = 0;
    await Promise.all(
      entries.map(async ([idStr, p]) => {
        const id = Number(idStr);
        try {
          const payload: Patch & Partial<{ published_at: string | null; archived_at: string | null }> = { ...p };
          if (p.status) Object.assign(payload, statusTransition(p.status));
          await updateLesson(id, payload);
          ok++;
        } catch (e: unknown) {
          fail++;
          console.error("update lesson failed", id, e);
        }
      }),
    );
    // merge into rows
    setRows((rs) =>
      rs.map((r) => (dirty[r.id] ? { ...r, ...dirty[r.id] } as Row : r)),
    );
    setDirty({});
    toast[fail ? "warning" : "success"](`Saved ${ok}${fail ? `, ${fail} failed` : ""}`);
  };

  const bulkStatus = async (status: ContentStatus) => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
    if (!ids.length) return toast.info("Select lessons first");
    let ok = 0, skipped = 0, fail = 0;
    await Promise.all(
      ids.map(async (id) => {
        const r = rows.find((x) => x.id === id);
        if (!r) return;
        const effUrl = dirty[id]?.external_video_url ?? r.external_video_url;
        if (status === "published" && (!effUrl || isPlaceholderVideo(effUrl))) {
          skipped++;
          return;
        }
        try {
          await updateLesson(id, statusTransition(status));
          ok++;
        } catch {
          fail++;
        }
      }),
    );
    setRows((rs) => rs.map((r) => (selected[r.id] && (status !== "published" || (r.external_video_url && !isPlaceholderVideo(r.external_video_url))) ? { ...r, status } : r)));
    setSelected({});
    toast.success(`Updated ${ok}${skipped ? ` · ${skipped} skipped (no video)` : ""}${fail ? ` · ${fail} failed` : ""}`);
  };

  const bulkDelete = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => Number(k));
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} lesson(s)?`)) return;
    const { error } = await supabase.from("lessons").delete().in("id", ids);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.filter((r) => !ids.includes(r.id)));
    setSelected({});
    toast.success(`Deleted ${ids.length}`);
  };

  const handleUpload = async (id: number, file: File) => {
    try {
      const url = await uploadCoverImage(file, "lessons");
      patch(id, { cover_image_path: url });
      toast.success("Thumbnail uploaded — remember to Save");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <AdminShell
      title="Bulk lesson editor"
      description="Edit titles, video URLs, descriptions, thumbnails and status across all lessons."
      crumbs={[{ label: "Bulk lessons" }]}
      actions={
        <>
          <Link to="/admin/courses"><Button variant="outline">Courses</Button></Link>
          <Button onClick={saveAll} disabled={!dirtyCount}>
            <Save className="w-4 h-4 mr-1" /> Save changes ({dirtyCount})
          </Button>
        </>
      }
    >
      <Card className="p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground/60">Course</label>
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {courses.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground/60">Status</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground/60">Flag</label>
          <Select value={filterFlag} onValueChange={(v) => setFilterFlag(v as "all" | "no-video" | "no-thumb")}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="no-video">Missing video</SelectItem>
              <SelectItem value="no-thumb">Missing thumb</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs text-foreground/60">Search title</label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search…" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => bulkStatus("published")}>Publish selected</Button>
          <Button size="sm" variant="outline" onClick={() => bulkStatus("draft")}>Move to draft</Button>
          <Button size="sm" variant="outline" onClick={() => bulkStatus("archived")}>Archive</Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-foreground/60">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-foreground/60 border-b">
              <tr>
                <th className="p-2"></th>
                <th className="p-2 text-left">Course / Module</th>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Video URL</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-left">Thumbnail</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const eff = { ...r, ...(dirty[r.id] ?? {}) };
                const isDirty = !!dirty[r.id];
                return (
                  <tr key={r.id} className={`border-b align-top ${isDirty ? "bg-amber-50/40" : ""}`}>
                    <td className="p-2">
                      <Checkbox
                        checked={!!selected[r.id]}
                        onCheckedChange={(v) => setSelected((s) => ({ ...s, [r.id]: !!v }))}
                      />
                    </td>
                    <td className="p-2 text-xs text-foreground/70 min-w-[160px]">
                      <div className="font-medium text-foreground">{r.course_title}</div>
                      <div>{r.module_title}</div>
                    </td>
                    <td className="p-2 text-xs font-mono">{r.sort_order}</td>
                    <td className="p-2 min-w-[200px]">
                      <Input value={eff.title} onChange={(e) => patch(r.id, { title: e.target.value })} />
                    </td>
                    <td className="p-2 min-w-[260px]">
                      <div className="flex gap-1">
                        <Input
                          value={eff.external_video_url ?? ""}
                          placeholder="https://…"
                          onChange={(e) => patch(r.id, { external_video_url: e.target.value || null })}
                        />
                        {eff.external_video_url && (
                          <a href={eff.external_video_url} target="_blank" rel="noreferrer" className="px-2 self-center text-foreground/60 hover:text-foreground">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {eff.external_video_url && isPlaceholderVideo(eff.external_video_url) && (
                        <div className="text-[10px] text-amber-700 mt-1">placeholder URL</div>
                      )}
                    </td>
                    <td className="p-2 min-w-[220px]">
                      <Textarea
                        rows={2}
                        value={eff.description ?? ""}
                        onChange={(e) => patch(r.id, { description: e.target.value || null })}
                      />
                    </td>
                    <td className="p-2 min-w-[140px]">
                      {eff.cover_image_path && (
                        <img src={eff.cover_image_path} alt="" className="w-20 h-12 object-cover rounded mb-1" />
                      )}
                      <label className="inline-flex items-center gap-1 text-xs cursor-pointer text-foreground/70 hover:text-foreground">
                        <Upload className="w-3 h-3" /> Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(r.id, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </td>
                    <td className="p-2">
                      <Select value={eff.status} onValueChange={(v: ContentStatus) => patch(r.id, { status: v })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr><td colSpan={8} className="p-6 text-center text-foreground/60">No lessons match the filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
