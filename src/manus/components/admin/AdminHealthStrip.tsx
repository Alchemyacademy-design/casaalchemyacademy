import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export interface HealthItem {
  key: string;
  label: string;
  count: number;
  tone: "warn" | "ok";
  to: string;
  cta: string;
}

export default function AdminHealthStrip({ items }: { items: HealthItem[] }) {
  const anyWarn = items.some((i) => i.tone === "warn" && i.count > 0);
  return (
    <Card className="p-4 mb-6 border-l-4" style={{ borderLeftColor: anyWarn ? "var(--aa-gold)" : "rgba(70,120,80,.6)" }}>
      <div className="flex items-center gap-3 mb-3">
        {anyWarn ? (
          <AlertTriangle className="h-4 w-4" style={{ color: "var(--aa-gold)" }} />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        )}
        <div className="text-sm font-medium" style={{ color: "var(--aa-olive-dark)" }}>
          System health
        </div>
        <div className="text-xs text-foreground/55">
          {anyWarn ? "Action items detected across the platform." : "Everything looks healthy right now."}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => {
          const active = i.tone === "warn" && i.count > 0;
          return (
            <Link
              key={i.key}
              to={i.to}
              className={`group flex items-center justify-between rounded border px-3 py-2 text-sm transition ${
                active ? "border-amber-300/60 bg-amber-50/60 hover:bg-amber-100/70" : "border-border/50 hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs w-8 text-right">{i.count}</span>
                <span className="truncate">{i.label}</span>
              </div>
              <span className="text-xs text-foreground/60 group-hover:text-foreground flex items-center gap-1">
                {i.cta} <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}