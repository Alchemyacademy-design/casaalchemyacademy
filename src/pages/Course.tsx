import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";
import { Link, useParams } from "react-router-dom";

const chapters = Array.from({ length: 8 }).map((_, i) => ({
  id: `aula-${i + 1}`,
  index: i + 1,
  title: ["Introdução", "Matéria-prima", "O laboratório", "Composição", "Equilíbrio", "Maceração", "Apuração", "Assinatura"][i],
  duration: `${12 + i * 3} min`,
}));

export default function Course() {
  const { id } = useParams();
  return (
    <Layout>
      <PageHeader
        eyebrow={`Curso · ${id}`}
        title="Fragrância I — Princípios olfativos"
        subtitle="Uma jornada por matérias-primas, equilíbrio e assinatura olfativa."
      />
      <section className="container grid gap-10 py-16 lg:grid-cols-[2fr_1fr]">
        <ol className="divide-y divide-border border border-border bg-card">
          {chapters.map((ch) => (
            <li key={ch.id}>
              <Link to={`/course/${id}/lesson/${ch.id}`} className="flex items-center justify-between gap-6 p-6 transition hover:bg-secondary">
                <div className="flex items-baseline gap-6">
                  <span className="font-serif text-3xl text-accent">{String(ch.index).padStart(2, "0")}</span>
                  <div>
                    <p className="font-serif text-2xl text-primary">{ch.title}</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{ch.duration}</p>
                  </div>
                </div>
                <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Assistir →</span>
              </Link>
            </li>
          ))}
        </ol>
        <aside className="border border-border bg-secondary/40 p-8">
          <p className="text-[10px] uppercase tracking-[0.4em] text-accent">Sobre</p>
          <h4 className="mt-3 font-serif text-2xl text-primary">Conduzido por mestres</h4>
          <p className="mt-3 text-sm text-muted-foreground">
            Aulas curtas, ensaios escritos e exercícios práticos. Você avança no seu tempo, com a profundidade de um ateliê.
          </p>
          <div className="divider-gold my-6" />
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Material incluso</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            <li>· Caderno digital</li>
            <li>· Mapa de matérias-primas</li>
            <li>· Mentoria mensal</li>
          </ul>
        </aside>
      </section>
    </Layout>
  );
}
