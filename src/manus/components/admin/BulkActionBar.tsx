import { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-4 z-40 mx-auto flex max-w-3xl items-center gap-3 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur">
      <span className="text-sm font-medium">
        {count} selected
      </span>
      <div className="flex-1 flex items-center gap-2 justify-end flex-wrap">
        {children}
      </div>
      <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}