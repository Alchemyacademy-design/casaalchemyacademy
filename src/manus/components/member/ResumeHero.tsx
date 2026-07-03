import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle } from "lucide-react";
import { useContinueLearning } from "@/manus/hooks/useContinueLearning";
import { ProgressBar } from "@/manus/components/member/MemberUI";

export default function ResumeHero() {
  const { data, isLoading } = useContinueLearning();
  const resume = data?.resume ?? null;

  if (isLoading) {
    return (
      <div className="aa-panel h-40 animate-pulse p-6" aria-hidden />
    );
  }

  if (!resume) {
    return (
      <div className="aa-panel p-6 md:p-8">
        <p className="aa-eyebrow">Get started</p>
        <h2 className="font-serif text-2xl text-primary md:text-3xl">Pick a course to begin</h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Your Resume tile will appear here as soon as you open your first lesson.
        </p>
        <Link
          to="/mycourses"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground"
        >
          Browse courses <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <Link
      to={resume.href}
      className="aa-panel group grid gap-6 p-6 transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-float md:grid-cols-[minmax(0,240px)_1fr] md:p-8"
      aria-label={`Resume ${resume.lessonTitle}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-secondary/50">
        {resume.thumbnail ? (
          <img src={resume.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-accent">
            <PlayCircle className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
          <PlayCircle className="h-12 w-12 text-white" />
        </div>
      </div>
      <div className="flex flex-col justify-center">
        <p className="aa-eyebrow">Resume where you left off</p>
        <h2 className="font-serif text-2xl leading-tight text-primary md:text-3xl">{resume.lessonTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {resume.courseTitle} · {resume.moduleTitle}
        </p>
        <div className="mt-4 max-w-md">
          <ProgressBar value={Math.round(resume.watchedPercent)} label="Lesson progress" />
        </div>
        <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          Resume lesson <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}