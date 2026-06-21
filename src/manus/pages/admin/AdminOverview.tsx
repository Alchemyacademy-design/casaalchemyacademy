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
      label: "Published courses",
      value: isLoading ? "—" : data?.publishedCourses ?? 0,
      hint: `${data?.draftCourses ?? 0} draft · ${data?.totalCourses ?? 0} total`,
      icon: BookOpen,
    },
    {
      label: "Lessons",
      value: isLoading ? "—" : data?.totalLessons ?? 0,
      hint: "Across all courses",
      icon: ListChecks,
    },
    {
      label: "Students",
      value: isLoading ? "—" : data?.students ?? 0,
      hint: "Registered profiles",
      icon: Users,
    },
    {
      label: "Lessons missing video",
      value: isLoading ? "—" : data?.missingVideos ?? 0,
      hint: "Paste the real URL in Lessons (bulk)",
      icon: AlertTriangle,
      tone: "warning",
    },
    {
      label: "Missing covers",
      value: isLoading ? "—" : data?.missingThumbs ?? 0,
      hint: "Upload from Courses",
      icon: ImageIcon,
      tone: "warning",
    },
  ];

  return (
    <AdminShell
      title="Overview"
      description="Track the catalogue, spot pending items and finalise the platform's publications."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-8">
        {kpis.map((k) => (
          <KpiCard key={k.label} k={k} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="font-serif text-xl mb-1" style={{ color: "var(--aa-olive-dark)" }}>
            Edit courses
          </h3>
          <p className="text-sm text-foreground/70 mb-4">
            Create modules and lessons, set covers, descriptions and publish status.
          </p>
          <Button asChild>
            <Link to="/admin/courses">
              Open courses <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </Card>
        <Card className="p-5">
          <h3 className="font-serif text-xl mb-1" style={{ color: "var(--aa-olive-dark)" }}>
            Update lesson links
          </h3>
          <p className="text-sm text-foreground/70 mb-4">
            Paste the real URLs (YouTube, Vimeo or MP4) and edit titles in bulk.
          </p>
          <Button asChild variant="outline">
            <Link to="/admin/lessons">
              Bulk lessons <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </Card>
        <Card className="p-5">
          <h3 className="font-serif text-xl mb-1" style={{ color: "var(--aa-olive-dark)" }}>
            Import catalogue
          </h3>
          <p className="text-sm text-foreground/70 mb-4">
            Upload a catalogue JSON to generate courses, modules and lessons as drafts.
          </p>
          <Button asChild variant="outline">
            <Link to="/admin/import">
              <Upload className="w-4 h-4 mr-1" /> Open importer
            </Link>
          </Button>
        </Card>
      </div>
    </AdminShell>
  );
}
