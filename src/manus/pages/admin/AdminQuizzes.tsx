import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Eye, FileQuestion, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AdminShell from "@/manus/components/admin/AdminShell";
import QuizCard from "@/manus/components/learning/QuizCard";

// Static mapping of the pilot bank: 1 quiz per course (by slug).
// Keep this list in sync with supabase/functions/seed-pilot-quizzes/bank.ts.
const PILOT_MAP: Array<{ slug: string; module: string; title: string }> = [
  { slug: "the-path-to-a-colourful-life", module: "Module 1", title: "The Basics to Start" },
  { slug: "the-sacred-bedroom", module: "Module 2", title: "Bedroom" },
  { slug: "the-alchemic-kitchen", module: "Module 3", title: "Kitchen" },
  { slug: "the-elemental-bathroom", module: "Module 4", title: "Bathrooms" },
  { slug: "the-soulful-living-room", module: "Module 5", title: "Living" },
  { slug: "the-crafted-dining-room", module: "Module 6", title: "Dining" },
  { slug: "catalyst-workspace", module: "Module 7", title: "Home Office" },
  { slug: "kids-legacy-draft", module: "Module 8", title: "Kids" },
  { slug: "knowledgeable-cheat-sheets", module: "Module 9", title: "All Things Design" },
  { slug: "enchanted-outdoors", module: "Module 10", title: "Outdoors" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;

type Row = {
  slug: string;
  module: string;
  title: string;
  course_id: number | null;
  course_title: string | null;
  quiz_id: number | null;
  quiz_status: string | null;
  question_count: number;
};

async function fetchOverview(): Promise<Row[]> {
  const slugs = PILOT_MAP.map((p) => p.slug);
  const { data: courses, error: cErr } = await db
    .from("courses")
    .select("id, slug, title")
    .in("slug", slugs);
  if (cErr) throw cErr;
  const courseBySlug = new Map<string, { id: number; title: string }>(
    (courses ?? []).map((c: { id: number; slug: string; title: string }) => [c.slug, c]),
  );

  const courseIds = (courses ?? []).map((c: { id: number }) => c.id);
  const quizzesBySlug = new Map<string, { id: number; status: string; question_count: number }>();
  if (courseIds.length) {
    const { data: quizzes } = await db
      .from("quizzes")
      .select("id, course_id, title, status")
      .in("course_id", courseIds);

    const quizIds = (quizzes ?? []).map((q: { id: number }) => q.id);
    const countByQuiz = new Map<number, number>();
    if (quizIds.length) {
      const { data: qs } = await db
        .from("quiz_questions")
        .select("id, quiz_id")
        .in("quiz_id", quizIds);
      for (const row of qs ?? []) {
        countByQuiz.set(row.quiz_id, (countByQuiz.get(row.quiz_id) ?? 0) + 1);
      }
    }

    // Prefer the pilot quiz matching the module title; fall back to the first.
    for (const p of PILOT_MAP) {
      const course = courseBySlug.get(p.slug);
      if (!course) continue;
      const courseQuizzes = (quizzes ?? []).filter(
        (q: { course_id: number }) => q.course_id === course.id,
      );
      const match =
        courseQuizzes.find((q: { title: string }) => q.title.includes(p.title)) ??
        courseQuizzes[0];
      if (match) {
        quizzesBySlug.set(p.slug, {
          id: match.id,
          status: match.status,
          question_count: countByQuiz.get(match.id) ?? 0,
        });
      }
    }
  }

  return PILOT_MAP.map((p) => {
    const course = courseBySlug.get(p.slug) ?? null;
    const quiz = quizzesBySlug.get(p.slug) ?? null;
    return {
      slug: p.slug,
      module: p.module,
      title: p.title,
      course_id: course?.id ?? null,
      course_title: course?.title ?? null,
      quiz_id: quiz?.id ?? null,
      quiz_status: quiz?.status ?? null,
      question_count: quiz?.question_count ?? 0,
    };
  });
}

export default function AdminQuizzes() {
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ["admin-quizzes-overview"], queryFn: fetchOverview });
  const [previewQuizId, setPreviewQuizId] = useState<number | null>(null);

  const seedMutation = useMutation({
    mutationFn: async (slug?: string) => {
      const { data, error } = await supabase.functions.invoke("seed-pilot-quizzes", {
        body: slug ? { course_slug: slug } : {},
      });
      if (error) throw error;
      return data as { ok: boolean; results: Array<{ slug: string; ok: boolean; reason?: string }> };
    },
    onSuccess: (res) => {
      const failed = res.results.filter((r) => !r.ok);
      if (failed.length) {
        toast.error(
          `Seeded with errors: ${failed.map((f) => `${f.slug} (${f.reason ?? "unknown"})`).join(", ")}`,
        );
      } else {
        toast.success(`Seeded ${res.results.length} quiz${res.results.length === 1 ? "" : "zes"}.`);
      }
      qc.invalidateQueries({ queryKey: ["admin-quizzes-overview"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const rows = overview.data ?? [];
  const totals = useMemo(() => {
    const seeded = rows.filter((r) => r.quiz_id != null).length;
    const published = rows.filter((r) => r.quiz_status === "published").length;
    const questions = rows.reduce((acc, r) => acc + r.question_count, 0);
    return { seeded, published, questions };
  }, [rows]);

  return (
    <AdminShell
      crumbs={[{ label: "Admin", to: "/admin" }, { label: "Quizzes" }]}
      title="Quizzes"
      description="Pilot knowledge-check bank — 10 modules × 5 questions, mapped one-to-one to the official courses."
      actions={
        <Button
          size="sm"
          onClick={() => seedMutation.mutate(undefined)}
          disabled={seedMutation.isPending}
        >
          {seedMutation.isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3 mr-1" />
          )}
          Seed / re-seed all 10 modules
        </Button>
      }
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-foreground/60">Seeded</p>
          <p className="text-2xl font-serif">{totals.seeded} / {PILOT_MAP.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-foreground/60">Published</p>
          <p className="text-2xl font-serif">{totals.published} / {PILOT_MAP.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wider text-foreground/60">Total questions</p>
          <p className="text-2xl font-serif">{totals.questions} / 50</p>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden mt-4">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-foreground/60">
            <tr>
              <th className="text-left p-3">Module</th>
              <th className="text-left p-3">Course</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Qs</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {overview.isLoading && (
              <tr><td colSpan={5} className="p-6 text-center text-foreground/60">Loading…</td></tr>
            )}
            {!overview.isLoading && rows.map((r) => (
              <tr key={r.slug} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{r.module}</div>
                  <div className="text-xs text-foreground/60">{r.title}</div>
                </td>
                <td className="p-3">
                  {r.course_id ? (
                    <Link to={`/admin/courses/${r.course_id}`} className="hover:underline inline-flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {r.course_title}
                    </Link>
                  ) : (
                    <span className="text-destructive text-xs">course missing ({r.slug})</span>
                  )}
                </td>
                <td className="p-3">
                  {r.quiz_id ? (
                    <Badge variant={r.quiz_status === "published" ? "default" : "secondary"}>
                      {r.quiz_status}
                    </Badge>
                  ) : (
                    <Badge variant="outline">not seeded</Badge>
                  )}
                </td>
                <td className="p-3 text-foreground/70">
                  <span className="inline-flex items-center gap-1">
                    <FileQuestion className="w-3 h-3" /> {r.question_count}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  {r.quiz_id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewQuizId((id) => (id === r.quiz_id ? null : r.quiz_id))}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      {previewQuizId === r.quiz_id ? "Hide" : "Preview"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!r.course_id || seedMutation.isPending}
                    onClick={() => seedMutation.mutate(r.slug)}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {r.quiz_id ? "Re-seed" : "Seed"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {previewQuizId != null && (
        <Card className="p-5 mt-4 space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-foreground/60">
            Preview · no attempt is recorded
          </p>
          <QuizCard quizId={previewQuizId} previewAsAdmin />
        </Card>
      )}
    </AdminShell>
  );
}
