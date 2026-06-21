import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

const tiles = [
  { to: "/mycourses", title: "Meus cursos", desc: "Continue onde parou." },
  { to: "/community", title: "Comunidade", desc: "Conversas, encontros, mentorias." },
  { to: "/events", title: "Eventos", desc: "Agenda exclusiva da temporada." },
  { to: "/magazine", title: "Revista", desc: "Ensaios e estudos do mês." },
  { to: "/suppliers", title: "Fornecedores", desc: "Curadoria do nosso atelier." },
  { to: "/plans", title: "Planos", desc: "Eleve sua experiência." },
];

export default function Dashboard() {
  const { me } = useAuth();
  return (
    <Layout>
      <PageHeader
        eyebrow="Dashboard"
        title={`Olá, ${me?.user.name ?? me?.user.email?.split("@")[0] ?? "alquimista"}.`}
        subtitle="Seu acervo, sua comunidade e seu próximo passo — reunidos."
      />
      <section className="container py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t, i) => (
            <Link
              key={t.to}
              to={t.to}
              className="group relative overflow-hidden border border-border bg-card p-8 transition hover:border-accent shadow-editorial animate-fade-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <p className="text-[10px] uppercase tracking-[0.4em] text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-4 font-serif text-3xl text-primary">{t.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{t.desc}</p>
              <span className="mt-8 inline-block text-xs uppercase tracking-[0.3em] text-muted-foreground group-hover:text-accent">
                Acessar →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
