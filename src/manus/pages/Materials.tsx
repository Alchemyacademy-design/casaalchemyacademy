import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink, FileText, Loader2, Lock, Paperclip, Search } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";
import {
  formatBytes,
  getMaterialUrl,
  listAllMaterials,
  type MaterialKind,
  type SupportMaterial,
} from "@/manus/lib/support-materials";

type Labels = {
  courses: Record<number, string>;
  modules: Record<number, string>;
  lessons: Record<number, string>;
};

const KIND_LABEL: Record<MaterialKind, string> = {
  bonus: "Member bonuses",
  course: "Course materials",
  module: "Module materials",
  lesson: "Lesson materials",
};

const KIND_ORDER: MaterialKind[] = ["bonus", "course", "module", "lesson"];

async function loadLabels(materials: SupportMaterial[]): Promise<Labels> {
  const courseIds = [...new Set(materials.map((m) => m.course_id).filter((v): v is number => !!v))];
  const moduleIds = [...new Set(materials.map((m) => m.module_id).filter((v): v is number => !!v))];
  const lessonIds = [...new Set(materials.map((m) => m.lesson_id).filter((v): v is number => !!v))];

  const [courses, modules, lessons] = await Promise.all([
    courseIds.length ? supabase.from("courses").select("id,title").in("id", courseIds) : Promise.resolve({ data: [] }),
    moduleIds.length
      ? supabase.from("course_modules").select("id,title").in("id", moduleIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length ? supabase.from("lessons").select("id,title").in("id", lessonIds) : Promise.resolve({ data: [] }),
  ]);

  const toMap = (rows: { id: number; title: string | null }[] | null | undefined) =>
    Object.fromEntries((rows ?? []).map((r) => [r.id, r.title ?? ""])) as Record<number, string>;

  return {
    courses: toMap(courses.data as never),
    modules: toMap(modules.data as never),
    lessons: toMap(lessons.data as never),
  };
}

function contextOf(material: SupportMaterial, labels: Labels) {
  if (material.material_kind === "bonus") return "Available to all members";
  if (material.lesson_id && labels.lessons[material.lesson_id]) return labels.lessons[material.lesson_id];
  if (material.module_id && labels.modules[material.module_id]) return labels.modules[material.module_id];
  if (material.course_id && labels.courses[material.course_id]) return labels.courses[material.course_id];
  return "Your library";
}

function MaterialCard({ material, context }: { material: SupportMaterial; context: string }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    try {
      setBusy(true);
      const url = await getMaterialUrl(material);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open this material");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="flex w-full min-h-[56px] items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-4 text-left transition-colors hover:border-primary/50 hover:bg-card"
    >
      {material.external_url ? (
        <ExternalLink className="h-5 w-5 shrink-0 text-primary" />
      ) : (
        <FileText className="h-5 w-5 shrink-0 text-primary" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{material.title ?? material.file_name}</span>
        <span className="block truncate text-xs text-foreground/60">
          {material.description ? `${material.description} · ` : ""}
          {context}
        </span>
      </span>
      <span className="hidden shrink-0 text-[11px] uppercase tracking-wide text-foreground/50 sm:block">
        {material.external_url ? "link" : formatBytes(material.file_size) || "file"}
      </span>
      {busy ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-foreground/50" />
      ) : (
        <Download className="h-4 w-4 shrink-0 text-foreground/50" />
      )}
    </button>
  );
}

export default function Materials() {
  const { isAuthenticated } = useAuth();
  const [term, setTerm] = useState("");

  // RLS on lesson_attachments only returns materials the signed-in user is
  // entitled to (course/module/lesson access, or public member bonuses).
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["my-materials"],
    queryFn: listAllMaterials,
    enabled: isAuthenticated,
  });

  const { data: labels } = useQuery({
    queryKey: ["my-materials-labels", materials.map((m) => m.id).join(",")],
    queryFn: () => loadLabels(materials),
    enabled: materials.length > 0,
  });

  const grouped = useMemo(() => {
    const safeLabels: Labels = labels ?? { courses: {}, modules: {}, lessons: {} };
    const q = term.trim().toLowerCase();
    const map = new Map<MaterialKind, { material: SupportMaterial; context: string }[]>();
    for (const material of materials) {
      const context = contextOf(material, safeLabels);
      const haystack = `${material.title ?? ""} ${material.file_name} ${material.description ?? ""} ${context}`.toLowerCase();
      if (q && !haystack.includes(q)) continue;
      const list = map.get(material.material_kind) ?? [];
      list.push({ material, context });
      map.set(material.material_kind, list);
    }
    return map;
  }, [materials, labels, term]);

  const total = [...grouped.values()].reduce((sum, list) => sum + list.length, 0);

  return (
    <MemberLayout>
      <div className="p-6 md:p-10" style={{ backgroundColor: "var(--aa-cream)" }}>
        <div className="mb-8">
          <p className="section-label mb-2">Your library</p>
          <h1 className="font-serif text-3xl md:text-4xl mb-3" style={{ color: "var(--aa-olive-dark)", fontWeight: 300 }}>
            Master Guides
          </h1>
          <p className="max-w-xl text-sm" style={{ color: "var(--aa-text-mid)", fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>
            Every workbook, template and resource unlocked by your membership and the courses you have access to.
          </p>
        </div>

        <div className="relative mb-6 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            type="search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search materials…"
            aria-label="Search materials"
            className="h-11 w-full rounded-xl border border-border/60 bg-card/70 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your materials…
          </div>
        ) : total === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/60 p-8 text-center">
            <Lock className="mx-auto mb-3 h-6 w-6 text-primary" />
            <p className="text-sm font-medium">No materials available yet</p>
            <p className="mx-auto mt-2 max-w-sm text-xs text-foreground/60">
              Materials appear here as soon as they are released for your plan or for the courses you are enrolled in.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {KIND_ORDER.filter((kind) => (grouped.get(kind) ?? []).length > 0).map((kind) => (
              <section key={kind} className="space-y-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Paperclip className="h-4 w-4 text-primary" /> {KIND_LABEL[kind]}
                  <span className="text-xs font-normal text-foreground/50">({(grouped.get(kind) ?? []).length})</span>
                </h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {(grouped.get(kind) ?? []).map(({ material, context }) => (
                    <MaterialCard key={material.id} material={material} context={context} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </MemberLayout>
  );
}