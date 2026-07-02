import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, EyeOff, Eye, Trash2, Reply } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import type { LessonCommentRow } from "@/manus/lib/lesson-social";
import {
  useCreateLessonComment,
  useDeleteLessonComment,
  useToggleHideLessonComment,
} from "@/manus/lib/lesson-social";
import { useAuth } from "@/manus/hooks/useAuth";

type Props = {
  comment: LessonCommentRow;
  replies: LessonCommentRow[];
  lessonId: number;
  courseId: number | null;
  allowReplies?: boolean;
};

function displayNameOf(c: LessonCommentRow): string {
  return c.author?.display_name || c.author?.full_name || "Member";
}

function avatarUrlOf(c: LessonCommentRow): string | null {
  const path = c.author?.avatar_path;
  if (!path) return null;
  const { data } = supabase.storage.from("public-assets").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export default function LessonCommentItem({
  comment,
  replies,
  lessonId,
  courseId,
  allowReplies = true,
}: Props) {
  const { user, isAdmin } = useAuth();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const createReply = useCreateLessonComment(lessonId, courseId);
  const del = useDeleteLessonComment(lessonId);
  const toggleHide = useToggleHideLessonComment(lessonId);

  const isOwner = user?.id === comment.user_id;
  const canModerate = isOwner || isAdmin;
  const url = avatarUrlOf(comment);
  const name = displayNameOf(comment);
  const initials = name.slice(0, 1).toUpperCase();
  const when = (() => {
    try {
      return formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
    } catch {
      return "";
    }
  })();

  return (
    <div className={comment.is_hidden ? "opacity-60" : ""}>
      <div className="flex gap-3">
        <Avatar className="w-8 h-8 shrink-0">
          {url ? <AvatarImage src={url} alt={name} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-foreground/50">{when}</span>
            {comment.is_hidden && (
              <span className="text-[10px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded">
                Hidden
              </span>
            )}
            {canModerate && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 px-1 ml-auto">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() =>
                        toggleHide.mutate({ id: comment.id, hide: !comment.is_hidden })
                      }
                    >
                      {comment.is_hidden ? (
                        <>
                          <Eye className="w-4 h-4 mr-2" /> Unhide
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4 mr-2" /> Hide
                        </>
                      )}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      if (confirm("Delete this comment?")) del.mutate(comment.id);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">{comment.body}</p>
          {allowReplies && (
            <div className="mt-2">
              <button
                type="button"
                className="text-xs text-foreground/60 hover:text-foreground inline-flex items-center gap-1"
                onClick={() => setShowReply((v) => !v)}
              >
                <Reply className="w-3 h-3" /> Reply
              </button>
            </div>
          )}
          {showReply && (
            <div className="mt-2 space-y-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply…"
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowReply(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={createReply.isPending || !replyText.trim()}
                  onClick={async () => {
                    try {
                      await createReply.mutateAsync({
                        body: replyText,
                        parentId: comment.id,
                      });
                      setReplyText("");
                      setShowReply(false);
                    } catch {
                      /* handled upstream via toast */
                    }
                  }}
                >
                  Reply
                </Button>
              </div>
            </div>
          )}
          {replies.length > 0 && (
            <div className="mt-4 space-y-4 pl-4 border-l border-border/50">
              {replies.map((r) => (
                <LessonCommentItem
                  key={r.id}
                  comment={r}
                  replies={[]}
                  lessonId={lessonId}
                  courseId={courseId}
                  allowReplies={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}