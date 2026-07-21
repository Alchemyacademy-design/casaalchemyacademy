import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Eye,
  EyeOff,
  Filter,
  Hash,
  Loader2,
  Lock,
  MessageCircle,
  Pin,
  Plus,
  Search,
  Send,
  Trash2,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/manus/hooks/useAuth";
import { initialsFrom, resolveAvatarUrl } from "@/manus/components/UserAvatar";
import {
  type CommunityPost,
  useChannelBySlug,
  useChannels,
  useCreatePost,
  useCreateReply,
  useDeletePost,
  useDeleteReply,
  usePostReactions,
  usePostsInfinite,
  useReplies,
  useReplyReactions,
  useSpaces,
  useToggleReaction,
  useUpdateSpace,
  useDeleteSpace,
  useUpdateChannel,
  useDeleteChannel,
} from "@/manus/hooks/community/useCommunityData";
import {
  type CommunityAuthorProfile,
  useCommunityAuthorProfiles,
  useCommunityReplyCounts,
  useModerateCommunityPost,
} from "@/manus/hooks/community/useCommunityPremiumData";
import { dedupePostPages, resolveDeepLinkChannel } from "@/manus/services/community-deeplink";
import { CreateChannelDialog, CreateSpaceDialog } from "./CommunityDialogs";
import "@/manus/styles/community-premium.css";
import { useChannelUnread, useMarkChannelReadEffect } from "@/manus/hooks/community/useChannelUnread";
import MentionInput from "./MentionInput";
import MentionText from "./MentionText";
import { notifyMentions, resolveMentionUserIds } from "./mentions";

const REACTIONS = ["❤️", "🔥", "✨", "👏", "😍"];
const STORAGE_KEY = "community:last";

const CHANNEL_PURPOSES: Record<string, string> = {
  general: "Open conversation about the course and the space.",
  questions: "Ask anything — the community and mentors reply here.",
  projects: "Share your work in progress and finished projects.",
  inspiration: "Post references, moodboards and things that spark ideas.",
  resources: "Curated links, tools, suppliers and reading lists.",
};

const SPACE_RULES: string[] = [
  "Be kind and constructive — this is a space for creators helping creators.",
  "Stay on topic for the course this Space belongs to.",
  "Credit references and never share paid course content outside the Academy.",
  "Use the right channel: general, questions, projects, inspiration or resources.",
];

type FilterMode = "all" | "pinned" | "mine" | "hidden";

type Props = {
  initialSpaceSlug?: string;
  initialChannelSlug?: string;
  initialDraftTitle?: string;
  initialDraftBody?: string;
};

function relativeTime(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function profileName(profile: CommunityAuthorProfile | undefined, own: boolean) {
  if (own) return profile?.display_name || profile?.full_name || "You";
  return profile?.display_name || profile?.full_name || "Academy member";
}

function ProfileMark({ profile, own }: { profile?: CommunityAuthorProfile; own: boolean }) {
  const name = profileName(profile, own);
  const url = resolveAvatarUrl(profile?.avatar_path);
  const initials = initialsFrom(name);
  return url ? (
    <img src={url} alt="" loading="lazy" className="aa-community-avatar" />
  ) : (
    <span className="aa-community-avatar aa-community-avatar-fallback" aria-hidden="true">{initials}</span>
  );
}

function useDebouncedValue(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function CommunityPremium({
  initialSpaceSlug,
  initialChannelSlug,
  initialDraftTitle,
  initialDraftBody,
}: Props) {
  const { user, isAdmin } = useAuth();
  const userId = user?.id ?? null;
  const { data: spaces = [], isLoading: spacesLoading, isError: spacesError, refetch: refetchSpaces } = useSpaces();
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [channelId, setChannelId] = useState<number | null>(null);
  const [openPost, setOpenPost] = useState<CommunityPost | null>(null);
  const [spaceDialogOpen, setSpaceDialogOpen] = useState(false);
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const updateSpace = useUpdateSpace();
  const deleteSpace = useDeleteSpace();
  const updateChannel = useUpdateChannel(spaceId);
  const deleteChannel = useDeleteChannel(spaceId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [draftTitle, setDraftTitle] = useState(initialDraftTitle ?? "");
  const [draftBody, setDraftBody] = useState(initialDraftBody ?? "");
  // Handle→userId mapping accumulated as the composer inserts mentions.
  const [mentionDir, setMentionDir] = useState<Map<string, string>>(new Map());
  const debouncedSearch = useDebouncedValue(search.trim().toLocaleLowerCase(), 300);

  useEffect(() => {
    if (!spaces.length || spaceId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      setSpaceId(spaces.some((space) => space.id === saved?.spaceId) ? saved.spaceId : spaces[0].id);
    } catch {
      setSpaceId(spaces[0].id);
    }
  }, [spaces, spaceId]);

  const { data: channels = [], isLoading: channelsLoading } = useChannels(spaceId);
  const channelIds = useMemo(() => channels.map((c) => c.id), [channels]);
  const { data: unreadByChannel = {} } = useChannelUnread(channelIds, userId);
  useMarkChannelReadEffect(channelId, userId);
  const { data: matchedChannel, isLoading: deepLinkLoading } = useChannelBySlug(initialChannelSlug, initialSpaceSlug);
  const deepLinkKey = `${initialSpaceSlug ?? ""}|${initialChannelSlug ?? ""}`;
  const appliedDeepLink = useRef("");

  useEffect(() => {
    if (!initialChannelSlug || deepLinkLoading || appliedDeepLink.current === deepLinkKey) return;
    const result = resolveDeepLinkChannel(initialChannelSlug, matchedChannel);
    if (!result) return;
    appliedDeepLink.current = deepLinkKey;
    if (result.kind === "not-found") {
      toast.message(`Channel “${initialChannelSlug}” is not available. Pick another channel to post your draft.`);
      return;
    }
    setSpaceId(result.spaceId);
    setChannelId(result.channelId);
  }, [deepLinkKey, deepLinkLoading, initialChannelSlug, matchedChannel]);

  useEffect(() => {
    if (!channels.length) {
      setChannelId(null);
      return;
    }
    if (channelId && channels.some((channel) => channel.id === channelId)) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      setChannelId(channels.some((channel) => channel.id === saved?.channelId) ? saved.channelId : channels[0].id);
    } catch {
      setChannelId(channels[0].id);
    }
  }, [channelId, channels]);

  useEffect(() => {
    if (!spaceId || !channelId) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ spaceId, channelId }));
  }, [spaceId, channelId]);

  useEffect(() => {
    setDraftTitle(initialDraftTitle ?? "");
    setDraftBody(initialDraftBody ?? "");
  }, [initialDraftBody, initialDraftTitle]);

  useEffect(() => {
    setSearch("");
    setFilter("all");
    setOpenPost(null);
  }, [channelId]);

  const postsQuery = usePostsInfinite(channelId);
  const posts = useMemo(() => dedupePostPages(postsQuery.data?.pages ?? []), [postsQuery.data]);
  const postIds = useMemo(() => posts.map((post) => post.id), [posts]);
  const authorIds = useMemo(() => posts.map((post) => post.author_id), [posts]);
  const { data: profiles = [] } = useCommunityAuthorProfiles(authorIds);
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const { data: replyCounts = {} } = useCommunityReplyCounts(postIds);
  const { data: postReactions = [] } = usePostReactions(postIds);
  const createPost = useCreatePost(channelId, userId);
  const deletePost = useDeletePost(channelId);
  const toggleReaction = useToggleReaction();
  const moderatePost = useModerateCommunityPost();

  const reactionsByPost = useMemo(() => {
    const map = new Map<number, Array<{ reaction: string; count: number; mine: boolean }>>();
    for (const item of postReactions) {
      if (!item.post_id) continue;
      const list = map.get(item.post_id) ?? [];
      const found = list.find((entry) => entry.reaction === item.reaction);
      if (found) {
        found.count += 1;
        if (item.user_id === userId) found.mine = true;
      } else {
        list.push({ reaction: item.reaction, count: 1, mine: item.user_id === userId });
      }
      map.set(item.post_id, list);
    }
    return map;
  }, [postReactions, userId]);

  const visiblePosts = useMemo(() => {
    return posts.filter((post) => {
      if (!isAdmin && post.hidden_at) return false;
      if (filter === "hidden" && !post.hidden_at) return false;
      if (filter !== "hidden" && post.hidden_at) return false;
      if (filter === "pinned" && !post.pinned) return false;
      if (filter === "mine" && post.author_id !== userId) return false;
      if (debouncedSearch.length >= 2) {
        const haystack = `${post.title} ${post.body}`.toLocaleLowerCase();
        if (!haystack.includes(debouncedSearch)) return false;
      }
      return true;
    });
  }, [debouncedSearch, filter, isAdmin, posts, userId]);

  const activeSpace = spaces.find((space) => space.id === spaceId) ?? null;
  const activeChannel = channels.find((channel) => channel.id === channelId) ?? null;

  async function publishPost() {
    if (!draftBody.trim()) return;
    try {
      const created = await createPost.mutateAsync({ title: draftTitle, body: draftBody.trim() });
      const mentionedIds = resolveMentionUserIds(draftBody, mentionDir);
      if (mentionedIds.length && activeChannel) {
        try {
          await notifyMentions({
            userIds: mentionedIds,
            title: `You were mentioned in #${activeChannel.name}`,
            body: draftBody,
            href: `/community?space=${encodeURIComponent(spaces.find((s) => s.id === spaceId)?.slug ?? "")}&channel=${encodeURIComponent(activeChannel.slug)}`,
            postId: created?.id ?? null,
          });
        } catch { /* mentions are best-effort */ }
      }
      setDraftTitle("");
      setDraftBody("");
      setMentionDir(new Map());
      toast.success("Post published");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish");
    }
  }

  async function removePost(post: CommunityPost) {
    if (!window.confirm("Remove this post? It will be preserved in the moderation history.")) return;
    try {
      await deletePost.mutateAsync(post.id);
      setOpenPost((current) => current?.id === post.id ? null : current);
      toast.success("Post removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove");
    }
  }

  async function applyModeration(post: CommunityPost, action: "pin" | "lock" | "hide") {
    if (!isAdmin || !userId || !channelId) return;
    const patch = action === "pin"
      ? { pinned: !post.pinned }
      : action === "lock"
        ? { locked: !post.locked }
        : { hidden_at: post.hidden_at ? null : new Date().toISOString() };
    const actionName = action === "pin"
      ? (post.pinned ? "unpin_post" : "pin_post")
      : action === "lock"
        ? (post.locked ? "unlock_post" : "lock_post")
        : (post.hidden_at ? "restore_post" : "hide_post");
    try {
      const updated = await moderatePost.mutateAsync({
        id: post.id,
        channelId,
        patch,
        action: actionName,
        moderatorId: userId,
      });
      setOpenPost((current) => current?.id === post.id ? updated : current);
      toast.success("Moderation updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update moderation");
    }
  }

  if (spacesLoading) {
    return <div className="aa-community-loading"><Loader2 className="animate-spin" /></div>;
  }

  if (spacesError) {
    return (
      <div className="aa-community-state">
        <p>Could not load the community.</p>
        <Button onClick={() => refetchSpaces()}>Try again</Button>
      </div>
    );
  }

  return (
    <section className="aa-community-shell">
      <aside className="aa-community-spaces" aria-label="Community spaces">
        <p className="aa-community-rail-label">Spaces</p>
        {spaces.map((space) => (
          <div key={space.id} style={{ position: "relative" }}>
            <button
              type="button"
              className={space.id === spaceId ? "is-active" : ""}
              onClick={() => setSpaceId(space.id)}
              title={space.name}
            >
              {space.name.slice(0, 2).toUpperCase()}
            </button>
            {isAdmin && (
              <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 2 }}>
                <button
                  type="button"
                  title="Rename space"
                  aria-label={`Rename ${space.name}`}
                  onClick={async () => {
                    const name = window.prompt("Rename space", space.name);
                    if (!name || !name.trim() || name.trim() === space.name) return;
                    try {
                      await updateSpace.mutateAsync({ id: space.id, patch: { name: name.trim() } });
                      toast.success("Space updated");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to update space");
                    }
                  }}
                  style={{ padding: 2, opacity: 0.7 }}
                >
                  <Pencil size={11} />
                </button>
                <button
                  type="button"
                  title="Delete space"
                  aria-label={`Delete ${space.name}`}
                  onClick={async () => {
                    if (!window.confirm(`Delete space "${space.name}"? All its channels and posts will be removed.`)) return;
                    try {
                      await deleteSpace.mutateAsync(space.id);
                      if (spaceId === space.id) setSpaceId(null);
                      toast.success("Space deleted");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to delete space");
                    }
                  }}
                  style={{ padding: 2, opacity: 0.7, color: "var(--destructive, #b91c1c)" }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            )}
          </div>
        ))}
        {isAdmin && <button type="button" onClick={() => setSpaceDialogOpen(true)} title="New space"><Plus size={16} /></button>}
      </aside>

      <aside className="aa-community-channels">
        <header>
          <p className="section-label">Community space</p>
          <h2>{activeSpace?.name ?? "Community"}</h2>
          {activeSpace?.description && <p>{activeSpace.description}</p>}
        </header>
        <ScrollArea className="flex-1">
          <nav aria-label="Community channels">
            {channelsLoading && <p className="aa-community-muted">Loading channels…</p>}
            {!channelsLoading && channels.length === 0 && <p className="aa-community-muted">No channels published.</p>}
            {channels.map((channel) => {
              const unread = unreadByChannel[channel.id] ?? 0;
              const isActive = channel.id === channelId;
              return (
                <div key={channel.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  className={isActive ? "is-active" : ""}
                  onClick={() => setChannelId(channel.id)}
                  style={{ flex: 1 }}
                >
                  <Hash size={14} />
                  <span style={{ flex: 1, fontWeight: unread && !isActive ? 600 : undefined }}>{channel.name}</span>
                  {unread > 0 && !isActive && (
                    <span
                      aria-label={`${unread} unread`}
                      style={{
                        marginLeft: 8,
                        minWidth: 20,
                        height: 18,
                        padding: "0 6px",
                        borderRadius: 9999,
                        background: "var(--aa-olive-dark, #3a3f2b)",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      title="Rename channel"
                      aria-label={`Rename ${channel.name}`}
                      onClick={async () => {
                        const name = window.prompt("Rename channel", channel.name);
                        if (!name || !name.trim() || name.trim() === channel.name) return;
                        try {
                          await updateChannel.mutateAsync({ id: channel.id, patch: { name: name.trim() } });
                          toast.success("Channel updated");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed to update channel");
                        }
                      }}
                      style={{ padding: 4, opacity: 0.6 }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      title="Delete channel"
                      aria-label={`Delete ${channel.name}`}
                      onClick={async () => {
                        if (!window.confirm(`Delete channel "${channel.name}"? Its posts will be removed.`)) return;
                        try {
                          await deleteChannel.mutateAsync(channel.id);
                          if (channelId === channel.id) setChannelId(null);
                          toast.success("Channel deleted");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed to delete channel");
                        }
                      }}
                      style={{ padding: 4, opacity: 0.6, color: "var(--destructive, #b91c1c)" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>
        {isAdmin && spaceId && <Button variant="ghost" onClick={() => setChannelDialogOpen(true)}><Plus size={14} /> New channel</Button>}
      </aside>

      <main className="aa-community-main">
        <header className="aa-community-header">
          <div>
            <p className="section-label">Member conversation</p>
            <h1>{activeChannel?.name ?? "Select a channel"}</h1>
            {activeChannel?.description && <p>{activeChannel.description}</p>}
          </div>
          <div className="aa-community-mobile-selects">
            <select value={spaceId ?? ""} onChange={(event) => setSpaceId(Number(event.target.value))} aria-label="Select space">
              {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
            </select>
            <select value={channelId ?? ""} onChange={(event) => setChannelId(Number(event.target.value))} aria-label="Select channel">
              {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
            </select>
          </div>
        </header>

        {activeChannel && (
          <div className="aa-community-toolbar">
            <label>
              <Search size={15} />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search posts…" />
            </label>
            <div className="aa-community-filters" aria-label="Filters">
              <Filter size={14} />
              {(["all", "pinned", "mine"] as FilterMode[]).map((mode) => (
                <button key={mode} type="button" className={filter === mode ? "is-active" : ""} onClick={() => setFilter(mode)}>
                  {mode === "all" ? "All" : mode === "pinned" ? "Pinned" : "Mine"}
                </button>
              ))}
              {isAdmin && <button type="button" className={filter === "hidden" ? "is-active" : ""} onClick={() => setFilter("hidden")}>Hidden</button>}
            </div>
          </div>
        )}

        <ScrollArea className="aa-community-feed">
          <div className="aa-community-feed-inner">
            {postsQuery.isLoading && <div className="aa-community-loading"><Loader2 className="animate-spin" /></div>}
            {postsQuery.isError && (
              <div className="aa-community-state">
                <p>Could not load posts.</p>
                <Button onClick={() => postsQuery.refetch()}>Try again</Button>
              </div>
            )}
            {!postsQuery.isLoading && !postsQuery.isError && visiblePosts.length === 0 && activeChannel && (
              <div className="aa-community-state">
                <p>{posts.length ? "No posts match the filters." : `Be the first to start a conversation in #${activeChannel.name}.`}</p>
              </div>
            )}

            {visiblePosts.map((post) => {
              const own = post.author_id === userId;
              const profile = profileMap.get(post.author_id);
              const reactions = reactionsByPost.get(post.id) ?? [];
              return (
                <article key={post.id} className={`aa-community-post ${post.pinned ? "is-pinned" : ""} ${post.hidden_at ? "is-hidden" : ""}`}>
                  <div className="aa-community-post-author">
                    <ProfileMark profile={profile} own={own} />
                    <div>
                      <strong>{profileName(profile, own)}</strong>
                      <span>{relativeTime(post.created_at)}{own ? " · you" : ""}</span>
                    </div>
                    <div className="aa-community-post-flags">
                      {post.pinned && <span><Pin size={12} /> Pinned</span>}
                      {post.locked && <span><Lock size={12} /> Closed</span>}
                      {post.hidden_at && <span><EyeOff size={12} /> Hidden</span>}
                    </div>
                  </div>

                  <button type="button" className="aa-community-post-copy" onClick={() => setOpenPost(post)}>
                    <h3>{post.title}</h3>
                    <p><MentionText text={post.body} /></p>
                  </button>

                  <div className="aa-community-post-actions">
                    <div className="aa-community-reactions">
                      {reactions.map((reaction) => (
                        <button
                          type="button"
                          key={reaction.reaction}
                          className={reaction.mine ? "is-active" : ""}
                          onClick={() => userId && toggleReaction.mutate({ reaction: reaction.reaction, userId, postId: post.id })}
                        >
                          {reaction.reaction} <span>{reaction.count}</span>
                        </button>
                      ))}
                      {userId && REACTIONS.filter((emoji) => !reactions.some((reaction) => reaction.reaction === emoji)).map((emoji) => (
                        <button type="button" className="is-add" key={emoji} onClick={() => toggleReaction.mutate({ reaction: emoji, userId, postId: post.id })}>{emoji}</button>
                      ))}
                      {reactions.length > 0 && (
                        <span
                          aria-label={`${reactions.reduce((n, r) => n + r.count, 0)} total reactions`}
                          style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}
                        >
                          · {reactions.reduce((n, r) => n + r.count, 0)}
                        </span>
                      )}
                    </div>
                    <button type="button" className="aa-community-reply-count" onClick={() => setOpenPost(post)}>
                      <MessageCircle size={14} /> {replyCounts[post.id] ?? 0} {(replyCounts[post.id] ?? 0) === 1 ? "reply" : "replies"}
                    </button>
                  </div>

                  {(own || isAdmin) && (
                    <div className="aa-community-moderation">
                      {isAdmin && <button type="button" onClick={() => applyModeration(post, "pin")}><Pin size={14} /> {post.pinned ? "Unpin" : "Pin"}</button>}
                      {isAdmin && <button type="button" onClick={() => applyModeration(post, "lock")}>{post.locked ? <Unlock size={14} /> : <Lock size={14} />} {post.locked ? "Reopen" : "Close"}</button>}
                      {isAdmin && <button type="button" onClick={() => applyModeration(post, "hide")}>{post.hidden_at ? <Eye size={14} /> : <EyeOff size={14} />} {post.hidden_at ? "Restore" : "Hide"}</button>}
                      <button type="button" className="is-destructive" onClick={() => removePost(post)}><Trash2 size={14} /> Remove</button>
                    </div>
                  )}
                </article>
              );
            })}

            {postsQuery.hasNextPage && (
              <Button variant="outline" disabled={postsQuery.isFetchingNextPage} onClick={() => postsQuery.fetchNextPage()}>
                {postsQuery.isFetchingNextPage && <Loader2 size={14} className="animate-spin" />} Load more
              </Button>
            )}
          </div>
        </ScrollArea>

        {activeChannel && userId && (
          <footer className="aa-community-composer">
            <div>
              <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Post title" maxLength={140} />
              <MentionInput
                value={draftBody}
                onChange={(next, patch) => {
                  setDraftBody(next);
                  if (patch.size) setMentionDir((prev) => {
                    const merged = new Map(prev);
                    patch.forEach((v, k) => merged.set(k, v));
                    return merged;
                  });
                }}
                placeholder={`Share an idea, a question or your progress in #${activeChannel.name}… Use @ to mention someone.`}
                rows={3}
                maxLength={5000}
                ariaLabel="Post body"
              />
              <div><span>{draftBody.length}/5000</span><Button onClick={publishPost} disabled={!draftBody.trim() || createPost.isPending}>{createPost.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Publish</Button></div>
            </div>
          </footer>
        )}
      </main>

      <Sheet open={!!openPost} onOpenChange={(open) => !open && setOpenPost(null)}>
        <SheetContent side="right" className="aa-community-thread">
          {openPost && (
            <ThreadPanel
              post={openPost}
              userId={userId}
              isAdmin={isAdmin}
              profileMap={profileMap}
              onClose={() => setOpenPost(null)}
              onDelete={() => removePost(openPost)}
            />
          )}
        </SheetContent>
      </Sheet>

      <CreateSpaceDialog open={spaceDialogOpen} onOpenChange={setSpaceDialogOpen} />
      <CreateChannelDialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen} spaceId={spaceId} />
    </section>
  );
}

function ThreadPanel({
  post,
  userId,
  isAdmin,
  profileMap: parentProfiles,
  onClose,
  onDelete,
}: {
  post: CommunityPost;
  userId: string | null;
  isAdmin: boolean;
  profileMap: Map<string, CommunityAuthorProfile>;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { data: replies = [], isLoading, isError, refetch } = useReplies(post.id);
  const createReply = useCreateReply(post.id, userId);
  const deleteReply = useDeleteReply(post.id);
  const toggleReaction = useToggleReaction();
  const [draft, setDraft] = useState("");
  const [mentionDir, setMentionDir] = useState<Map<string, string>>(new Map());
  const replyIds = useMemo(() => replies.map((reply) => reply.id), [replies]);
  const replyAuthors = useMemo(() => replies.map((reply) => reply.author_id), [replies]);
  const { data: replyProfiles = [] } = useCommunityAuthorProfiles(replyAuthors);
  const profiles = useMemo(() => new Map([...parentProfiles, ...replyProfiles.map((profile) => [profile.id, profile] as const)]), [parentProfiles, replyProfiles]);
  const { data: replyReactions = [] } = useReplyReactions(replyIds);

  const groupedReactions = useMemo(() => {
    const map = new Map<number, Array<{ reaction: string; count: number; mine: boolean }>>();
    for (const item of replyReactions) {
      if (!item.reply_id) continue;
      const list = map.get(item.reply_id) ?? [];
      const found = list.find((entry) => entry.reaction === item.reaction);
      if (found) {
        found.count += 1;
        if (item.user_id === userId) found.mine = true;
      } else {
        list.push({ reaction: item.reaction, count: 1, mine: item.user_id === userId });
      }
      map.set(item.reply_id, list);
    }
    return map;
  }, [replyReactions, userId]);

  async function submitReply() {
    if (!draft.trim()) return;
    try {
      const created = await createReply.mutateAsync(draft.trim());
      const mentionedIds = resolveMentionUserIds(draft, mentionDir);
      if (mentionedIds.length) {
        try {
          await notifyMentions({
            userIds: mentionedIds,
            title: `You were mentioned in a reply`,
            body: draft,
            href: `/community`,
            postId: post.id,
            replyId: created?.id ?? null,
          });
        } catch { /* best-effort */ }
      }
      setDraft("");
      setMentionDir(new Map());
      toast.success("Reply posted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reply");
    }
  }

  async function removeReply(replyId: number) {
    if (!window.confirm("Remove this reply?")) return;
    try {
      await deleteReply.mutateAsync(replyId);
      toast.success("Reply removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove");
    }
  }

  return (
    <div className="aa-community-thread-inner">
      <SheetHeader className="aa-community-thread-header">
        <Button variant="ghost" size="icon" onClick={onClose}><ArrowLeft size={16} /></Button>
        <div>
          <p className="section-label">Conversation</p>
          <SheetTitle>{post.title}</SheetTitle>
          <p><MentionText text={post.body} /></p>
        </div>
        {(isAdmin || post.author_id === userId) && <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 size={15} /></Button>}
      </SheetHeader>

      <ScrollArea className="flex-1">
        <div className="aa-community-thread-replies">
          {isLoading && <div className="aa-community-loading"><Loader2 className="animate-spin" /></div>}
          {isError && <div className="aa-community-state"><p>Could not load replies.</p><Button onClick={() => refetch()}>Try again</Button></div>}
          {!isLoading && !isError && replies.length === 0 && <div className="aa-community-state"><p>This conversation has no replies yet.</p></div>}
          {replies.map((reply) => {
            const own = reply.author_id === userId;
            const profile = profiles.get(reply.author_id);
            const reactions = groupedReactions.get(reply.id) ?? [];
            return (
              <article key={reply.id} className="aa-community-reply">
                <div className="aa-community-post-author">
                  <ProfileMark profile={profile} own={own} />
                  <div><strong>{profileName(profile, own)}</strong><span>{relativeTime(reply.created_at)}</span></div>
                  {(own || isAdmin) && <button type="button" onClick={() => removeReply(reply.id)}><Trash2 size={13} /></button>}
                </div>
                <p><MentionText text={reply.body} /></p>
                <div className="aa-community-reactions">
                  {reactions.map((reaction) => (
                    <button type="button" key={reaction.reaction} className={reaction.mine ? "is-active" : ""} onClick={() => userId && toggleReaction.mutate({ reaction: reaction.reaction, userId, replyId: reply.id })}>
                      {reaction.reaction} <span>{reaction.count}</span>
                    </button>
                  ))}
                  {userId && REACTIONS.filter((emoji) => !reactions.some((reaction) => reaction.reaction === emoji)).map((emoji) => (
                    <button type="button" className="is-add" key={emoji} onClick={() => toggleReaction.mutate({ reaction: emoji, userId, replyId: reply.id })}>{emoji}</button>
                  ))}
                  {reactions.length > 0 && (
                    <span aria-label="total reactions" style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>
                      · {reactions.reduce((n, r) => n + r.count, 0)}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </ScrollArea>

      {post.locked ? (
        <div className="aa-community-thread-locked"><Lock size={15} /> This conversation was closed by moderation.</div>
      ) : userId ? (
        <footer className="aa-community-thread-composer">
          <MentionInput
            value={draft}
            onChange={(next, patch) => {
              setDraft(next);
              if (patch.size) setMentionDir((prev) => {
                const merged = new Map(prev);
                patch.forEach((v, k) => merged.set(k, v));
                return merged;
              });
            }}
            rows={3}
            maxLength={3000}
            placeholder="Write a reply… Use @ to mention someone."
            ariaLabel="Reply body"
          />
          <div><span>{draft.length}/3000</span><Button onClick={submitReply} disabled={!draft.trim() || createReply.isPending}>{createReply.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Reply</Button></div>
        </footer>
      ) : null}
    </div>
  );
}
