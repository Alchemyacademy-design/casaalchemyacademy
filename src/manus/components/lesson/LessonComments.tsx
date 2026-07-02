import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateLessonComment,
  useLessonComments,
} from "@/manus/lib/lesson-social";
import LessonCommentItem from "./LessonCommentItem";
import { useAuth } from "@/manus/hooks/useAuth";

type Props = {
  lessonId: number;
  courseId: number | null;
};

const COOLDOWN_MS = 3000;

export default function LessonComments({ lessonId, courseId }: Props) {
  const { isAuthenticated } = useAuth();
  const [body, setBody] = useState("");
  const lastSentRef = useRef(0);
  const query = useLessonComments(lessonId);
  const create = useCreateLessonComment(lessonId, courseId);

  const { topLevel, repliesByParent } = useMemo(() => {
    const rows = query.data ?? [];
    const top = rows.filter((r) => r.parent_id == null);
    const byParent = new Map<number, typeof rows>();
    for (const r of rows) {
      if (r.parent_id != null) {
        const arr = byParent.get(r.parent_id) ?? [];
        arr.push(r);
        byParent.set(r.parent_id, arr);
      }
    }
    return { topLevel: top, repliesByParent: byParent };
  }, [query.data]);

  const submit = async () => {
    if (!isAuthenticated) {
      toast.error("Sign in to comment");
      return;
    }
    const now = Date.now();
    if (now - lastSentRef.current < COOLDOWN_MS) {
      toast.info("Please wait a moment before posting again");
      return;
    }
    try {
      await create.mutateAsync({ body });
      lastSentRef.current = now;
      setBody("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not post comment";
      toast.error(msg);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
          Comments
          {query.data && query.data.length > 0 ? (
            <span className="ml-2 text-foreground/50 normal-case tracking-normal">
              ({query.data.length})
            </span>
          ) : null}
        </h3>
      </div>

      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share your thoughts on this lesson…"
          rows={3}
          maxLength={4000}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={create.isPending || !body.trim()}
            onClick={submit}
          >
            {create.isPending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {query.isLoading ? (
          <p className="text-sm text-foreground/60">Loading comments…</p>
        ) : query.error ? (
          <p className="text-sm text-destructive">Failed to load comments.</p>
        ) : topLevel.length === 0 ? (
          <p className="text-sm text-foreground/60">
            No comments yet — be the first to share.
          </p>
        ) : (
          topLevel.map((c) => (
            <LessonCommentItem
              key={c.id}
              comment={c}
              replies={repliesByParent.get(c.id) ?? []}
              lessonId={lessonId}
              courseId={courseId}
            />
          ))
        )}
      </div>
    </Card>
  );
}