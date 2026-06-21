import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";

const events = [
  { date: "12 Jul", title: "Workshop de Fragrância em Tiradentes", city: "Tiradentes, MG" },
  { date: "03 Ago", title: "Jantar Alquimista", city: "São Paulo, SP" },
  { date: "27 Set", title: "Imersão de Tinturaria", city: "Salvador, BA" },
];

export default function Events() {
  return (
    <Layout>
      <PageHeader eyebrow="Agenda" title="Eventos & encontros" subtitle="Experiências presenciais cuidadosamente curadas." />
      <section className="container py-16 space-y-4">
        {events.map((e, i) => (
          <article key={i} className="flex items-baseline justify-between gap-6 border-b border-border py-6">
            <span className="font-serif text-4xl text-accent">{e.date}</span>
            <div className="flex-1">
              <h3 className="font-serif text-2xl text-primary">{e.title}</h3>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{e.city}</p>
            </div>
            <button className="text-xs uppercase tracking-[0.3em] text-accent hover:underline">Reservar</button>
          </article>
        ))}
      </section>
    </Layout>
  );
}
