import { useMemo, useState } from "react";
import AdminShell from "@/manus/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import CourseCard, { type CourseCardData } from "@/manus/components/learning/CourseCard";
import ModuleCard from "@/manus/components/learning/ModuleCard";
import LearningPath, { type PathModule } from "@/manus/components/learning/LearningPath";
import LessonSidebar from "@/manus/components/learning/LessonSidebar";
import LessonNavigation from "@/manus/components/learning/LessonNavigation";
import LessonMaterial from "@/manus/components/learning/LessonMaterial";
import QuizProgress from "@/manus/components/learning/QuizProgress";
import QuizQuestion from "@/manus/components/learning/QuizQuestion";
import QuizResult from "@/manus/components/learning/QuizResult";
import CertificatePreview from "@/manus/components/learning/CertificatePreview";

/**
 * /admin/phase-2-preview
 *
 * Visual-only Preview Lab. Never reads or writes Supabase. All data here is
 * local fixtures so the admin can verify Phase-2 rendering before content
 * exists in production.
 */

const LANDING_FIXTURES: ReadonlyArray<CourseCardData> = [
  {
    id: 1001,
    title: "The path to a COLOURFUL life",
    subtitle: "Discover how to use the same intricate colour techniques designers rely on.",
    number: 1,
    thumbnail: "/img/course-colour.jpg",
    lessonCount: 7,
    published: true,
    href: "/courses/1001",
  },
  {
    id: 1002,
    title: "The sacred BEDROOM",
    subtitle: "Create a bedroom that feels intentional, not accidental.",
    number: 2,
    thumbnail: "/img/course-bedroom.jpg",
    lessonCount: 6,
    published: true,
    comingSoon: true,
  },
  {
    id: 1003,
    title: "The alchemic KITCHEN",
    subtitle: "Premium curriculum, locked to active members.",
    number: 3,
    thumbnail: "/img/course-kitchen.jpg",
    lessonCount: 8,
    published: true,
    locked: true,
    href: "/plans",
  },
  {
    id: 1004,
    title: "Untitled course (no cover)",
    subtitle: "Fallback rendering when no cover image is uploaded.",
    number: 4,
    lessonCount: 0,
    published: false,
  },
];

const MEMBER_FIXTURES: ReadonlyArray<CourseCardData> = [
  { id: 2001, title: "Not started", subtitle: "Member-view card with 0% progress.", number: 1, lessonCount: 8, progressPercent: 0, href: "#" },
  { id: 2002, title: "In progress", subtitle: "Continue CTA appears.", number: 2, lessonCount: 8, progressPercent: 45, href: "#" },
  { id: 2003, title: "Completed", subtitle: "Review CTA appears.", number: 3, lessonCount: 8, progressPercent: 100, href: "#" },
  { id: 2004, title: "Draft (admin only)", subtitle: "Shown only to admins.", number: 4, lessonCount: 5, progressPercent: 10, published: false, href: "#" },
];

const PATH_MODULES: ReadonlyArray<PathModule> = [
  {
    id: 1,
    title: "Foundations",
    description: "Set the design language for the whole course.",
    lessons: [
      { id: 1, title: "Welcome", completed: true },
      { id: 2, title: "Tools you'll need" },
      { id: 3, title: "Setting intent", locked: true },
    ],
  },
  {
    id: 2,
    title: "Application",
    description: "Apply the framework to a real room.",
    lessons: [
      { id: 4, title: "Choosing the palette" },
      { id: 5, title: "Tone on tone" },
    ],
  },
];

const PREVIEW_LESSONS = [
  { id: 1, title: "Welcome", order_index: 1, completed: true },
  { id: 2, title: "Tools you'll need", order_index: 2, completed: false },
  { id: 3, title: "Setting intent", order_index: 3, locked: true },
] as const;

type QuizFixtureQ = {
  id: number;
  question_text: string;
  options: ReadonlyArray<{ id: number; option_text: string; is_correct: boolean }>;
};
const QUIZ_QUESTIONS: ReadonlyArray<QuizFixtureQ> = [
  {
    id: 1,
    question_text: "Which approach best supports tone-on-tone palettes?",
    options: [
      { id: 11, option_text: "Stack saturated complements", is_correct: false },
      { id: 12, option_text: "Layer values of a single hue", is_correct: true },
      { id: 13, option_text: "Use four primary colours", is_correct: false },
      { id: 14, option_text: "Avoid any neutrals", is_correct: false },
    ],
  },
  {
    id: 2,
    question_text: "The 60-30-10 rule allocates colour by…",
    options: [
      { id: 21, option_text: "Lighting intensity", is_correct: false },
      { id: 22, option_text: "Surface area", is_correct: true },
      { id: 23, option_text: "Material cost", is_correct: false },
      { id: 24, option_text: "Furniture height", is_correct: false },
    ],
  },
  {
    id: 3,
    question_text: "Drenching a room means…",
    options: [
      { id: 31, option_text: "Painting only the ceiling", is_correct: false },
      { id: 32, option_text: "One colour across walls, trim, doors", is_correct: true },
      { id: 33, option_text: "Mixing six finishes", is_correct: false },
      { id: 34, option_text: "Removing all colour", is_correct: false },
    ],
  },
];

function PreviewBadge() {
  return (
    <span
      className="inline-block text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-sm"
      style={{ background: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)" }}
    >
      Admin Preview
    </span>
  );
}

function QuizPreviewSection() {
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [graded, setGraded] = useState<null | { score: number; passed: boolean }>(null);

  const total = QUIZ_QUESTIONS.length;
  const current = QUIZ_QUESTIONS[idx];
  const allAnswered = QUIZ_QUESTIONS.every((q) => picks[q.id] != null);
  const passing = 70;

  const grade = () => {
    const correctCount = QUIZ_QUESTIONS.reduce((acc, q) => {
      const picked = picks[q.id];
      const right = q.options.find((o) => o.is_correct);
      return acc + (right && picked === right.id ? 1 : 0);
    }, 0);
    const score = Math.round((correctCount / total) * 100);
    setGraded({ score, passed: score >= passing });
  };

  if (graded) {
    return (
      <Card className="p-6 space-y-4">
        <PreviewBadge />
        <h3 className="font-serif text-2xl text-foreground">Sample quiz</h3>
        <QuizResult
          score={graded.score}
          passed={graded.passed}
          passingScore={passing}
          attemptsRemaining={null}
          onRestart={() => {
            setGraded(null);
            setPicks({});
            setIdx(0);
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-5">
      <PreviewBadge />
      <h3 className="font-serif text-2xl text-foreground">Sample quiz</h3>
      <QuizProgress current={idx + 1} total={total} passingScore={passing} />
      <QuizQuestion
        questionText={current.question_text}
        options={current.options.map((o) => ({ id: o.id, option_text: o.option_text }))}
        selectedOptionId={picks[current.id] ?? null}
        onChange={(id) => setPicks((s) => ({ ...s, [current.id]: id }))}
      />
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
          <ArrowLeft className="w-3 h-3 mr-1" /> Previous
        </Button>
        {idx === total - 1 ? (
          <Button size="sm" disabled={!allAnswered} onClick={grade}>
            Grade preview
          </Button>
        ) : (
          <Button size="sm" disabled={picks[current.id] == null} onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}>
            Next <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>
    </Card>
  );
}

function ModulePreviewSection() {
  const [activeId, setActiveId] = useState<number>(2);
  const items = useMemo(
    () => PREVIEW_LESSONS.map((l) => ({ ...l, id: l.id, title: l.title, order_index: l.order_index })),
    [],
  );
  const ordered = [...items].sort((a, b) => a.order_index - b.order_index);
  const activeIndex = ordered.findIndex((l) => l.id === activeId);
  const prev = activeIndex > 0 ? ordered[activeIndex - 1] : null;
  const next = activeIndex >= 0 && activeIndex < ordered.length - 1 ? ordered[activeIndex + 1] : null;

  return (
    <Card className="p-6 space-y-4">
      <PreviewBadge />
      <div className="grid lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1">
          <LessonSidebar
            lessons={ordered.map((l) => ({
              id: l.id,
              title: l.title,
              order_index: l.order_index,
              completed: !!l.completed,
              active: l.id === activeId,
            }))}
            onSelect={(id) => setActiveId(id)}
            progressPercent={Math.round((ordered.filter((l) => l.completed).length / ordered.length) * 100)}
          />
        </aside>
        <div className="lg:col-span-3 space-y-4">
          <div
            className="aspect-video rounded-md flex items-center justify-center"
            style={{ background: "var(--aa-olive-dark)", color: "var(--aa-cream)" }}
            aria-label="Video player placeholder"
          >
            <PlayCircle className="w-12 h-12 opacity-80" />
          </div>
          <h4 className="font-serif text-xl text-foreground">
            {ordered[activeIndex]?.title ?? "Select a lesson"}
          </h4>
          <LessonMaterial
            items={[
              { label: "Lesson workbook (PDF)", url: "#" },
              { label: "Reference palette", url: "#" },
            ]}
          />
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <LessonNavigation
              prevHref={prev ? "#" : null}
              nextHref={next ? "#" : null}
              onPrev={prev ? () => setActiveId(prev.id) : undefined}
              onNext={next ? () => setActiveId(next.id) : undefined}
            />
            <Button size="sm" variant="outline" disabled>
              <CheckCircle2 className="w-3 h-3 mr-1" /> Mark complete (preview)
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AdminPhase2Preview() {
  return (
    <AdminShell
      title="Phase 2 Preview"
      description="Render every Phase-2 surface without touching the database. All data on this page is local fixtures — nothing is inserted, updated or deleted."
      crumbs={[{ label: "Phase 2 Preview" }]}
    >
      <div className="space-y-12">
        <section id="landing" className="space-y-4">
          <header>
            <p className="section-label">Section A</p>
            <h2 className="font-serif text-2xl" style={{ color: "var(--aa-olive-dark)" }}>
              Landing course cards
            </h2>
          </header>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {LANDING_FIXTURES.map((c) => (
              <CourseCard key={c.id} course={c} variant="landing" />
            ))}
          </div>
        </section>

        <section id="catalogue" className="space-y-4">
          <header>
            <p className="section-label">Section B</p>
            <h2 className="font-serif text-2xl" style={{ color: "var(--aa-olive-dark)" }}>
              Member catalogue cards
            </h2>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MEMBER_FIXTURES.map((c) => (
              <CourseCard key={c.id} course={c} variant="member" />
            ))}
          </div>
        </section>

        <section id="course" className="space-y-4">
          <header>
            <p className="section-label">Section C</p>
            <h2 className="font-serif text-2xl" style={{ color: "var(--aa-olive-dark)" }}>
              Course detail
            </h2>
          </header>
          <Card className="p-6 space-y-6">
            <PreviewBadge />
            <div
              className="aspect-[16/7] rounded-lg overflow-hidden flex items-end p-6"
              style={{ background: "linear-gradient(145deg,#7A6E36,#543321)", color: "var(--aa-cream)" }}
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] opacity-80">The Curriculum</p>
                <h3 className="font-serif text-3xl">The path to a COLOURFUL life</h3>
              </div>
            </div>
            <div className="grid lg:grid-cols-[1fr_320px] gap-8">
              <div className="space-y-6">
                <h4 className="font-serif text-xl" style={{ color: "var(--aa-olive-dark)" }}>
                  Modules overview
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ModuleCard id={1} title="Foundations" description="Set the design language." lessonCount={3} completedCount={1} href="#" />
                  <ModuleCard id={2} title="Application" description="Apply the framework." lessonCount={2} completedCount={0} href="#" badge="New" />
                </div>
                <h4 className="font-serif text-xl pt-2" style={{ color: "var(--aa-olive-dark)" }}>
                  Learning path
                </h4>
                <LearningPath modules={PATH_MODULES} activeLessonId={2} buildLessonHref={() => "#"} />
              </div>
              <aside className="space-y-3">
                <Card className="p-4 space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">Progress</p>
                  <p className="font-serif text-3xl" style={{ color: "var(--aa-olive-dark)" }}>
                    20%
                  </p>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full" style={{ width: "20%", background: "var(--aa-gold)" }} />
                  </div>
                  <p className="text-xs text-foreground/60">1 of 5 lessons complete</p>
                </Card>
                <Card className="p-4 space-y-2 text-xs text-foreground/70">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-foreground/60">Admin only</p>
                  <p>No quiz configured yet — manage quizzes in Admin Center.</p>
                </Card>
              </aside>
            </div>
          </Card>
        </section>

        <section id="module" className="space-y-4">
          <header>
            <p className="section-label">Section D</p>
            <h2 className="font-serif text-2xl" style={{ color: "var(--aa-olive-dark)" }}>
              Module detail
            </h2>
          </header>
          <ModulePreviewSection />
        </section>

        <section id="quiz" className="space-y-4">
          <header>
            <p className="section-label">Section E</p>
            <h2 className="font-serif text-2xl" style={{ color: "var(--aa-olive-dark)" }}>
              Quiz
            </h2>
            <p className="text-xs text-foreground/60">
              Preview-only grading. Never writes a <code>quiz_attempt</code>.
            </p>
          </header>
          <QuizPreviewSection />
        </section>

        <section id="certificate" className="space-y-4">
          <header>
            <p className="section-label">Section F</p>
            <h2 className="font-serif text-2xl" style={{ color: "var(--aa-olive-dark)" }}>
              Certificate
            </h2>
            <p className="text-xs text-foreground/60">
              Never writes a <code>certificate</code> row. Identity stays on Instrument Serif / Manrope.
            </p>
          </header>
          <CertificatePreview
            studentName="Preview Student"
            courseTitle="The path to a COLOURFUL life"
            certificateNumber="AA-PREVIEW-0001"
          />
        </section>

        <div className="text-[11px] text-foreground/50">
          Fixtures are inline in this file. Nothing on this page consults Supabase, Stripe or Edge Functions.
        </div>
      </div>
    </AdminShell>
  );
}

// Test helpers — exported so the test suite can assert the six sections exist
// without rendering the whole AdminShell.
export const PHASE_2_PREVIEW_SECTION_IDS = [
  "landing",
  "catalogue",
  "course",
  "module",
  "quiz",
  "certificate",
] as const;
