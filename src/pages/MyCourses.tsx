import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

const courses = [
  { id: "fragrancia-i", title: "Fragrância I — Princípios olfativos", chapters: 12, progress: 64 },
  { id: "ceramica-fogo", title: "Cerâmica & Fogo", chapters: 8, progress: 22 },
  { id: "tinturaria-natural", title: "Tinturaria natural", chapters: 10, progress: 0 },
];

export default function MyCourses() {
  return (
    <Layout>
      <PageHeader eyebrow="Acervo" title="Meus cursos" subtitle="Sua biblioteca pessoal, organizada por jornada." />
      <section className="container py-16 space-y-6">
        {courses.map((c) => (
          <Link
            key={c.id}
            to={`/course/${c.id}`}
            className="flex flex-col gap-4 border border-border bg-card p-8 transition hover:border-accent md:flex-row md:items-center md:justify-between"
          >
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.4em] text-accent">Curso</p>
              <h3 className="mt-2 font-serif text-3xl text-primary">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.chapters} capítulos</p>
            </div>
            <div className="w-full md:w-72">
              <Progress value={c.progress} className="h-1" />
              <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">{c.progress}% concluído</p>
            </div>
          </Link>
        ))}
      </section>
    </Layout>
  );
}
