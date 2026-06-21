import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Upload, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AdminShell from "@/manus/components/admin/AdminShell";
import StatusBadge from "@/manus/components/admin/StatusBadge";
import { listCourses } from "@/manus/lib/admin-content";

export default function AdminCoursesList() {
  const navigate = useNavigate();
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["admin", "courses"],
    queryFn: listCourses,
  });

  return (
    <AdminShell
      title="Cursos"
      description="Crie, edite, ordene e publique cursos, módulos e aulas."
      crumbs={[{ label: "Cursos" }]}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/admin/lessons">Aulas em lote</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/import"><Upload className="w-4 h-4 mr-1" /> Importar catálogo</Link>
          </Button>

          <Button onClick={() => navigate("/admin/courses/new")}>
            <Plus className="w-4 h-4 mr-1" /> Novo curso
          </Button>
        </>
      }
    >
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plans</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground/60">Loading…</td></tr>}
            {!isLoading && courses.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-foreground/60">No courses yet. Create one or import from Manus.</td></tr>
            )}
            {courses.map((c) => (
              <tr key={c.id} className="border-t border-border/40 hover:bg-muted/20">
                <td className="px-4 py-3 text-foreground/60">{c.sort_order}</td>
                <td className="px-4 py-3 font-medium">{c.title}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.slug}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-xs">{c.access_plan_keys.join(", ") || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/admin/courses/${c.id}`}><Edit3 className="w-4 h-4 mr-1" /> Manage</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AdminShell>
  );
}
