import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Check, X, ExternalLink, Loader2 } from "lucide-react";
import MemberLayout from "@/manus/components/MemberLayout";
import { MemberPage, MemberPageHeader, StatusPill } from "@/manus/components/member/MemberUI";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/manus/hooks/useAuth";
import { toast } from "sonner";

type ReportStatus = "open" | "resolved" | "dismissed";

interface ReportRow {
  id: number;
  post_id: number;
  reporter_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  post?: {
    id: number;
    title: string | null;
    body: string;
    author_id: string;
    channel_id: number;
    hidden_at: string | null;
  } | null;
}

function useReports(status: ReportStatus | "all") {
  return useQuery({
    queryKey: ["admin-post-reports", status],
    queryFn: async () => {
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            order: (c: string, o: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
              eq: (c: string, v: string) => {
                order: (c: string, o: { ascending: boolean }) => {
                  limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
                };
              };
            };
          };
        };
      };
      const base = client.from("post_reports").select("*, post:community_posts(id,title,body,author_id,channel_id,hidden_at)");
      const q = status === "all"
        ? base.order("created_at", { ascending: false }).limit(200)
        : base.order("created_at", { ascending: false }).limit(1) // placeholder to satisfy typing
          ;
      let res;
      if (status === "all") {
        res = await q;
      } else {
        // Re-do with eq for status
        const client2 = supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (c: string, v: string) => {
                order: (c: string, o: { ascending: boolean }) => {
                  limit: (n: number) => Promise<{ data: unknown; error: unknown }>;
                };
              };
            };
          };
        };
        res = await client2.from("post_reports")
          .select("*, post:community_posts(id,title,body,author_id,channel_id,hidden_at)")
          .eq("status", status)
          .order("created_at", { ascending: false })
          .limit(200);
      }
      if (res.error) throw res.error;
      return (res.data as ReportRow[]) ?? [];
    },
    staleTime: 15_000,
  });
}

export default function AdminModeration() {
  const { user, isAdmin } = useAuth();
  const [filter, setFilter] = useState<ReportStatus | "all">("open");
  const { data: reports = [], isLoading } = useReports(filter);
  const qc = useQueryClient();

  const resolve = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "resolved" | "dismissed" }) => {
      const client = supabase as unknown as {
        from: (t: string) => {
          update: (v: Record<string, unknown>) => {
            eq: (c: string, v: number) => Promise<{ error: unknown }>;
          };
        };
      };
      const { error } = await client.from("post_reports")
        .update({ status, resolved_by: user?.id ?? null, resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-post-reports"] });
    },
  });

  const hidePost = useMutation({
    mutationFn: async (postId: number) => {
      const client = supabase as unknown as {
        from: (t: string) => {
          update: (v: Record<string, unknown>) => {
            eq: (c: string, v: number) => Promise<{ error: unknown }>;
          };
        };
      };
      const { error } = await client.from("community_posts")
        .update({ hidden_at: new Date().toISOString() })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-post-reports"] }),
  });

  const openCount = useMemo(() => reports.filter((r) => r.status === "open").length, [reports]);

  if (!isAdmin) {
    return (
      <MemberLayout>
        <MemberPage>
          <MemberPageHeader eyebrow="Moderation" title="Access denied" description="Admins only." />
        </MemberPage>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout>
      <MemberPage>
        <MemberPageHeader
          eyebrow="Community moderation"
          title="Reported posts"
          description={<span>Review flags from members and take action. Open queue: <strong>{openCount}</strong>.</span>}
        />

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {(["open", "resolved", "dismissed", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md border px-3 py-1.5 font-semibold uppercase tracking-[0.12em] ${filter === f ? "border-accent bg-accent/10 text-accent" : "border-border bg-background text-foreground/70 hover:bg-secondary"}`}
            >
              {f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="aa-panel h-24 animate-pulse" aria-hidden />
        ) : reports.length === 0 ? (
          <div className="aa-empty-state">
            <Flag className="mx-auto mb-3 h-6 w-6 text-accent" />
            <h3 className="font-serif text-2xl text-primary">Queue is clear</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7">Nothing to review in this view.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="aa-panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <StatusPill tone={r.status === "open" ? "warning" : r.status === "resolved" ? "success" : "neutral"}>
                        {r.status}
                      </StatusPill>
                      <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{r.reason}</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                    {r.post ? (
                      <>
                        <p className="font-medium text-primary">{r.post.title || r.post.body.slice(0, 80)}</p>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{r.post.body}</p>
                        {r.post.hidden_at && <p className="mt-1 text-xs text-muted-foreground">Post is hidden.</p>}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Post deleted.</p>
                    )}
                    {r.details && (
                      <p className="mt-2 rounded-md bg-secondary/60 p-2 text-xs text-foreground/80">
                        <strong>Reporter note:</strong> {r.details}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {r.post && (
                      <Link
                        to={`/community`}
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent hover:underline"
                      >
                        <ExternalLink size={12} /> Open community
                      </Link>
                    )}
                    {r.status === "open" && (
                      <>
                        {r.post && !r.post.hidden_at && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await hidePost.mutateAsync(r.post!.id);
                                await resolve.mutateAsync({ id: r.id, status: "resolved" });
                                toast.success("Post hidden and report resolved.");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Action failed");
                              }
                            }}
                          >
                            Hide post
                          </Button>
                        )}
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => resolve.mutate({ id: r.id, status: "resolved" }, {
                            onSuccess: () => toast.success("Marked resolved."),
                          })}
                          disabled={resolve.isPending}
                        >
                          {resolve.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Resolve
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resolve.mutate({ id: r.id, status: "dismissed" })}
                          disabled={resolve.isPending}
                        >
                          <X size={14} /> Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </MemberPage>
    </MemberLayout>
  );
}