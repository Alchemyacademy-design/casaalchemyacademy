import Layout from "@/components/Layout";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Lesson() {
  const { id, lessonId } = useParams();
  return (
    <Layout>
      <section className="container py-12">
        <Link to={`/course/${id}`} className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-accent">
          ← Voltar ao curso
        </Link>
        <div className="mt-6 aspect-video w-full bg-gradient-gold shadow-editorial" aria-label="Player de vídeo" />
        <div className="mt-10 grid gap-10 lg:grid-cols-[2fr_1fr]">
          <article className="prose max-w-none">
            <p className="text-[10px] uppercase tracking-[0.4em] text-accent">Aula · {lessonId}</p>
            <h1 className="mt-3 font-serif text-5xl text-primary">Composição & equilíbrio</h1>
            <p className="mt-6 leading-relaxed text-muted-foreground">
              Nesta aula exploramos as proporções de saída, corpo e fundo, e como pequenas alterações alteram completamente a assinatura.
              Use o caderno digital para acompanhar os exercícios práticos do final do capítulo.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Ao concluir, marque a aula como assistida e prossiga para o próximo capítulo no menu do curso.
            </p>
            <Button className="mt-8 bg-primary text-primary-foreground hover:bg-olive-deep">Marcar como concluída</Button>
          </article>
          <aside className="border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-accent">Materiais</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>· PDF do capítulo</li>
              <li>· Tabela de proporções</li>
              <li>· Bibliografia recomendada</li>
            </ul>
          </aside>
        </div>
      </section>
    </Layout>
  );
}
