import type { ContentStatus } from "@/manus/lib/admin-content";

const STYLES: Record<ContentStatus, string> = {
  draft: "bg-amber-100 text-amber-800 border-amber-200",
  published: "bg-emerald-100 text-emerald-800 border-emerald-200",
  archived: "bg-zinc-200 text-zinc-700 border-zinc-300",
};

export default function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}
