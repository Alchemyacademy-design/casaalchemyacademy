import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Ateliê",
    price: "R$ 89",
    period: "/mês",
    perks: ["Revista mensal", "Comunidade aberta", "1 curso por trimestre"],
  },
  {
    name: "Mestre",
    price: "R$ 189",
    period: "/mês",
    perks: ["Tudo do Ateliê", "Acesso total aos cursos", "Eventos presenciais", "Curadoria de fornecedores"],
    featured: true,
  },
  {
    name: "Alquimista",
    price: "R$ 389",
    period: "/mês",
    perks: ["Tudo do Mestre", "Mentoria mensal 1:1", "Acervo histórico", "Convites VIP"],
  },
];

export default function Plans() {
  return (
    <Layout>
      <PageHeader eyebrow="Assinaturas" title="Escolha sua jornada." subtitle="Três níveis pensados para diferentes momentos do ofício." />
      <section className="container py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((p) => (
            <article
              key={p.name}
              className={`flex flex-col border p-10 ${
                p.featured ? "border-accent bg-olive-deep text-primary-foreground shadow-editorial" : "border-border bg-card"
              }`}
            >
              <p className={`text-xs uppercase tracking-[0.4em] ${p.featured ? "text-gold-soft" : "text-accent"}`}>{p.name}</p>
              <h3 className="mt-6 font-serif text-5xl">{p.price}<span className="text-base opacity-70">{p.period}</span></h3>
              <ul className="mt-8 space-y-3 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check className={`mt-0.5 h-4 w-4 ${p.featured ? "text-gold-soft" : "text-accent"}`} />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`mt-10 ${
                  p.featured
                    ? "bg-gold text-olive-deep hover:bg-gold-soft"
                    : "bg-primary text-primary-foreground hover:bg-olive-deep"
                }`}
              >
                Assinar {p.name}
              </Button>
            </article>
          ))}
        </div>
      </section>
    </Layout>
  );
}
