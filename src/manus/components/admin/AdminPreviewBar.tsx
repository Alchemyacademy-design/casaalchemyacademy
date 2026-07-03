import { Eye, X } from "lucide-react";
import { useAuth } from "@/manus/hooks/useAuth";
import { PREVIEW_PLAN_LABELS, setPreviewPlan, usePreviewPlan, type PreviewPlan } from "@/manus/lib/admin-preview";

const PLANS: PreviewPlan[] = ["none", "free", "monthly_member", "annual_member", "individual_course"];

export default function AdminPreviewBar() {
  const { isAdmin } = useAuth();
  const plan = usePreviewPlan();
  if (!isAdmin || !plan) return null;
  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs text-amber-900 dark:text-amber-100">
      <Eye className="h-3.5 w-3.5" />
      <span className="font-semibold uppercase tracking-wide">Admin preview</span>
      <span>Viewing as: <strong>{PREVIEW_PLAN_LABELS[plan]}</strong></span>
      <div className="ml-auto flex items-center gap-2">
        <label className="sr-only" htmlFor="admin-preview-plan">Simulated plan</label>
        <select
          id="admin-preview-plan"
          value={plan}
          onChange={(e) => setPreviewPlan(e.target.value as PreviewPlan)}
          className="rounded border border-amber-500/60 bg-background/60 px-2 py-1 text-xs"
        >
          {PLANS.map((p) => (<option key={p} value={p}>{PREVIEW_PLAN_LABELS[p]}</option>))}
        </select>
        <button
          type="button"
          onClick={() => setPreviewPlan(null)}
          className="inline-flex items-center gap-1 rounded border border-amber-500/60 bg-background/60 px-2 py-1 hover:bg-background"
        >
          <X className="h-3 w-3" /> Exit preview
        </button>
      </div>
    </div>
  );
}