import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Search } from "lucide-react";
import AdminShell from "@/manus/components/admin/AdminShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { isPlaceholderVideo } from "@/manus/lib/admin-content";

type Row = {
  id: number;
  title: string;
  module_id: number;
  course_id: number | null;
  course_title: string | null;
  url: string | null;
  status: "ok" | "missing" | "placeholder" | "unknown-provider";
};

const KNOWN = /(youtube\.com|youtu\.be|vimeo\.com|dropbox\.com|\.mp4($|\?)|\.webm($|\?)|player\.vimeo)/i;

function classify(url: string | null): Row["status"] {
  if (!url || !url.trim()) return "missing";
  if (isPlaceholderVideo(url)) return "placeholder";
  if (!KNOWN.test(url)) return "unknown-provider";
  return "ok";
}

export default function AdminLinkScanner() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "issues" | Row["status"]>("issues");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "link-scanner", "v1"],
    queryFn: async (): Promise<Row[]> => {
      const { data: lessons, error } = await supabase
        .from("lessons")
        .select("id,title,module_id,external_video_url,course_modules(course_id,courses(title))")
        .order("id", { ascending: true });
      if (error) throw error;
      return (lessons ?? []).map((l: any) => {
        const status = classify(l.external_video_url);
        return {
          id: l.id,
          title: l.title ?? "(untitled)",
          module_id: l.module_id,
          course_id: l.course_modules?.course_id ?? null,
          course_title: l.course_modules?.courses?.title ?? null,
          url: l.external_video_url,
          status,
        } as Row;
      });
    },
  });

  const counts = useMemo(() => {
    const acc = { ok: 0, missing: 0, placeholder: 0, "unknown-provider": 0 } as Record<Row["status"], number>;
    (data ?? []).forEach((r) => (acc[r.status] += 1));
    return acc;
  }, [data]);

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "issues" && r.status === "ok") return false;
      if (filter !== "all" && filter !== "issues" && r.status !== filter) return false;
      if (!needle) return true;
      return [r.title, r.course_title, r.url].some((v) => (v ?? "").toLowerCase().includes(needle));
    });
  }, [data, q, filter]);

  const chips: Array<{ key: typeof filter; label: string; badge?: number }> = [
    { key: "issues", label: "Issues only", badge: counts.missing + counts.placeholder + counts["unknown-provider"] },
    { key: "all", label: "All", badge: data?.length ?? 0 },
    { key: "missing", label: "Missing URL", badge: counts.missing },
    { key: "placeholder", label: "Placeholder", badge: counts.placeholder },
    { key: "unknown-provider", label: "Unknown provider", badge: counts["unknown-provider"] },
    { key: "ok", label: "OK", badge: counts.ok },
  ];

  return (
    <AdminShell
      title="Link scanner"
      description="Scan every lesson video URL and surface anything that looks broken, missing, or served from a legacy path."
      crumbs={[{ label: "Tools" }, { label: "Link scanner" }]}
    >
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`text-xs rounded-full border px-3 py-1 transition ${
              filter === c.key ? "bg-foreground text-background" : "bg-background hover:bg-muted"
            }`}
          >
            {c.label} {typeof c.badge === "number" && <span className="opacity-70">· {c.badge}</span>}
          </button>
        ))}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Rescan
        </Button>
      </div>

      <Card className="p-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-foreground/50" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by lesson title, course or URL"
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Lesson</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-foreground/60">Scanning…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-foreground/60">Nothing to report.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    {r.status === "ok" ? (
                      <Badge variant="outline" className="gap-1 border-emerald-400/60 text-emerald-700"><CheckCircle2 className="h-3 w-3" /> OK</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 border-amber-400/60 text-amber-700"><AlertTriangle className="h-3 w-3" /> {r.status}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-foreground/50">id {r.id}</div>
                  </td>
                  <td className="px-4 py-3">{r.course_title ?? "—"}</td>
                  <td className="px-4 py-3 max-w-[380px]">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-foreground"
                      >
                        <span className="truncate max-w-[320px]">{r.url}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-foreground/50 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.course_id && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/admin/course-management/${r.course_id}`}>Fix</Link>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}