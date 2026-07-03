import { useReducer, useState, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUploadField from "@/manus/components/admin/FileUploadField";
import {
  slugify, slugTaken, createCourse, updateCourse,
  type PlanKey, PLAN_KEYS,
} from "@/manus/lib/admin-content";
import {
  listCategories, ACCESS_TYPES, RELEASE_TYPES, LEVELS, publishCourse, setCourseStatus,
  type CourseAccessType, type CourseReleaseType, type CourseLevel,
} from "@/manus/lib/course-management";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Save, Rocket, Clock, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type State = {
  step: 1 | 2 | 3 | 4;
  courseId: number | null;
  // Step 1
  title: string; subtitle: string; slug: string; slugEdited: boolean;
  short_description: string; description: string;
  cover_image_path: string | null; banner_url: string | null; trailer_url: string;
  category_id: number | null; instructor_name: string;
  level: CourseLevel | ""; language: string; estimated_duration: number | "";
  has_certificate: boolean; is_featured: boolean;
  // Step 2
  access_type: CourseAccessType; access_plan_keys: PlanKey[];
  // Step 3
  release_type: CourseReleaseType; release_after_days: number | ""; release_at: string;
};

const initial: State = {
  step: 1, courseId: null,
  title: "", subtitle: "", slug: "", slugEdited: false,
  short_description: "", description: "",
  cover_image_path: null, banner_url: null, trailer_url: "",
  category_id: null, instructor_name: "",
  level: "", language: "en", estimated_duration: "",
  has_certificate: false, is_featured: false,
  access_type: "plan", access_plan_keys: ["annual_member", "monthly_member", "individual_course"],
  release_type: "all_at_once", release_after_days: "", release_at: "",
};

type Action = { type: "set"; patch: Partial<State> } | { type: "step"; step: State["step"] };
function reducer(s: State, a: Action): State {
  if (a.type === "set") return { ...s, ...a.patch };
  return { ...s, step: a.step };
}

const step1Schema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes").max(80),
});

export default function CreateCourseWizard({
  onCreated, onCancel,
}: { onCreated: (id: number) => void; onCancel: () => void }) {
  const [s, dispatch] = useReducer(reducer, initial);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [busy, setBusy] = useState(false);

  const { data: categories = [] } = useQuery({ queryKey: ["wiz-categories"], queryFn: listCategories });

  // Auto-slug + duplicate check
  useEffect(() => {
    if (!s.slugEdited) dispatch({ type: "set", patch: { slug: slugify(s.title) } });
  }, [s.title, s.slugEdited]);
  useEffect(() => {
    if (!s.slug) return setSlugStatus("idle");
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      try { setSlugStatus((await slugTaken(s.slug)) ? "taken" : "ok"); } catch { setSlugStatus("idle"); }
    }, 350);
    return () => clearTimeout(t);
  }, [s.slug]);

  async function ensureCourse(): Promise<number> {
    if (s.courseId) return s.courseId;
    const parse = step1Schema.safeParse({ title: s.title, slug: s.slug });
    if (!parse.success) throw new Error(parse.error.issues[0]?.message ?? "Invalid step");
    if (slugStatus === "taken") throw new Error("Slug is already used by another course");
    const created = await createCourse({
      title: s.title, slug: s.slug,
      subtitle: s.subtitle || null, description: s.description || null,
      cover_image_path: s.cover_image_path,
      access_plan_keys: s.access_plan_keys,
      status: "draft",
    });
    dispatch({ type: "set", patch: { courseId: created.id } });
    return created.id;
  }

  async function saveMeta(id: number) {
    await updateCourse(id, {
      title: s.title, slug: s.slug, subtitle: s.subtitle || null,
      short_description: s.short_description || null, description: s.description || null,
      cover_image_path: s.cover_image_path, banner_url: s.banner_url, trailer_url: s.trailer_url || null,
      category_id: s.category_id, instructor_name: s.instructor_name || null,
      level: s.level || null, language: s.language || "en",
      estimated_duration: typeof s.estimated_duration === "number" ? s.estimated_duration : null,
      has_certificate: s.has_certificate, is_featured: s.is_featured,
      access_type: s.access_type, access_plan_keys: s.access_plan_keys,
      release_type: s.release_type,
      release_after_days: typeof s.release_after_days === "number" ? s.release_after_days : null,
      release_at: s.release_at || null,
    } as never);
  }

  async function advance() {
    try {
      setBusy(true);
      if (s.step === 1) {
        const id = await ensureCourse();
        await saveMeta(id);
      } else if (s.courseId) {
        await saveMeta(s.courseId);
      }
      dispatch({ type: "step", step: (Math.min(4, s.step + 1) as State["step"]) });
    } catch (e) {
      toast.error("Could not save", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  async function finish(mode: "draft" | "review" | "schedule" | "publish", scheduledAt?: string) {
    try {
      setBusy(true);
      const id = await ensureCourse();
      await saveMeta(id);
      if (mode === "publish") await publishCourse(id, { immediate: true });
      else if (mode === "schedule" && scheduledAt) await publishCourse(id, { scheduledAt });
      else if (mode === "review") await setCourseStatus(id, "in_review");
      else await setCourseStatus(id, "draft");
      toast.success(mode === "publish" ? "Course published" : mode === "schedule" ? "Publication scheduled" : mode === "review" ? "Sent for review" : "Draft saved");
      onCreated(id);
    } catch (e) {
      toast.error("Could not finish", { description: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <Stepper step={s.step} />
      {s.step === 1 && <Step1 s={s} dispatch={dispatch} categories={categories} slugStatus={slugStatus} />}
      {s.step === 2 && <Step2 s={s} dispatch={dispatch} />}
      {s.step === 3 && <Step3 s={s} dispatch={dispatch} />}
      {s.step === 4 && <Step4 s={s} categories={categories} onFinish={finish} busy={busy} />}

      <div className="flex items-center justify-between border-t border-border mt-6 pt-4">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
        <div className="flex gap-2">
          {s.step > 1 && <Button variant="outline" onClick={() => dispatch({ type: "step", step: (s.step - 1) as State["step"] })} disabled={busy}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>}
          {s.step < 4 && (
            <Button onClick={advance} disabled={busy || (s.step === 1 && (slugStatus === "taken" || !s.title.trim()))}>
              {busy ? "Saving…" : "Continue"} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Main info", "Access", "Release", "Review"];
  return (
    <ol className="flex items-center gap-2 mb-6">
      {labels.map((lbl, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={lbl} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border ${done ? "bg-emerald-500 text-white border-emerald-500" : active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground/60"}`}>
              {done ? <CheckCircle2 className="w-4 h-4" /> : n}
            </div>
            <span className={`text-xs ${active ? "text-foreground font-medium" : "text-foreground/60"}`}>{lbl}</span>
            {i < labels.length - 1 && <div className="flex-1 h-px bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function Step1({ s, dispatch, categories, slugStatus }: { s: State; dispatch: React.Dispatch<Action>; categories: { id: number; name: string }[]; slugStatus: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <Label>Course title *</Label>
        <Input value={s.title} onChange={(e) => dispatch({ type: "set", patch: { title: e.target.value } })} placeholder="e.g. Botanical Perfumery Fundamentals" />
      </div>
      <div>
        <Label>Subtitle</Label>
        <Input value={s.subtitle} onChange={(e) => dispatch({ type: "set", patch: { subtitle: e.target.value } })} />
      </div>
      <div>
        <Label>Slug</Label>
        <Input value={s.slug} onChange={(e) => dispatch({ type: "set", patch: { slug: e.target.value.toLowerCase(), slugEdited: true } })} />
        <p className={`text-xs mt-1 ${slugStatus === "taken" ? "text-destructive" : "text-foreground/60"}`}>
          {slugStatus === "checking" ? "Checking…" : slugStatus === "taken" ? "This slug is already used" : slugStatus === "ok" ? "Available" : "Auto-generated from title"}
        </p>
      </div>
      <div className="md:col-span-2">
        <Label>Short description</Label>
        <Textarea rows={2} value={s.short_description} onChange={(e) => dispatch({ type: "set", patch: { short_description: e.target.value } })} />
      </div>
      <div className="md:col-span-2">
        <Label>Full description</Label>
        <Textarea rows={5} value={s.description} onChange={(e) => dispatch({ type: "set", patch: { description: e.target.value } })} />
      </div>
      <div>
        <Label>Cover image</Label>
        <FileUploadField value={s.cover_image_path} onChange={(v) => dispatch({ type: "set", patch: { cover_image_path: v } })} folder="courses/covers" accept="image/*" preview />
      </div>
      <div>
        <Label>Banner image</Label>
        <FileUploadField value={s.banner_url} onChange={(v) => dispatch({ type: "set", patch: { banner_url: v } })} folder="courses/banners" accept="image/*" preview />
      </div>
      <div>
        <Label>Trailer URL</Label>
        <Input value={s.trailer_url} onChange={(e) => dispatch({ type: "set", patch: { trailer_url: e.target.value } })} placeholder="https://…" />
      </div>
      <div>
        <Label>Category</Label>
        <Select value={s.category_id ? String(s.category_id) : ""} onValueChange={(v) => dispatch({ type: "set", patch: { category_id: v ? Number(v) : null } })}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Instructor name</Label>
        <Input value={s.instructor_name} onChange={(e) => dispatch({ type: "set", patch: { instructor_name: e.target.value } })} />
      </div>
      <div>
        <Label>Level</Label>
        <Select value={s.level || ""} onValueChange={(v) => dispatch({ type: "set", patch: { level: v as CourseLevel } })}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Language</Label>
        <Input value={s.language} onChange={(e) => dispatch({ type: "set", patch: { language: e.target.value } })} />
      </div>
      <div>
        <Label>Estimated duration (minutes)</Label>
        <Input type="number" value={s.estimated_duration} onChange={(e) => dispatch({ type: "set", patch: { estimated_duration: e.target.value ? Number(e.target.value) : "" } })} />
      </div>
      <div className="flex items-center gap-6 md:col-span-2">
        <label className="flex items-center gap-2 text-sm"><Switch checked={s.has_certificate} onCheckedChange={(v) => dispatch({ type: "set", patch: { has_certificate: v } })} /> Certificate available</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={s.is_featured} onCheckedChange={(v) => dispatch({ type: "set", patch: { is_featured: v } })} /> Feature on home</label>
      </div>
    </div>
  );
}

function Step2({ s, dispatch }: { s: State; dispatch: React.Dispatch<Action> }) {
  const togglePlan = (key: PlanKey) => {
    const has = s.access_plan_keys.includes(key);
    dispatch({ type: "set", patch: { access_plan_keys: has ? s.access_plan_keys.filter((k) => k !== key) : [...s.access_plan_keys, key] } });
  };
  return (
    <div className="space-y-4">
      <div>
        <Label>Access type</Label>
        <RadioGroup value={s.access_type} onValueChange={(v) => dispatch({ type: "set", patch: { access_type: v as CourseAccessType } })} className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
          {ACCESS_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 border border-border rounded p-2 cursor-pointer">
              <RadioGroupItem value={t} /> <span className="text-sm capitalize">{t.replace(/_/g, " ")}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
      {(s.access_type === "plan" || s.access_type === "free") && (
        <div>
          <Label>Plans with access</Label>
          <div className="flex flex-wrap gap-3 mt-2">
            {PLAN_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm border border-border rounded p-2">
                <Checkbox checked={s.access_plan_keys.includes(k)} onCheckedChange={() => togglePlan(k)} />
                {k.replace(/_/g, " ")}
              </label>
            ))}
          </div>
          {s.access_plan_keys.length === 0 && <p className="text-xs text-destructive mt-2">Select at least one plan or members will not see this course.</p>}
        </div>
      )}
      {s.access_type === "paid" && (
        <p className="text-xs text-foreground/60">Paid courses use existing Stripe prices. Configure the price in Admin → Plans after creation.</p>
      )}
    </div>
  );
}

function Step3({ s, dispatch }: { s: State; dispatch: React.Dispatch<Action> }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Release strategy</Label>
        <RadioGroup value={s.release_type} onValueChange={(v) => dispatch({ type: "set", patch: { release_type: v as CourseReleaseType } })} className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          {RELEASE_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-2 border border-border rounded p-2 cursor-pointer">
              <RadioGroupItem value={t} /> <span className="text-sm capitalize">{t.replace(/_/g, " ")}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
      {s.release_type === "drip_days" && (
        <div>
          <Label>Days after enrollment</Label>
          <Input type="number" value={s.release_after_days} onChange={(e) => dispatch({ type: "set", patch: { release_after_days: e.target.value ? Number(e.target.value) : "" } })} />
        </div>
      )}
      {s.release_type === "drip_date" && (
        <div>
          <Label>Release date</Label>
          <Input type="datetime-local" value={s.release_at} onChange={(e) => dispatch({ type: "set", patch: { release_at: e.target.value } })} />
        </div>
      )}
    </div>
  );
}

function Step4({ s, categories, onFinish, busy }: {
  s: State; categories: { id: number; name: string }[]; onFinish: (mode: "draft" | "review" | "schedule" | "publish", when?: string) => void; busy: boolean;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const cat = categories.find((c) => c.id === s.category_id)?.name ?? "—";
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div><span className="text-foreground/60">Title:</span> {s.title}</div>
        <div><span className="text-foreground/60">Slug:</span> {s.slug}</div>
        <div><span className="text-foreground/60">Category:</span> {cat}</div>
        <div><span className="text-foreground/60">Instructor:</span> {s.instructor_name || "—"}</div>
        <div><span className="text-foreground/60">Level:</span> {s.level || "—"}</div>
        <div><span className="text-foreground/60">Language:</span> {s.language}</div>
        <div><span className="text-foreground/60">Access:</span> {s.access_type}</div>
        <div><span className="text-foreground/60">Plans:</span> {s.access_plan_keys.join(", ") || "—"}</div>
        <div><span className="text-foreground/60">Release:</span> {s.release_type}</div>
        <div><span className="text-foreground/60">Certificate:</span> {s.has_certificate ? "Yes" : "No"}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => onFinish("draft")} disabled={busy}><Save className="w-4 h-4 mr-2" /> Save as draft</Button>
        <Button variant="outline" onClick={() => onFinish("review")} disabled={busy}><Send className="w-4 h-4 mr-2" /> Send for review</Button>
        <div className="border border-border rounded p-3 md:col-span-2 flex flex-col md:flex-row gap-2 items-start md:items-center">
          <Clock className="w-4 h-4 text-foreground/60" />
          <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="max-w-xs" />
          <Button variant="outline" onClick={() => scheduledAt && onFinish("schedule", scheduledAt)} disabled={busy || !scheduledAt}>Schedule publication</Button>
        </div>
        <Button onClick={() => onFinish("publish")} disabled={busy} className="md:col-span-2"><Rocket className="w-4 h-4 mr-2" /> Publish now</Button>
      </div>
    </div>
  );
}

// Access to supabase client used implicitly via imports above.
void supabase;