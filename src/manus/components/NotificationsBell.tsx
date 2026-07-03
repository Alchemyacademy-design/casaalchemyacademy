import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMarkNotificationRead, useNotifications } from "@/manus/hooks/useNotifications";

export default function NotificationsBell() {
  const { data = [] } = useNotifications();
  const mark = useMarkNotificationRead();
  const unread = data.filter((n) => !n.read_at).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground/70 transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => mark.mutate("all")}>
              <CheckCheck className="h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {data.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">You're all caught up.</p>
          ) : (
            <ul className="divide-y">
              {data.map((n) => {
                const inner = (
                  <div className="flex flex-col gap-0.5 px-3 py-2 text-left">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${n.read_at ? "text-foreground/70" : "font-semibold"}`}>{n.title}</p>
                      {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />}
                    </div>
                    {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                    <p className="text-[10px] uppercase tracking-wider text-foreground/40">
                      {(() => {
                        try {
                          return formatDistanceToNow(new Date(n.created_at), { addSuffix: true });
                        } catch {
                          return "";
                        }
                      })()}
                    </p>
                  </div>
                );
                return (
                  <li key={n.id} className="hover:bg-muted/50">
                    {n.href ? (
                      <Link to={n.href} onClick={() => !n.read_at && mark.mutate(n.id)} className="block">
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => !n.read_at && mark.mutate(n.id)} className="block w-full">
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}