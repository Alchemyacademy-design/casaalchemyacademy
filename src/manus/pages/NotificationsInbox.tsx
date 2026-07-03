import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import {
  MemberPage,
  MemberPageHeader,
  StatusPill,
} from "@/manus/components/member/MemberUI";
import { useMarkNotificationRead, useNotifications } from "@/manus/hooks/useNotifications";

export default function NotificationsInbox() {
  const { data = [], isLoading } = useNotifications();
  const mark = useMarkNotificationRead();
  const unreadCount = data.filter((n) => !n.read_at).length;

  return (
    <MemberLayout>
      <MemberPage>
        <MemberPageHeader
          eyebrow="Inbox"
          title="Notifications"
          description={<span>Course announcements, replies to your posts and upcoming session reminders.</span>}
          action={
            <button
              type="button"
              disabled={unreadCount === 0 || mark.isPending}
              onClick={() => mark.mutate("all")}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70 transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
            </button>
          }
        />

        {isLoading ? (
          <div className="aa-panel h-24 animate-pulse" aria-hidden />
        ) : data.length === 0 ? (
          <div className="aa-empty-state">
            <Bell className="mx-auto mb-3 h-6 w-6 text-accent" />
            <h3 className="font-serif text-2xl text-primary">Nothing here yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7">
              You'll see replies, mentions and reminders show up here as they arrive.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.map((n) => {
              const Wrapper = n.href ? Link : "div";
              return (
                <li key={n.id}>
                  <Wrapper
                    to={n.href ?? "#"}
                    className={`aa-panel flex items-start gap-4 p-4 transition ${n.read_at ? "" : "border-accent/30"}`}
                    onClick={() => {
                      if (!n.read_at) mark.mutate(n.id);
                    }}
                  >
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? "bg-border" : "bg-accent"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-primary">{n.title}</p>
                        <StatusPill tone="neutral">{n.kind}</StatusPill>
                      </div>
                      {n.body ? <p className="mt-1 text-sm text-muted-foreground">{n.body}</p> : null}
                      <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.read_at ? (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); mark.mutate(n.id); }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/70 hover:bg-secondary"
                        aria-label="Mark as read"
                      >
                        <Check className="h-3 w-3" /> Read
                      </button>
                    ) : null}
                  </Wrapper>
                </li>
              );
            })}
          </ul>
        )}
      </MemberPage>
    </MemberLayout>
  );
}