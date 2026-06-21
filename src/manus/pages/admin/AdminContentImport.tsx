import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import AdminShell from "@/manus/components/admin/AdminShell";
import { isLegacyAssetPath, isPlaceholderVideo, slugify } from "@/manus/lib/admin-content";
import manusImport from "@/manus/data/manus-import.json";
import { AlertTriangle, Download, Upload } from "lucide-react";

interface ImportLesson {
  legacy_lesson_id?: number;
  lesson_number?: string;
  sort_order: number;
  title: string;
  description?: string | null;
  external_video_url?: string | null;
  external_resource_url?: string | null;
  legacy_video_path?: string | null;
  status?: string;
  is_preview?: boolean;
}
interface ImportModule {
  title: string;
  description?: string | null;
  sort_order: number;
  status?: string;
  lessons: ImportLesson[];
}
interface ImportCourse {
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  cover_image_path?: string | null;
  sort_order: number;
  modules: ImportModule[];
}
interface ImportPack {
  warnings?: string[];
  courses: ImportCourse[];
}

export default function AdminContentImport() {
  const navigate = useNavigate();
  const [pack, setPack] = useState<ImportPack>(manusImport as unknown as ImportPack);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<any | null>(null);

  const stats = useMemo(() => {
    const totalCourses = pack.courses.length;
    const totalLessons = pack.courses.reduce((s, c) => s + c.modules.reduce((s2, m) => s2 + m.lessons.length, 0), 0);
    const missingLinks = pack.courses.flatMap((c) =>
      c.modules.flatMap((m) =>
        m.lessons.filter((l) => !l.external_video_url || isPlaceholderVideo(l.legacy_video_path)).map((l) => `${c.slug} · ${l.lesson_number ?? l.sort_order} ${l.title}`),
      ),
    );
    const missingThumbs = pack.courses.filter((c) => isLegacyAssetPath(c.cover_image_path)).map((c) => `${c.slug} → ${c.cover_image_path}`);
    return { totalCourses, totalLessons, missingLinks, missingThumbs };
  }, [pack]);

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ImportPack;
      if (!Array.isArray(parsed.courses)) throw new Error("Invalid pack: 'courses' array missing");
      setPack(parsed);
      setReport(null);
      toast.success("Pack loaded");
    } catch (e: any) {
      toast.error(`Invalid JSON: ${e.message}`);
    }
  };

  const runImport = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("manus-import", { body: { pack } });
      if (error) throw error;
      setReport(data);
      toast.success(`Imported ${data?.courses_upserted ?? 0} courses · ${data?.lessons_upserted ?? 0} lessons (draft)`);
    } catch (e: any) {
      toast.error(`Import error: ${e.message ?? String(e)}`);
      setReport({ errors: [e.message ?? String(e)] });
    } finally {
      setRunning(false);
    }
  };


  const downloadReport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <AdminShell
      title="Importar catálogo de cursos"
      description="Suba um JSON de catálogo e gere cursos, módulos e aulas como rascunho. URLs de vídeo precisam ser preenchidas depois; nada é publicado automaticamente."
      crumbs={[{ label: "Importar conteúdo" }]}
      actions={
        <>
          <Button variant="outline" onClick={() => navigate("/admin/courses")}>Voltar para cursos</Button>
          <Button onClick={runImport} disabled={running}><Upload className="w-4 h-4 mr-1" /> {running ? "Importando…" : "Importar como rascunho"}</Button>
        </>
      }
    >
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold mb-2">Pack preview</h2>
            <p className="text-sm text-foreground/70 mb-3">{stats.totalCourses} courses · {stats.totalLessons} lessons.</p>
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
              className="text-sm"
            />
            <div className="mt-4 space-y-3">
              {pack.courses.map((c) => (
                <div key={c.slug} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-foreground/60 font-mono">{c.slug}</div>
                    </div>
                    {isLegacyAssetPath(c.cover_image_path) && (
                      <span className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> legacy cover</span>
                    )}
                  </div>
                  <ul className="mt-2 text-sm space-y-1">
                    {c.modules.flatMap((m) => m.lessons).map((l) => (
                      <li key={`${c.slug}-${l.sort_order}`} className="flex items-center gap-2 text-foreground/80">
                        <span className="text-xs font-mono text-foreground/50 w-10">{l.lesson_number ?? l.sort_order}</span>
                        <span className="flex-1 truncate">{l.title}</span>
                        {(!l.external_video_url || isPlaceholderVideo(l.legacy_video_path)) && (
                          <span title="No real video URL"><AlertTriangle className="w-3 h-3 text-amber-600" /></span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          {report && (
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Import report</h2>
                <Button size="sm" variant="outline" onClick={downloadReport}><Download className="w-4 h-4 mr-1" /> Download JSON</Button>
              </div>
              <pre className="text-xs bg-muted/40 p-3 rounded overflow-x-auto">{JSON.stringify(report, null, 2)}</pre>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-medium mb-2">Warnings</h3>
            <ul className="text-xs text-foreground/70 list-disc pl-4 space-y-1">
              {(pack.warnings ?? []).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </Card>
          <Card className="p-4">
            <h3 className="font-medium mb-2">Missing video links ({stats.missingLinks.length})</h3>
            <ul className="text-xs text-foreground/70 max-h-48 overflow-y-auto space-y-1">
              {stats.missingLinks.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </Card>
          <Card className="p-4">
            <h3 className="font-medium mb-2">Missing thumbnails ({stats.missingThumbs.length})</h3>
            <ul className="text-xs text-foreground/70 space-y-1">
              {stats.missingThumbs.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
