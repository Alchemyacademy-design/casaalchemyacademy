import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";

const issues = [
  { n: "Nº 12", title: "Sobre o tempo lento", subtitle: "Ensaios sobre o ofício." },
  { n: "Nº 11", title: "Matéria viva", subtitle: "Tinturas que respiram." },
  { n: "Nº 10", title: "Mãos & memória", subtitle: "A herança dos mestres." },
];

export default function Magazine() {
  return (
    <Layout>
      <PageHeader eyebrow="Revista" title="Edições recentes" subtitle="Leitura mensal para o ateliê e a alma." />
      <section className="container grid gap-6 py-16 md:grid-cols-3">
        {issues.map((i) => (
          <article key={i.n} className="group border border-border bg-card transition hover:border-accent">
            <div className="aspect-[3/4] bg-gradient-gold" />
            <div className="p-6">
              <p className="text-[10px] uppercase tracking-[0.4em] text-accent">{i.n}</p>
              <h3 className="mt-2 font-serif text-3xl text-primary">{i.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{i.subtitle}</p>
            </div>
          </article>
        ))}
      </section>
    </Layout>
  );
}
