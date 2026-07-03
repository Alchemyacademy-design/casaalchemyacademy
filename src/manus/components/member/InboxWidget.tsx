import { Link } from "react-router-dom";
import { Bell, ArrowRight } from "lucide-react";
import { useNotifications } from "@/manus/hooks/useNotifications";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function InboxWidget() {
  const { data = [] } = useNotifications();
  const unread = data.filter((n) => !n.read_at).slice(0, 3);
  const preview = unread.length > 0 ? unread : data.slice(0, 3);

  return (
    <div className="aa-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-2">
          <Bell className="h-4 w-4 text-accent" />
          <h3 className="font-serif text-xl text-primary">Inbox</h3>
        </div>
        <Link to="/notifications" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          Open <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {preview.length === 0 ? (
        <p className="text-sm text-muted-foreground">You're all caught up.</p>
      ) : (
        <ul className="space-y-3">
          {preview.map((n) => (
            <li key={n.id} className="flex items-start gap-3">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-border" : "bg-accent"}`} />
              <div className="min-w-0 flex-1">
                {n.href ? (
                  <Link to={n.href} className="block truncate text-sm font-medium text-primary hover:text-accent">
                    {n.title}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-medium text-primary">{n.title}</p>
                )}
                {n.body ? <p className="truncate text-xs text-muted-foreground">{n.body}</p> : null}
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{timeAgo(n.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}