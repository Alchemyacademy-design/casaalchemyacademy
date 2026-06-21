import Layout from "@/components/Layout";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";

export default function Profile() {
  const { me } = useAuth();
  return (
    <Layout>
      <PageHeader eyebrow="Conta" title="Seu perfil" subtitle="Identidade, plano e direitos de acesso." />
      <section className="container grid gap-6 py-16 md:grid-cols-2">
        <article className="border border-border bg-card p-8">
          <p className="text-[10px] uppercase tracking-[0.4em] text-accent">Identidade</p>
          <h3 className="mt-3 font-serif text-3xl text-primary">{me?.user.name ?? "Sem nome"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{me?.user.email}</p>
          <div className="divider-gold my-6" />
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Papéis</p>
          <p className="mt-1 text-sm">{me?.roles.length ? me.roles.join(", ") : "—"}</p>
        </article>
        <article className="border border-border bg-card p-8">
          <p className="text-[10px] uppercase tracking-[0.4em] text-accent">Assinatura</p>
          <h3 className="mt-3 font-serif text-3xl text-primary">{me?.membership?.plan ?? "Sem plano"}</h3>
          <p className="mt-1 text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Status: {me?.membership?.status ?? "—"}
          </p>
          <div className="divider-gold my-6" />
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Acessos ativos</p>
          <ul className="mt-2 space-y-1 text-sm">
            {me?.activeEntitlements.length
              ? me.activeEntitlements.map((e) => <li key={e.id}>· {e.name ?? e.id}</li>)
              : <li>—</li>}
          </ul>
        </article>
      </section>
    </Layout>
  );
}
