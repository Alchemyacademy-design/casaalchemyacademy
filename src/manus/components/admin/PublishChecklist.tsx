import { Check, X } from "lucide-react";

export interface ChecklistItem {
  label: string;
  ok: boolean;
}

export default function PublishChecklist({ items }: { items: ChecklistItem[] }) {
  const allOk = items.every((i) => i.ok);
  return (
    <div className="rounded-md border p-3 bg-muted/30">
      <div className="text-sm font-medium mb-2">Publish checklist</div>
      <ul className="space-y-1">
        {items.map((i, idx) => (
          <li key={idx} className="flex items-center gap-2 text-sm">
            {i.ok ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4 text-red-600" />}
            <span className={i.ok ? "" : "text-red-700"}>{i.label}</span>
          </li>
        ))}
      </ul>
      {!allOk && <p className="text-xs text-foreground/60 mt-2">Fix the items above before publishing.</p>}
    </div>
  );
}

export function canPublish(items: ChecklistItem[]): boolean {
  return items.every((i) => i.ok);
}
