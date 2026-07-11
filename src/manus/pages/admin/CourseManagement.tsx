import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, MoreVertical, Eye, Copy, Archive, Rocket, PauseCircle, Grid3x3, Table as TableIcon, Pencil, Trash2 } from "lucide-react";
import AdminShell from "@/manus/components/admin/AdminShell";
import StatusBadge from "@/manus/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CreateCourseWizard from "@/manus/components/admin/course-wizard/CreateCourseWizard";
import { BulkLessonsPanel } from "@/manus/pages/admin/AdminLessonsBulk";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminQuizzesInner } from "@/manus/pages/admin/AdminQuizzes";
import { AdminCertificatesInner } from "@/manus/pages/admin/AdminCertificates";
import { AdminCoursesListInner } from "@/manus/pages/admin/AdminCoursesList";
import {
  listCoursesRich, listCategories, listInstructors, archiveCourse,
  duplicateCourse, deleteCourse, setCourseStatus, CONTENT_STATUSES, type CourseRow,
} from "@/manus/lib/course-management";
import type { ContentStatus } from "@/manus/lib/admin-content";
import { PREVIEW_PLAN_LABELS, setPreviewPlan, type PreviewPlan } from "@/manus/lib/admin-preview";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useMemo(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function CourseManagement() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [status, setStatus] = useState<ContentStatus | "all">("all");
  const [instructorId, setInstructorId] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"title_asc" | "title_desc" | "updated_desc" | "updated_asc" | "status">("updated_desc");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [page, setPage] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<CourseRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CourseRow | null>(null);
  type Tab = "courses" | "bulk" | "legacy" | "quizzes" | "certificates";
  const validTab = (v: string | null): Tab =>
    v === "bulk" || v === "legacy" || v === "quizzes" || v === "certificates" ? v : "courses";
  const [tab, setTab] = useState<Tab>(() => validTab(params.get("tab")));
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (tab === "courses") next.delete("tab"); else next.set("tab", tab);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Auto-open wizard when arriving from a "New course" shortcut (?new=1).
  useEffect(() => {
    if (params.get("new") === "1") {
      setWizardOpen(true);
      const next = new URLSearchParams(params); next.delete("new"); setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const { data: categories = [] } = useQuery({ queryKey: ["cm-categories"], queryFn: listCategories });
  const { data: instructors = [] } = useQuery({ queryKey: ["cm-instructors"], queryFn: listInstructors });
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["cm-courses", debouncedSearch, status, instructorId, categoryId, from, to, sort, page],
    queryFn: () => listCoursesRich({
      search: debouncedSearch || undefined,
      status, instructorId,
      categoryId: categoryId === "all" ? "all" : Number(categoryId),
      from: from || null, to: to || null, sort, page, pageSize: 20,
    }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["cm-courses"] });

  const dup = useMutation({
    mutationFn: (id: number) => duplicateCourse(id),
    onSuccess: (c) => { toast.success("Course duplicated"); navigate(`/admin/course-management/${c.id}`); invalidate(); },
    onError: (e: Error) => toast.error("Duplicate failed", { description: e.message }),
  });
  const setStatusM = useMutation({
    mutationFn: ({ id, s }: { id: number; s: ContentStatus }) => setCourseStatus(id, s),
    onSuccess: () => { toast.success("Status updated"); invalidate(); },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });
  const archM = useMutation({
    mutationFn: (id: number) => archiveCourse(id),
    onSuccess: () => { toast.success("Course archived"); invalidate(); setConfirmArchive(null); },
    onError: (e: Error) => toast.error("Archive failed", { description: e.message }),
  });
  const delM = useMutation({
    mutationFn: (id: number) => deleteCourse(id),
    onSuccess: () => { toast.success("Course deleted"); invalidate(); setConfirmDelete(null); },
    onError: (e: Error) => toast.error("Delete failed", { description: e.message }),
  });

  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];
  const pageCount = Math.max(1, Math.ceil(total / 20));

  return (
    <AdminShell
      title="Course Management"
      description="Create, organize, publish and audit every course from a single control room."
      crumbs={[{ label: "Course Management" }]}
      actions={
        <Button onClick={() => setWizardOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Create new course
        </Button>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-6">
        <TabsList>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="bulk">Bulk lesson editor</TabsTrigger>
          <TabsTrigger value="legacy">Legacy tree</TabsTrigger>
          <TabsTrigger value="quizzes">Quiz bank</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
        </TabsList>
        <TabsContent value="bulk" className="mt-4">
          <BulkLessonsPanel embedded />
        </TabsContent>
        <TabsContent value="legacy" className="mt-4">
          <AdminCoursesListInner embedded />
        </TabsContent>
        <TabsContent value="quizzes" className="mt-4">
          <AdminQuizzesInner embedded />
        </TabsContent>
        <TabsContent value="certificates" className="mt-4">
          <AdminCertificatesInner embedded />
        </TabsContent>
        <TabsContent value="courses" className="mt-4">
      <div className="rounded-lg border border-border bg-card p-4 mb-6 grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-foreground/50" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or slug…" className="pl-8" />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v as ContentStatus | "all"); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CONTENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={instructorId} onValueChange={(v) => { setInstructorId(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Instructor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All instructors</SelectItem>
            {instructors.map((i) => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Updated · newest</SelectItem>
            <SelectItem value="updated_asc">Updated · oldest</SelectItem>
            <SelectItem value="title_asc">Name · A→Z</SelectItem>
            <SelectItem value="title_desc">Name · Z→A</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2 md:col-span-2">
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <div className="flex justify-end gap-2 md:col-span-4">
          <Button size="sm" variant={view === "cards" ? "default" : "outline"} onClick={() => setView("cards")}>
            <Grid3x3 className="w-4 h-4 mr-1" /> Cards
          </Button>
          <Button size="sm" variant={view === "table" ? "default" : "outline"} onClick={() => setView("table")}>
            <TableIcon className="w-4 h-4 mr-1" /> Table
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-lg" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-16 text-center">
          <p className="text-foreground/70 mb-4">No courses match these filters.</p>
          <Button onClick={() => setWizardOpen(true)}><Plus className="w-4 h-4 mr-2" /> Create your first course</Button>
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((c) => (
            <CourseCard
              key={c.id} course={c}
              onDuplicate={() => dup.mutate(c.id)}
              onArchive={() => setConfirmArchive(c)}
              onDelete={() => setConfirmDelete(c)}
              onPublish={() => setStatusM.mutate({ id: c.id, s: "published" })}
              onUnpublish={() => setStatusM.mutate({ id: c.id, s: "draft" })}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Instructor</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Lessons</th>
                <th className="px-3 py-2">Enrolled</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link to={`/admin/course-management/${c.id}`} className="hover:underline font-medium">{c.title}</Link>
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={c.status} /></td>
                  <td className="px-3 py-2">{c.instructor_display ?? "—"}</td>
                  <td className="px-3 py-2">{c.category?.name ?? "—"}</td>
                  <td className="px-3 py-2">{c.lessons_count}</td>
                  <td className="px-3 py-2">{c.enrollments_count}</td>
                  <td className="px-3 py-2">{new Date(c.updated_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <RowMenu
                      course={c}
                      onDuplicate={() => dup.mutate(c.id)}
                      onArchive={() => setConfirmArchive(c)}
                      onDelete={() => setConfirmDelete(c)}
                      onPublish={() => setStatusM.mutate({ id: c.id, s: "published" })}
                      onUnpublish={() => setStatusM.mutate({ id: c.id, s: "draft" })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm">
          <span className="text-foreground/60">Page {page} of {pageCount} · {total} courses{isFetching ? " · updating…" : ""}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
        </TabsContent>
      </Tabs>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create new course</DialogTitle></DialogHeader>
          <CreateCourseWizard
            onCreated={(id) => { setWizardOpen(false); invalidate(); navigate(`/admin/course-management/${id}`); }}
            onCancel={() => setWizardOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmArchive} onOpenChange={(o) => !o && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this course?</AlertDialogTitle>
            <AlertDialogDescription>
              “{confirmArchive?.title}” will be hidden from members. Existing enrollments and progress are preserved and can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmArchive && archM.mutate(confirmArchive.id)}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmDelete?.title}” permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the course, its modules, lessons and quizzes for good. Student progress records are also lost. This action cannot be undone — prefer <strong>Archive</strong> if you might restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmDelete && delM.mutate(confirmDelete.id)}>Delete permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function CourseCard({ course, onDuplicate, onArchive, onDelete, onPublish, onUnpublish }: {
  course: CourseRow;
  onDuplicate: () => void; onArchive: () => void; onDelete: () => void; onPublish: () => void; onUnpublish: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div className="aspect-video bg-muted relative">
        {course.cover_image_path ? (
          <img src={course.cover_image_path} alt={course.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-foreground/40 text-sm">No cover</div>
        )}
        <div className="absolute top-2 left-2"><StatusBadge status={course.status} /></div>
        <div className="absolute top-1 right-1">
          <RowMenu course={course} onDuplicate={onDuplicate} onArchive={onArchive} onDelete={onDelete} onPublish={onPublish} onUnpublish={onUnpublish} />
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-1">
        <Link to={`/admin/course-management/${course.id}`} className="font-medium hover:underline">{course.title}</Link>
        <p className="text-xs text-foreground/60">{course.category?.name ?? "Uncategorized"} · {course.instructor_display ?? "No instructor"}</p>
        <div className="mt-auto pt-3 flex items-center justify-between text-xs text-foreground/60">
          <span>{course.lessons_count} lessons</span>
          <span>{course.enrollments_count} enrolled</span>
          <span>{new Date(course.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

function RowMenu({ course, onDuplicate, onArchive, onDelete, onPublish, onUnpublish }: {
  course: CourseRow;
  onDuplicate: () => void; onArchive: () => void; onDelete: () => void; onPublish: () => void; onUnpublish: () => void;
}) {
  const PLANS: PreviewPlan[] = ["none", "free", "monthly_member", "annual_member", "individual_course"];
  const previewAs = (p: PreviewPlan) => {
    setPreviewPlan(p);
    window.open(`/courses/${course.id}`, "_blank", "noopener");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 bg-background/70 hover:bg-background"><MoreVertical className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild><Link to={`/admin/course-management/${course.id}`}><Pencil className="w-4 h-4 mr-2" /> Edit</Link></DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Eye className="w-4 h-4 mr-2" /> View as member…</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuLabel>Simulate plan</DropdownMenuLabel>
            {PLANS.map((p) => (
              <DropdownMenuItem key={p} onClick={() => previewAs(p)}>{PREVIEW_PLAN_LABELS[p]}</DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={onDuplicate}><Copy className="w-4 h-4 mr-2" /> Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        {course.status === "published"
          ? <DropdownMenuItem onClick={onUnpublish}><PauseCircle className="w-4 h-4 mr-2" /> Unpublish</DropdownMenuItem>
          : <DropdownMenuItem onClick={onPublish}><Rocket className="w-4 h-4 mr-2" /> Publish</DropdownMenuItem>}
        <DropdownMenuItem onClick={onArchive} className="text-destructive"><Archive className="w-4 h-4 mr-2" /> Archive</DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete permanently</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}