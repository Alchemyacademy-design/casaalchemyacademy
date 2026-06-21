import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";

const threads = [
  { author: "Helena R.", topic: "Como vocês conservam essências naturais?", replies: 14 },
  { author: "Tomás A.", topic: "Indicação de cerâmica para fogo direto", replies: 8 },
  { author: "Marta L.", topic: "Encontro presencial em São Paulo — quem vai?", replies: 22 },
];

export default function Community() {
  return (
    <Layout>
      <PageHeader eyebrow="Comunidade" title="Conversas do ateliê." subtitle="Onde alunos, mestres e curiosos trocam saberes." />
      <section className="container py-16 space-y-4">
        {threads.map((t, i) => (
          <article key={i} className="flex items-start justify-between border border-border bg-card p-6 transition hover:border-accent">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-accent">{t.author}</p>
              <h3 className="mt-2 font-serif text-2xl text-primary">{t.topic}</h3>
            </div>
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{t.replies} respostas</span>
          </article>
        ))}
      </section>
    </Layout>
  );
}
