import type { ReactNode } from "react";

export function MemberPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`aa-page ${className}`.trim()}>{children}</div>;
}

export function MemberPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="aa-page-header">
      <div>
        {eyebrow ? <p className="aa-eyebrow">{eyebrow}</p> : null}
        <h1 className="aa-display-title">{title}</h1>
        {description ? <div className="aa-page-lead">{description}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="aa-section-header">
      <div>
        <h2 className="aa-section-title">{title}</h2>
        {description ? <div className="aa-section-copy">{description}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div>
      {label ? (
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{safeValue}%</span>
        </div>
      ) : null}
      <div className="aa-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}>
        <div className="aa-progress-fill" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  progress,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  progress?: number;
}) {
  return (
    <article className="aa-stat-card">
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="aa-stat-label">{label}</p>
            <div className="aa-stat-value">{value}</div>
          </div>
          {icon ? <div className="text-accent">{icon}</div> : null}
        </div>
        {detail ? <div className="mt-auto pt-4 text-xs text-muted-foreground">{detail}</div> : null}
        {typeof progress === "number" ? <div className="mt-4"><ProgressBar value={progress} /></div> : null}
      </div>
    </article>
  );
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warning" | "success" }) {
  const toneClass =
    tone === "accent"
      ? "border-accent/25 bg-accent/10 text-accent"
      : tone === "warning"
        ? "border-amber-300/70 bg-amber-100/70 text-amber-900"
        : tone === "success"
          ? "border-emerald-300/70 bg-emerald-100/70 text-emerald-900"
          : "border-border bg-secondary/55 text-foreground/70";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${toneClass}`}>
      {children}
    </span>
  );
}
