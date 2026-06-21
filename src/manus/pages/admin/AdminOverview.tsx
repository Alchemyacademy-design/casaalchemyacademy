import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ListChecks,
  Users,
  AlertTriangle,
  Image as ImageIcon,
  Upload,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminShell from "@/manus/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { isLegacyAssetPath, isPlaceholderVideo } from "@/manus/lib/admin-content";

interface Kpi {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning";
}

function KpiCard({ k }: { k: Kpi }) {
  return (
    <Card className="p-5 flex items-start gap-4">
      <div
        className="h-11 w-11 rounded flex items-center justify-center flex-shrink-0"
        style={{
          background: k.tone === "warning" ? "rgba(196,160,90,.15)" : "rgba(60,58,42,.08)",
          color: k.tone === "warning" ? "var(--aa-gold)" : "var(--aa-olive-dark)",
        }}
      >
        <k.icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-[0.12em] text-foreground/60">{k.label}</div>
        <div className="font-serif text-3xl mt-1" style={{ color: "var(--aa-olive-dark)" }}>
          {k.value}
        </div>
        {k.hint && <div className="text-xs text-foreground/55 mt-1">{k.hint}</div>}
      </div>
    </Card>
  );
}

export default function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const [{ data: courses }, { data: lessons }, { count: studentCount }] = await Promise.all([
        supabase.from("courses").select("id,status,cover_image_path"),
        supabase.from("lessons").select("id,status,external_video_url"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      const publishedCourses = (courses ?? []).filter((c) => c.status === "published").length;
      const draftCourses = (courses ?? []).filter((c) => c.status === "draft").length;
      const missingThumbs = (courses ?? []).filter(
        (c) => !c.cover_image_path || isLegacyAssetPath(c.cover_image_path),
      ).length;
      const totalLessons = (lessons ?? []).length;
      const missingVideos = (lessons ?? []).filter(
        (l) => !l.external_video_url || isPlaceholderVideo(l.external_video_url),
      ).length;
      return {
        publishedCourses,
        draftCourses,
        totalCourses: (courses ?? []).length,
        totalLessons,
        missingVideos,
        missingThumbs,
        students: studentCount ?? 0,
      };
    },
  });

  const kpis: Kpi[] = [
    {
      label: "Cursos publicados",
      value: isLoading ? "—" : data?.publishedCourses ?? 0,
      hint: `${data?.draftCourses ?? 0} em rascunho · ${data?.totalCourses ?? 0} no total`,
      icon: BookOpen,
    },
    {
      label: "Aulas cadastradas",
      value: isLoading ? "—" : data?.totalLessons ?? 0,
      hint: "Em todos os cursos",
      icon: ListChecks,
    },
    {
      label: "Alunos",
      value: isLoading ? "—" : data?.students ?? 0,
      hint: "Perfis registrados",
      icon: Users,
    },
    {
      label: "Aulas sem vídeo",
      value: isLoading ? "—" : data?.missingVideos ?? 0,
      hint: "Cole o link real em Aulas (lote)",
      icon: AlertTriangle,
      tone: "warning",
    },
    {
      label: "Capas faltantes",
      value: isLoading ? "—" : data?.missingThumbs ?? 0,
      hint: "Faça upload em Cursos",
      icon: ImageIcon,
      tone: "warning",
    },
  ];

  return (
    <AdminShell
      title="Visão geral"
      description="Acompanhe o catálogo, identifique pendências e finalize as publicações da plataforma."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-8">
        {kpis.map((k) => (
          <KpiCard key={k.label} k={k} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="font-serif text-xl mb-1" style={{ color: "var(--aa-olive-dark)" }}>
            Editar cursos
          </h3>
          <p className="text-sm text-foreground/70 mb-4">
            Crie módulos e aulas, defina capas, descrições e o status de publicação.
          </p>
          <Button asChild>
            <Link to="/admin/courses">
              Abrir cursos <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </Card>
        <Card className="p-5">
          <h3 className="font-serif text-xl mb-1" style={{ color: "var(--aa-olive-dark)" }}>
            Atualizar links das aulas
          </h3>
          <p className="text-sm text-foreground/70 mb-4">
            Cole as URLs reais (YouTube, Vimeo ou MP4) e ajuste títulos em lote.
          </p>
          <Button asChild variant="outline">
            <Link to="/admin/lessons">
              Aulas em lote <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </Card>
        <Card className="p-5">
          <h3 className="font-serif text-xl mb-1" style={{ color: "var(--aa-olive-dark)" }}>
            Importar catálogo
          </h3>
          <p className="text-sm text-foreground/70 mb-4">
            Suba um JSON de catálogo e gere automaticamente cursos, módulos e aulas como rascunho.
          </p>
          <Button asChild variant="outline">
            <Link to="/admin/import">
              <Upload className="w-4 h-4 mr-1" /> Abrir importador
            </Link>
          </Button>
        </Card>
      </div>
    </AdminShell>
  );
}
