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
  Menu,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Send,
  Trash2,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { Bell, BellOff, Flag, Award, ArrowDownUp, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/manus/hooks/useAuth";
import { initialsFrom, resolveAvatarUrl } from "@/manus/components/UserAvatar";
import MemberProfileDialog from "@/manus/components/community/MemberProfileDialog";
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
import MentionInput, { type MentionInputHandle } from "./MentionInput";
import MentionText from "./MentionText";
import { notifyMentions, resolveMentionUserIds } from "./mentions";

const REACTIONS = ["❤️", "🔥", "✨", "👏", "😍"];
const STORAGE_KEY = "community:last";
const RULES_OPEN_KEY = "community:rulesOpen";
const HIDDEN_CHANNELS_KEY = "community:hiddenChannels";

type ChannelRow = { id: number; name: string; slug: string; description: string | null };

const CHANNEL_PURPOSES: Record<string, string> = {
  general: "Open conversation about the course and the space.",
  questions: "Ask anything — the community and mentors reply here.",
  projects: "Share your work in progress and finished projects.",
  inspiration: "Post references, moodboards and things that spark ideas.",
  resources: "Curated links, tools, suppliers and reading lists.",
};

type ChannelGuide = { title: string; intro: string; use: string[]; tip: string };

const CHANNEL_GUIDES: Record<string, ChannelGuide> = {
  general: {
    title: "Welcome to #general",
    intro: "This is the main channel of this Space — say hi, introduce yourself and share how this course is landing for you.",
    use: [
      "Introduce yourself: where you're from and what you're working on",
      "React to lessons, share a-ha moments and open discussions",
      "Keep it on-topic for this Space; use #questions, #projects, #inspiration or #resources for those",
    ],
    tip: "New here? Drop a short intro post so the community can welcome you.",
  },
  questions: {
    title: "How to use #questions",
    intro: "Ask anything about the course, the method or a decision you're stuck on. The community and mentors reply here.",
    use: [
      "Give context: which lesson or step you're on",
      "Attach a photo or link when it helps explain the situation",
      "One question per post — easier to follow and answer",
    ],
    tip: "Reply to others too — teaching what you know is the fastest way to learn.",
  },
  projects: {
    title: "Share in #projects",
    intro: "Post your work in progress and finished projects. Feedback is welcome and encouraged here.",
    use: [
      "Say what you're trying to achieve and the brief you're working from",
      "Share photos, plans or moodboards of the current state",
      "Ask for the kind of feedback you want (layout, palette, styling…)",
    ],
    tip: "Come back and post the “after” — the community loves a before/after.",
  },
  inspiration: {
    title: "Curate in #inspiration",
    intro: "A shared moodboard of references, images and ideas that spark something for you.",
    use: [
      "Post images, links or short notes about what you love and why",
      "Credit the source or designer whenever possible",
      "Group your finds by theme when it makes sense (light, texture, colour…)",
    ],
    tip: "Great references beat clever words — let the images do the talking.",
  },
  resources: {
    title: "Save in #resources",
    intro: "Curated links, tools, suppliers and reading that support the course.",
    use: [
      "Share a link with one line on why it's useful",
      "Tag the type: tool, supplier, article, book, video…",
      "Keep it high-signal — quality over quantity",
    ],
    tip: "Search before posting — the resource you're about to add might already be here.",
  },
};

const SPACE_RULES: string[] = [
  "Be kind and constructive — this is a space for creators helping creators.",
  "Stay on topic for the course this Space belongs to.",
  "Credit references and never share paid course content outside the Academy.",
  "Use the right channel: general, questions, projects, inspiration or resources.",
];

type PostTemplate = { title: string; body: (guideIntro: string) => string };

const CHANNEL_TEMPLATES: Record<string, PostTemplate> = {
  general: {
    title: "Hi from [your name / city]",
    body: (intro) => `> ${intro}\n\nA little about me:\n- Where I'm joining from:\n- What I'm working on right now:\n- What I'd love to learn or share here:\n`,
  },
  questions: {
    title: "Question about [topic]",
    body: (intro) => `> ${intro}\n\nContext (lesson / step I'm on):\n\nMy question:\n\nWhat I've already tried:\n`,
  },
  projects: {
    title: "Project: [name of the project]",
    body: (intro) => `> ${intro}\n\nBrief / goal:\n\nCurrent state (attach photos, plans or a moodboard):\n\nFeedback I'd love:\n- \n- \n\nLinks:\n- \n`,
  },
  inspiration: {
    title: "Inspiration: [theme]",
    body: (intro) => `> ${intro}\n\nWhat caught my eye:\n\nWhy it inspires me / how I'd use it:\n\nSource / credit:\n\nLinks / images:\n- \n`,
  },
  resources: {
    title: "Resource: [name] — [tool / supplier / article / book / video]",
    body: (intro) => `> ${intro}\n\nType: (tool / supplier / article / book / video)\n\nWhy it's useful:\n\nLink:\n`,
  },
};

function useChannelFollows(userId: string | null) {
  return useQuery({
    queryKey: ["channel-follows", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_follows" as never)
        .select("channel_id")
        .eq("user_id", userId!);
      if (error) throw error;
      return new Set<number>(((data as Array<{ channel_id: number }>) ?? []).map((r) => Number(r.channel_id)));
    },
  });
}

function useToggleChannelFollow(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, follow }: { channelId: number; follow: boolean }) => {
      if (!userId) throw new Error("Sign in to follow channels");
      if (follow) {
        const { error } = await supabase
          .from("channel_follows" as never)
          .insert({ user_id: userId, channel_id: channelId } as never);
        if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("channel_follows" as never)
          .delete()
          .eq("user_id", userId)
          .eq("channel_id", channelId);
        if (error) throw error;
      }
      return { channelId, follow };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channel-follows", userId] });
    },
  });
}

type FilterMode = "all" | "pinned" | "mine" | "hidden";
type SortMode = "new" | "top";

const REPORT_REASONS = [
  "Spam or advertising",
  "Harassment or hate",
  "Off-topic",
  "Inappropriate content",
  "Misinformation",
  "Other",
];

function useReportPost(userId: string | null) {
  return useMutation({
    mutationFn: async ({ postId, reason, details }: { postId: number; reason: string; details?: string }) => {
      if (!userId) throw new Error("Sign in to report");
      const { error } = await supabase
        .from("post_reports" as never)
        .insert({ post_id: postId, reporter_id: userId, reason, details: details ?? null } as never);
      if (error) throw error;
    },
  });
}

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

/**
 * Clickable wrapper around the avatar + author name that opens the member's
 * public bio card. Rendered inline inside `.aa-community-post-author` so it
 * inherits existing styling.
 */
function AuthorButton({
  profile,
  own,
  onOpen,
  meta,
}: {
  profile?: CommunityAuthorProfile;
  own: boolean;
  onOpen: (profile: CommunityAuthorProfile | undefined, fallbackName: string) => void;
  meta: string;
}) {
  const name = profileName(profile, own);
  return (
    <button
      type="button"
      className="aa-community-author-btn"
      onClick={() => onOpen(profile, name)}
      aria-label={`View ${name}'s profile`}
    >
      <ProfileMark profile={profile} own={own} />
      <div>
        <strong>{name}</strong>
        <span>{meta}</span>
      </div>
    </button>
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
  const [sortMode, setSortMode] = useState<SortMode>("new");
  const [reportOpen, setReportOpen] = useState<CommunityPost | null>(null);
  const reportPost = useReportPost(userId);
  const [memberDialog, setMemberDialog] = useState<{ profile?: CommunityAuthorProfile; fallbackName: string } | null>(null);
  const openMember = (profile: CommunityAuthorProfile | undefined, fallbackName: string) =>
    setMemberDialog({ profile, fallbackName });
  const [draftTitle, setDraftTitle] = useState(initialDraftTitle ?? "");
  const [draftBody, setDraftBody] = useState(initialDraftBody ?? "");
  // Handle→userId mapping accumulated as the composer inserts mentions.
  const [mentionDir, setMentionDir] = useState<Map<string, string>>(new Map());
  const debouncedSearch = useDebouncedValue(search.trim().toLocaleLowerCase(), 300);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const composerBodyRef = useRef<MentionInputHandle | null>(null);
  // House rules: default closed everywhere; CSS hides the wrapper on <1280px anyway.
  // Persisted preference only applies at desktop where the panel is visible.
  const [rulesOpen, setRulesOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = window.localStorage.getItem(RULES_OPEN_KEY);
      if (saved === "1") return true;
    } catch { /* ignore */ }
    return false;
  });
  // Mobile / tablet slide-over nav (spaces rail + channels list)
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    try { window.localStorage.setItem(RULES_OPEN_KEY, rulesOpen ? "1" : "0"); } catch { /* ignore */ }
  }, [rulesOpen]);

  // Per-user hidden channels (client-side only; can be restored anytime)
  const [hiddenChannelIds, setHiddenChannelIds] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(HIDDEN_CHANNELS_KEY);
      const arr = raw ? (JSON.parse(raw) as number[]) : [];
      return new Set(Array.isArray(arr) ? arr.filter((n) => Number.isFinite(n)) : []);
    } catch { return new Set(); }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(HIDDEN_CHANNELS_KEY, JSON.stringify(Array.from(hiddenChannelIds)));
    } catch { /* ignore */ }
  }, [hiddenChannelIds]);
  const [showHiddenList, setShowHiddenList] = useState(false);
  const [channelPendingDelete, setChannelPendingDelete] = useState<ChannelRow | null>(null);

  function toggleChannelHidden(id: number, hide: boolean) {
    setHiddenChannelIds((prev) => {
      const next = new Set(prev);
      if (hide) next.add(id); else next.delete(id);
      return next;
    });
    if (hide && channelId === id) setChannelId(null);
  }

  function focusComposer() {
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    window.setTimeout(() => composerBodyRef.current?.focus?.(), 200);
  }

  const { data: followedChannels } = useChannelFollows(userId);
  const toggleFollow = useToggleChannelFollow(userId);

  function applyTemplateForChannel(slug: string | undefined) {
    if (!slug) return;
    const template = CHANNEL_TEMPLATES[slug];
    const guide = CHANNEL_GUIDES[slug];
    if (!template) return;
    // Do not overwrite if the user already typed something meaningful
    const hasDraft = draftTitle.trim().length > 0 || draftBody.trim().length > 0;
    if (hasDraft) return;
    setDraftTitle(template.title);
    setDraftBody(template.body(guide?.intro ?? ""));
  }

  function startNewPost(nextChannelId: number, slug: string | undefined) {
    setChannelId(nextChannelId);
    window.setTimeout(() => {
      applyTemplateForChannel(slug);
      focusComposer();
    }, 80);
  }

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

  const postScore = useMemo(() => {
    const map = new Map<number, number>();
    for (const post of posts) {
      const reactions = reactionsByPost.get(post.id) ?? [];
      const rx = reactions.reduce((n, r) => n + r.count, 0);
      const rp = replyCounts[post.id] ?? 0;
      map.set(post.id, rx * 2 + rp);
    }
    return map;
  }, [posts, reactionsByPost, replyCounts]);

  const topPostScore = useMemo(() => {
    let best = 0;
    postScore.forEach((v) => { if (v > best) best = v; });
    return best;
  }, [postScore]);

  const visiblePosts = useMemo(() => {
    const filtered = posts.filter((post) => {
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
    if (sortMode === "top") {
      return [...filtered].sort((a, b) => {
        // Keep pinned on top regardless of sort mode
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (postScore.get(b.id) ?? 0) - (postScore.get(a.id) ?? 0);
      });
    }
    return filtered;
  }, [debouncedSearch, filter, isAdmin, posts, userId, sortMode, postScore]);

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

  const navPanels = (
    <>
      <aside className="aa-community-spaces" aria-label="Community spaces">
        <p className="aa-community-rail-label">Spaces</p>
        {spaces.map((space) => (
          <div key={space.id} style={{ position: "relative" }}>
            <button
              type="button"
              className={space.id === spaceId ? "is-active" : ""}
              onClick={() => { setSpaceId(space.id); }}
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
        <Collapsible open={rulesOpen} onOpenChange={setRulesOpen} className="aa-community-rules-wrap">
          <div className="aa-community-rules" aria-label="House rules">
            <CollapsibleTrigger className="aa-community-rules-trigger" aria-label="Toggle house rules">
              <span className="section-label">House rules</span>
              <ChevronDown size={14} aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul>
                {SPACE_RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </CollapsibleContent>
          </div>
        </Collapsible>
        <ScrollArea className="flex-1">
          <nav aria-label="Community channels">
            {channelsLoading && <p className="aa-community-muted">Loading channels…</p>}
            {!channelsLoading && channels.length === 0 && <p className="aa-community-muted">No channels published.</p>}
            {channels.filter((c) => !hiddenChannelIds.has(c.id)).map((channel) => {
              const unread = unreadByChannel[channel.id] ?? 0;
              const isActive = channel.id === channelId;
              const purpose = CHANNEL_PURPOSES[channel.slug];
              const isFollowed = followedChannels?.has(channel.id) ?? false;
              return (
                <div key={channel.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  className={`aa-community-channel-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => { setChannelId(channel.id); setNavOpen(false); }}
                  style={{ flex: 1 }}
                  title={purpose ?? channel.description ?? channel.name}
                >
                  <Hash size={14} />
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                    <span style={{ fontWeight: unread && !isActive ? 600 : undefined, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {channel.name}
                      {isFollowed && <Bell size={10} aria-label="Following" style={{ opacity: 0.7 }} />}
                    </span>
                    {purpose && (
                      <span style={{ fontSize: "0.68rem", color: "var(--aa-text-light)", lineHeight: 1.35, whiteSpace: "normal" }}>
                        {purpose}
                      </span>
                    )}
                  </span>
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
                {(userId || isAdmin) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="aa-community-channel-more"
                        aria-label={`More actions for ${channel.name}`}
                        title={`More actions for #${channel.name}`}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[13rem]">
                      <DropdownMenuLabel>#{channel.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => startNewPost(channel.id, channel.slug)}>
                        <Plus size={14} /> Add post
                      </DropdownMenuItem>
                      {userId && (
                        <DropdownMenuItem
                          onSelect={async () => {
                            try {
                              await toggleFollow.mutateAsync({ channelId: channel.id, follow: !isFollowed });
                              toast.success(isFollowed ? `Unfollowed #${channel.name}` : `Following #${channel.name}`);
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Could not update follow");
                            }
                          }}
                        >
                          {isFollowed ? <BellOff size={14} /> : <Bell size={14} />}
                          {isFollowed ? "Unfollow channel" : "Follow channel"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={() => {
                          toggleChannelHidden(channel.id, true);
                          toast.success(`Hidden #${channel.name}. Restore it from "Hidden channels" below.`);
                        }}
                      >
                        <EyeOff size={14} /> Hide channel
                      </DropdownMenuItem>
                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs opacity-70">Admin</DropdownMenuLabel>
                          <DropdownMenuItem
                            onSelect={async () => {
                              const name = window.prompt("Rename channel", channel.name);
                              if (!name || !name.trim() || name.trim() === channel.name) return;
                              try {
                                await updateChannel.mutateAsync({ id: channel.id, patch: { name: name.trim() } });
                                toast.success("Channel updated");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Failed to update channel");
                              }
                            }}
                          >
                            <Pencil size={14} /> Edit channel
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={(event) => {
                              event.preventDefault();
                              setChannelPendingDelete({
                                id: channel.id,
                                name: channel.name,
                                slug: channel.slug,
                                description: channel.description,
                              });
                            }}
                          >
                            <Trash2 size={14} /> Delete channel
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                </div>
              );
            })}
            {(() => {
              const hidden = channels.filter((c) => hiddenChannelIds.has(c.id));
              if (hidden.length === 0) return null;
              return (
                <Collapsible open={showHiddenList} onOpenChange={setShowHiddenList} className="aa-community-hidden-wrap" style={{ marginTop: 8 }}>
                  <CollapsibleTrigger
                    className="aa-community-rules-trigger"
                    aria-label="Toggle hidden channels"
                    style={{ width: "100%" }}
                  >
                    <span className="section-label" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <EyeOff size={12} /> Hidden channels ({hidden.length})
                    </span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
                      {hidden.map((c) => (
                        <li key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
                          <Hash size={12} aria-hidden="true" />
                          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.name}
                          </span>
                          <button
                            type="button"
                            className="aa-community-channel-more"
                            aria-label={`Restore ${c.name}`}
                            title={`Restore #${c.name}`}
                            onClick={() => {
                              toggleChannelHidden(c.id, false);
                              toast.success(`Restored #${c.name}`);
                            }}
                          >
                            <Eye size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              );
            })()}
          </nav>
        </ScrollArea>
        {isAdmin && spaceId && <Button variant="ghost" onClick={() => setChannelDialogOpen(true)}><Plus size={14} /> New channel</Button>}
      </aside>
    </>
  );

  return (
    <section className="aa-community-shell">
      <div className="aa-community-inline-nav" style={{ display: "contents" }}>
        {navPanels}
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="aa-community-nav-sheet" aria-label="Community navigation">
          {navPanels}
        </SheetContent>
      </Sheet>

      <main className="aa-community-main">
        <header className="aa-community-header">
          <button
            type="button"
            className="aa-community-nav-trigger"
            aria-label="Open community navigation"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={18} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="section-label">Member conversation</p>
            <h1>{activeChannel?.name ?? "Select a channel"}</h1>
            {activeChannel?.description && <p>{activeChannel.description}</p>}
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
            <div className="aa-community-filters" aria-label="Sort">
              <ArrowDownUp size={14} />
              {(["new", "top"] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={sortMode === mode ? "is-active" : ""}
                  onClick={() => setSortMode(mode)}
                  title={mode === "top" ? "Most reactions and replies first" : "Newest first"}
                >
                  {mode === "new" ? "Newest" : "Top"}
                </button>
              ))}
            </div>
          </div>
        )}

        <ScrollArea className="aa-community-feed">
          <div className="aa-community-feed-inner">
            {activeChannel && CHANNEL_GUIDES[activeChannel.slug] && (() => {
              const guide = CHANNEL_GUIDES[activeChannel.slug];
              return (
                <aside className="aa-community-guide" aria-label={`Guide for #${activeChannel.name}`}>
                  <div className="aa-community-guide-head">
                    <Pin size={14} />
                    <span className="section-label">Pinned guide</span>
                  </div>
                  <h3>{guide.title}</h3>
                  <p>{guide.intro}</p>
                  <ul>
                    {guide.use.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                  <p className="aa-community-guide-tip">{guide.tip}</p>
                  {userId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        applyTemplateForChannel(activeChannel.slug);
                        focusComposer();
                      }}
                    >
                      <Plus size={14} /> New post in #{activeChannel.name}
                    </Button>
                  )}
                </aside>
              );
            })()}
            {postsQuery.isLoading && <div className="aa-community-loading"><Loader2 className="animate-spin" /></div>}
            {postsQuery.isError && (
              <div className="aa-community-state">
                <p>Could not load posts.</p>
                <Button onClick={() => postsQuery.refetch()}>Try again</Button>
              </div>
            )}
            {!postsQuery.isLoading && !postsQuery.isError && visiblePosts.length === 0 && activeChannel && (
              <div className="aa-community-state aa-community-empty" role="status">
                <div className="aa-community-empty-icon" aria-hidden="true">
                  <MessageCircle size={28} />
                </div>
                <h3 className="aa-community-empty-title">
                  {posts.length ? "No posts match the filters." : `Start the conversation in #${activeChannel.name}`}
                </h3>
                <p className="aa-community-empty-body">
                  {posts.length
                    ? "Try clearing search or filters to see every conversation in this channel."
                    : "Be the first to share an idea, a question, or your progress with the community."}
                </p>
                {posts.length === 0 && userId && (
                  <Button
                    className="aa-community-empty-cta"
                    onClick={() => startNewPost(activeChannel.id, activeChannel.slug)}
                  >
                    <Plus size={15} /> Start a conversation
                  </Button>
                )}
                {posts.length > 0 && (
                  <Button variant="outline" onClick={() => { setSearch(""); setFilter("all"); }}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}

            {visiblePosts.map((post) => {
              const own = post.author_id === userId;
              const profile = profileMap.get(post.author_id);
              const reactions = reactionsByPost.get(post.id) ?? [];
              const score = postScore.get(post.id) ?? 0;
              const isTop = sortMode === "top" && score > 0 && score === topPostScore;
              return (
                <article key={post.id} className={`aa-community-post ${post.pinned ? "is-pinned" : ""} ${post.hidden_at ? "is-hidden" : ""} ${isTop ? "is-top" : ""}`}>
                  <div className="aa-community-post-author">
                    <AuthorButton
                      profile={profile}
                      own={own}
                      onOpen={openMember}
                      meta={`${relativeTime(post.created_at)}${own ? " · you" : ""}`}
                    />
                    <div className="aa-community-post-flags">
                      {post.pinned && <span><Pin size={12} /> Pinned</span>}
                      {post.locked && <span><Lock size={12} /> Closed</span>}
                      {post.hidden_at && <span><EyeOff size={12} /> Hidden</span>}
                      {isTop && <span title="Best post in this channel"><Award size={12} /> Top post</span>}
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
                  {userId && !own && !post.hidden_at && (
                    <div className="aa-community-report-row">
                      <button
                        type="button"
                        className="aa-community-report-btn"
                        onClick={() => setReportOpen(post)}
                        title="Report this post"
                      >
                        <Flag size={12} /> Report
                      </button>
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
          <footer className="aa-community-composer" ref={composerRef}>
            <div>
              <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Post title" maxLength={140} />
              <MentionInput
                ref={composerBodyRef}
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

      <MemberProfileDialog
        open={!!memberDialog}
        onOpenChange={(next) => { if (!next) setMemberDialog(null); }}
        profile={memberDialog?.profile ?? null}
        fallbackName={memberDialog?.fallbackName ?? "Academy member"}
      />

      <CreateSpaceDialog open={spaceDialogOpen} onOpenChange={setSpaceDialogOpen} />
      <CreateChannelDialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen} spaceId={spaceId} />

      <AlertDialog
        open={!!channelPendingDelete}
        onOpenChange={(open) => { if (!open) setChannelPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete #{channelPendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This channel and all of its posts and replies will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                const target = channelPendingDelete;
                if (!target) return;
                try {
                  await deleteChannel.mutateAsync(target.id);
                  if (channelId === target.id) setChannelId(null);
                  toast.success(`Deleted #${target.name}`);
                  setChannelPendingDelete(null);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to delete channel");
                }
              }}
            >
              Delete channel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!reportOpen} onOpenChange={(open) => !open && setReportOpen(null)}>
        <SheetContent side="right" className="aa-community-thread">
          <SheetHeader>
            <SheetTitle>Report post</SheetTitle>
          </SheetHeader>
          {reportOpen && (
            <ReportForm
              post={reportOpen}
              submitting={reportPost.isPending}
              onCancel={() => setReportOpen(null)}
              onSubmit={async ({ reason, details }) => {
                try {
                  await reportPost.mutateAsync({ postId: reportOpen.id, reason, details });
                  toast.success("Thanks — the moderation team was notified.");
                  setReportOpen(null);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not send report");
                }
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function ReportForm({
  post,
  submitting,
  onSubmit,
  onCancel,
}: {
  post: CommunityPost;
  submitting: boolean;
  onSubmit: (v: { reason: string; details: string }) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState<string>("");
  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 13, color: "var(--aa-text-light)" }}>
        Reporting: <strong>{post.title || post.body.slice(0, 60)}</strong>
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600 }}>
        Reason
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 6, background: "var(--background)" }}
        >
          {REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600 }}>
        Additional context (optional)
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Anything the moderation team should know…"
          style={{ padding: 8, border: "1px solid var(--border)", borderRadius: 6, background: "var(--background)", fontFamily: "inherit" }}
        />
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button onClick={() => onSubmit({ reason, details: details.trim() })} disabled={submitting}>
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />} Send report
        </Button>
      </div>
    </div>
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
  const [memberDialog, setMemberDialog] = useState<{ profile?: CommunityAuthorProfile; fallbackName: string } | null>(null);
  const openMember = (profile: CommunityAuthorProfile | undefined, fallbackName: string) =>
    setMemberDialog({ profile, fallbackName });
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
                  <AuthorButton
                    profile={profile}
                    own={own}
                    onOpen={openMember}
                    meta={relativeTime(reply.created_at)}
                  />
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

      <MemberProfileDialog
        open={!!memberDialog}
        onOpenChange={(next) => { if (!next) setMemberDialog(null); }}
        profile={memberDialog?.profile ?? null}
        fallbackName={memberDialog?.fallbackName ?? "Academy member"}
      />
    </div>
  );
}
