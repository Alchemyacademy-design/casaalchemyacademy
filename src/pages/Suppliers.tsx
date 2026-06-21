import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";

const suppliers = [
  { name: "Casa Olfato", category: "Essências naturais", region: "São Paulo" },
  { name: "Ateliê Fogo", category: "Cerâmica", region: "Minas Gerais" },
  { name: "Tinta Viva", category: "Pigmentos botânicos", region: "Bahia" },
  { name: "Vidraria Lume", category: "Frascaria artesanal", region: "Rio Grande do Sul" },
];

export default function Suppliers() {
  return (
    <Layout>
      <PageHeader eyebrow="Curadoria" title="Fornecedores" subtitle="A rede de parceiros do nosso atelier." />
      <section className="container grid gap-4 py-16 md:grid-cols-2">
        {suppliers.map((s) => (
          <article key={s.name} className="border border-border bg-card p-6 transition hover:border-accent">
            <p className="text-[10px] uppercase tracking-[0.4em] text-accent">{s.category}</p>
            <h3 className="mt-2 font-serif text-2xl text-primary">{s.name}</h3>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">{s.region}</p>
          </article>
        ))}
      </section>
    </Layout>
  );
}
