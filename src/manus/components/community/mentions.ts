import { supabase } from "@/integrations/supabase/client";

export type MentionCandidate = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_path: string | null;
};

// Matches @username tokens (letters, digits, underscore, dot, hyphen). We
// intentionally match the *rendered* handle rather than a name-with-spaces —
// picking from the suggestion popover always inserts a handle-safe token.
export const MENTION_TOKEN_RE = /@([a-zA-Z0-9_.-]{2,40})/g;

export function handleFromProfile(p: Pick<MentionCandidate, "display_name" | "full_name" | "id">): string {
  const raw = (p.display_name || p.full_name || p.id.slice(0, 8)).toString();
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]+/g, "")
    .slice(0, 40);
  return slug || p.id.slice(0, 8);
}

export async function searchMembers(term: string): Promise<MentionCandidate[]> {
  const { data, error } = await supabase.rpc("community_search_members", {
    term,
    limit_count: 8,
  });
  if (error) throw error;
  return (data ?? []) as MentionCandidate[];
}

export function extractMentionHandles(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(MENTION_TOKEN_RE)) set.add(m[1].toLowerCase());
  return [...set];
}

// Given a body and a directory of {handle -> userId}, return the userIds
// that were mentioned in the body.
export function resolveMentionUserIds(
  text: string,
  directory: Map<string, string>,
): string[] {
  const ids = new Set<string>();
  for (const handle of extractMentionHandles(text)) {
    const id = directory.get(handle);
    if (id) ids.add(id);
  }
  return [...ids];
}

export async function notifyMentions(input: {
  userIds: string[];
  title: string;
  body: string;
  href: string;
  postId?: number | null;
  replyId?: number | null;
}): Promise<void> {
  if (!input.userIds.length) return;
  const { error } = await supabase.rpc("community_notify_mentions", {
    p_user_ids: input.userIds,
    p_title: input.title,
    p_body: input.body.slice(0, 240),
    p_href: input.href,
    p_post_id: input.postId ?? undefined,
    p_reply_id: input.replyId ?? undefined,
  });
  if (error) throw error;
}