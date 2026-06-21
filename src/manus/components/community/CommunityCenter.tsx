import { useEffect, useMemo, useState } from "react";
import { Hash, Plus, Pin, Trash2, Send, MessageCircle, ArrowLeft, Settings2, Loader2 } from "lucide-react";
import { useAuth } from "@/manus/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  useSpaces,
  useChannels,
  usePosts,
  useReplies,
  useCreatePost,
  useCreateReply,
  useDeletePost,
  useDeleteReply,
  useTogglePinPost,
  useCreateSpace,
  useCreateChannel,
  usePostReactions,
  useReplyReactions,
  useToggleReaction,
  useLogModeration,
  type CommunityPost,
} from "@/manus/hooks/community/useCommunityData";
import { CreateSpaceDialog, CreateChannelDialog } from "./CommunityDialogs";

const EMOJIS = ["❤️", "🔥", "✨", "👏", "😍"];
const LS_LAST = "community:last";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function CommunityCenter() {
  const { user, isAdmin } = useAuth();
  const userId = user?.id ?? null;

  const { data: spaces = [], isLoading: spacesLoading } = useSpaces();
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [channelId, setChannelId] = useState<number | null>(null);
  const [openPost, setOpenPost] = useState<CommunityPost | null>(null);
  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false);
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);

  // restore last selection
  useEffect(() => {
    if (spaces.length === 0) return;
    if (spaceId && spaces.some((s) => s.id === spaceId)) return;
    try {
      const raw = localStorage.getItem(LS_LAST);
      const saved = raw ? JSON.parse(raw) : null;
      const restored = saved?.spaceId && spaces.find((s) => s.id === saved.spaceId);
      setSpaceId(restored ? saved.spaceId : spaces[0].id);
    } catch {
      setSpaceId(spaces[0].id);
    }
  }, [spaces, spaceId]);

  const { data: channels = [], isLoading: channelsLoading } = useChannels(spaceId);

  useEffect(() => {
    if (!channels.length) {
      setChannelId(null);
      return;
    }
    if (channelId && channels.some((c) => c.id === channelId)) return;
    try {
      const raw = localStorage.getItem(LS_LAST);
      const saved = raw ? JSON.parse(raw) : null;
      const restored = saved?.channelId && channels.find((c) => c.id === saved.channelId);
      setChannelId(restored ? saved.channelId : channels[0].id);
    } catch {
      setChannelId(channels[0].id);
    }
  }, [channels, channelId]);

  useEffect(() => {
    if (spaceId && channelId) {
      try {
        localStorage.setItem(LS_LAST, JSON.stringify({ spaceId, channelId }));
      } catch { /* ignore */ }
    }
  }, [spaceId, channelId]);

  const { data: posts = [], isLoading: postsLoading } = usePosts(channelId);
  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const { data: postReactions = [] } = usePostReactions(postIds);

  const createPost = useCreatePost(channelId, userId);
  const deletePost = useDeletePost(channelId);
  const togglePin = useTogglePinPost(channelId);
  const toggleReaction = useToggleReaction();
  const logModeration = useLogModeration();

  const activeChannel = channels.find((c) => c.id === channelId) ?? null;
  const activeSpace = spaces.find((s) => s.id === spaceId) ?? null;

  const reactionsByPost = useMemo(() => {
    const map = new Map<number, { reaction: string; count: number; mine: boolean }[]>();
    for (const r of postReactions) {
      if (!r.post_id) continue;
      const list = map.get(r.post_id) ?? [];
      const found = list.find((x) => x.reaction === r.reaction);
      if (found) {
        found.count += 1;
        if (r.user_id === userId) found.mine = true;
      } else {
        list.push({ reaction: r.reaction, count: 1, mine: r.user_id === userId });
      }
      map.set(r.post_id, list);
    }
    return map;
  }, [postReactions, userId]);

  /* ---------------- Composer state ---------------- */
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");

  const handlePost = async () => {
    if (!draftBody.trim()) return;
    try {
      await createPost.mutateAsync({ title: draftTitle, body: draftBody });
      setDraftTitle("");
      setDraftBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível publicar");
    }
  };

  const handleDeletePost = async (post: CommunityPost) => {
    if (!userId) return;
    try {
      await deletePost.mutateAsync(post.id);
      if (isAdmin && post.author_id !== userId) {
        await logModeration.mutateAsync({
          action: "delete_post",
          moderatorId: userId,
          postId: post.id,
        });
      }
      if (openPost?.id === post.id) setOpenPost(null);
      toast.success("Post removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  };

  if (spacesLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background text-foreground">
      {/* ============ Spaces rail ============ */}
      <aside className="hidden md:flex w-16 flex-col items-center gap-2 border-r border-border/60 bg-muted/30 py-3">
        {spaces.map((s) => {
          const initials = s.name.slice(0, 2).toUpperCase();
          const active = s.id === spaceId;
          return (
            <button
              key={s.id}
              onClick={() => setSpaceId(s.id)}
              title={s.name}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold transition-all ${
                active
                  ? "rounded-xl bg-primary text-primary-foreground shadow"
                  : "bg-background text-muted-foreground hover:rounded-xl hover:bg-primary/10 hover:text-foreground"
              }`}
            >
              {initials}
            </button>
          );
        })}
        {isAdmin && (
          <button
            onClick={() => setSpaceDialogOpen(true)}
            title="Novo Space"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-muted-foreground transition-all hover:rounded-xl hover:bg-primary/10 hover:text-foreground"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </aside>

      {/* ============ Channels list ============ */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border/60 bg-muted/20">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-serif text-base">{activeSpace?.name ?? "—"}</p>
            {activeSpace?.description && (
              <p className="truncate text-xs text-muted-foreground">{activeSpace.description}</p>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-0.5 p-2">
            {channelsLoading && (
              <p className="px-2 py-3 text-xs text-muted-foreground">Carregando…</p>
            )}
            {!channelsLoading && channels.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Nenhum canal ainda{isAdmin ? "." : ". Peça a um admin para criar."}
              </p>
            )}
            {channels.map((c) => {
              const active = c.id === channelId;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setChannelId(c.id);
                    setOpenPost(null);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                    active
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <Hash className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
        {isAdmin && spaceId && (
          <div className="border-t border-border/60 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => setChannelDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> Novo canal
            </Button>
          </div>
        )}
      </aside>

      {/* ============ Feed ============ */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <div className="min-w-0">
              <h1 className="truncate font-serif text-lg leading-tight">
                {activeChannel?.name ?? "selecione um canal"}
              </h1>
              {activeChannel?.description && (
                <p className="truncate text-xs text-muted-foreground">{activeChannel.description}</p>
              )}
            </div>
          </div>
          {isAdmin && activeChannel && (
            <span className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Settings2 className="h-3.5 w-3.5" /> admin
            </span>
          )}
        </header>

        <ScrollArea className="flex-1">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
            {postsLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!postsLoading && posts.length === 0 && activeChannel && (
              <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                Seja o primeiro a postar em <span className="font-medium">#{activeChannel.name}</span>.
              </div>
            )}
            {posts.map((post) => {
              const mine = post.author_id === userId;
              const canDelete = mine || isAdmin;
              const canPin = isAdmin;
              const reactions = reactionsByPost.get(post.id) ?? [];
              return (
                <article
                  key={post.id}
                  className="group rounded-lg border border-border/60 bg-card p-4 transition hover:border-border"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => setOpenPost(post)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {post.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                        <span>{timeAgo(post.created_at)}</span>
                        {mine && <span className="rounded bg-muted px-1.5 py-0.5">você</span>}
                      </div>
                      {post.title && (
                        <h3 className="mt-1 font-serif text-base leading-snug">{post.title}</h3>
                      )}
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-4">
                        {post.body}
                      </p>
                    </button>
                    <div className="flex flex-col items-end gap-1 opacity-0 transition group-hover:opacity-100">
                      {canPin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            togglePin.mutate({ id: post.id, pinned: !post.pinned })
                          }
                          title={post.pinned ? "Desafixar" : "Fixar"}
                        >
                          <Pin className={`h-3.5 w-3.5 ${post.pinned ? "fill-current" : ""}`} />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeletePost(post)}
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {reactions.map((r) => (
                      <button
                        key={r.reaction}
                        onClick={() =>
                          userId &&
                          toggleReaction.mutate({
                            reaction: r.reaction,
                            userId,
                            postId: post.id,
                          })
                        }
                        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                          r.mine
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/60 hover:border-border"
                        }`}
                      >
                        <span>{r.reaction}</span>
                        <span className="tabular-nums">{r.count}</span>
                      </button>
                    ))}
                    {userId && (
                      <div className="flex items-center gap-0.5">
                        {EMOJIS.map((e) => {
                          const has = reactions.find((r) => r.reaction === e);
                          if (has) return null;
                          return (
                            <button
                              key={e}
                              onClick={() =>
                                toggleReaction.mutate({
                                  reaction: e,
                                  userId,
                                  postId: post.id,
                                })
                              }
                              className="rounded-full px-1.5 py-0.5 text-xs opacity-50 hover:bg-muted hover:opacity-100"
                              title={`Reagir ${e}`}
                            >
                              {e}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <button
                      onClick={() => setOpenPost(post)}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      respostas
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </ScrollArea>

        {/* Composer */}
        {activeChannel && userId && (
          <div className="border-t border-border/60 bg-background p-3">
            <div className="mx-auto max-w-3xl space-y-2">
              <Input
                placeholder="Título (opcional)"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="h-9"
              />
              <Textarea
                placeholder={`Mensagem em #${activeChannel.name}…  (Shift+Enter quebra linha, Enter envia)`}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePost();
                  }
                }}
                rows={2}
                className="resize-none"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handlePost}
                  disabled={createPost.isPending || !draftBody.trim()}
                >
                  {createPost.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Publicar
                </Button>
              </div>
            </div>
          </div>
        )}
        {activeChannel && !userId && (
          <div className="border-t border-border/60 p-3 text-center text-sm text-muted-foreground">
            Faça login para participar.
          </div>
        )}
      </main>

      {/* ============ Thread drawer ============ */}
      <Sheet open={!!openPost} onOpenChange={(open) => !open && setOpenPost(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          {openPost && (
            <ThreadPanel
              post={openPost}
              isAdmin={isAdmin}
              userId={userId}
              onClose={() => setOpenPost(null)}
              onDeletePost={() => handleDeletePost(openPost)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ============ Admin dialogs ============ */}
      <CreateSpaceDialog
        open={spaceDialogOpen}
        onOpenChange={setSpaceDialogOpen}
      />
      <CreateChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        spaceId={spaceId}
      />
    </div>
  );
}

/* ====================================================================== */
/*  Thread panel                                                          */
/* ====================================================================== */

function ThreadPanel({
  post,
  isAdmin,
  userId,
  onClose,
  onDeletePost,
}: {
  post: CommunityPost;
  isAdmin: boolean;
  userId: string | null;
  onClose: () => void;
  onDeletePost: () => void;
}) {
  const { data: replies = [], isLoading } = useReplies(post.id);
  const createReply = useCreateReply(post.id, userId);
  const deleteReply = useDeleteReply(post.id);
  const toggleReaction = useToggleReaction();
  const logModeration = useLogModeration();

  const replyIds = useMemo(() => replies.map((r) => r.id), [replies]);
  const { data: replyReactions = [] } = useReplyReactions(replyIds);

  const reactionsByReply = useMemo(() => {
    const map = new Map<number, { reaction: string; count: number; mine: boolean }[]>();
    for (const r of replyReactions) {
      if (!r.reply_id) continue;
      const list = map.get(r.reply_id) ?? [];
      const found = list.find((x) => x.reaction === r.reaction);
      if (found) {
        found.count += 1;
        if (r.user_id === userId) found.mine = true;
      } else {
        list.push({ reaction: r.reaction, count: 1, mine: r.user_id === userId });
      }
      map.set(r.reply_id, list);
    }
    return map;
  }, [replyReactions, userId]);

  const [draft, setDraft] = useState("");

  const submit = async () => {
    if (!draft.trim()) return;
    try {
      await createReply.mutateAsync(draft);
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao responder");
    }
  };

  const removeReply = async (id: number, authorId: string) => {
    try {
      await deleteReply.mutateAsync(id);
      if (isAdmin && userId && authorId !== userId) {
        await logModeration.mutateAsync({
          action: "delete_reply",
          moderatorId: userId,
          replyId: id,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover");
    }
  };

  return (
    <>
      <SheetHeader className="border-b border-border/60 p-4">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <SheetTitle className="font-serif text-base leading-tight truncate">
              {post.title}
            </SheetTitle>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{post.body}</p>
          </div>
          {(isAdmin || post.author_id === userId) && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDeletePost}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-4">
          {isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && replies.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">Nenhuma resposta ainda.</p>
          )}
          {replies.map((r) => {
            const mine = r.author_id === userId;
            const reactions = reactionsByReply.get(r.id) ?? [];
            return (
              <div key={r.id} className="rounded-md border border-border/60 bg-card p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{timeAgo(r.created_at)} {mine && "· você"}</span>
                  {(mine || isAdmin) && (
                    <button
                      onClick={() => removeReply(r.id, r.author_id)}
                      className="opacity-60 hover:opacity-100"
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{r.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {reactions.map((rr) => (
                    <button
                      key={rr.reaction}
                      onClick={() =>
                        userId &&
                        toggleReaction.mutate({
                          reaction: rr.reaction,
                          userId,
                          replyId: r.id,
                        })
                      }
                      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                        rr.mine ? "border-primary/40 bg-primary/10" : "border-border/60"
                      }`}
                    >
                      <span>{rr.reaction}</span>
                      <span className="tabular-nums">{rr.count}</span>
                    </button>
                  ))}
                  {userId && (
                    <div className="flex items-center gap-0.5">
                      {EMOJIS.map((e) => {
                        const has = reactions.find((x) => x.reaction === e);
                        if (has) return null;
                        return (
                          <button
                            key={e}
                            onClick={() =>
                              toggleReaction.mutate({
                                reaction: e,
                                userId,
                                replyId: r.id,
                              })
                            }
                            className="rounded-full px-1.5 py-0.5 text-xs opacity-50 hover:bg-muted hover:opacity-100"
                          >
                            {e}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      {userId && !post.locked && (
        <div className="border-t border-border/60 p-3">
          <Textarea
            placeholder="Responder…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            className="resize-none"
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={submit}
              disabled={createReply.isPending || !draft.trim()}
            >
              {createReply.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Responder
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export { slugify };
