import { useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCommunityChannels,
  useCreateLessonDiscussion,
} from "@/manus/lib/lesson-social";

type Props = {
  lessonId: number;
  lessonTitle: string;
  courseId: number | null;
};

export default function StartDiscussionButton({ lessonId, lessonTitle, courseId }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const channelsQuery = useCommunityChannels();
  const create = useCreateLessonDiscussion();

  const channels = useMemo(() => {
    return (channelsQuery.data ?? []).map((c) => {
      const space = Array.isArray(c.community_spaces)
        ? c.community_spaces[0]
        : c.community_spaces;
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        spaceSlug: space?.slug ?? "",
        spaceName: space?.name ?? "",
      };
    });
  }, [channelsQuery.data]);

  useEffect(() => {
    if (open) {
      setTitle(`Discussion: ${lessonTitle}`);
      setBody("");
      if (channels.length && !channelId) {
        const preferred =
          channels.find((c) => c.slug === "questions") ??
          channels.find((c) => c.slug === "general") ??
          channels[0];
        setChannelId(String(preferred.id));
      }
    }
  }, [open, lessonTitle, channels, channelId]);

  const submit = async () => {
    const chId = Number(channelId);
    if (!Number.isFinite(chId) || chId <= 0) {
      toast.error("Pick a channel");
      return;
    }
    try {
      const post = await create.mutateAsync({
        channelId: chId,
        title,
        body,
        lessonId,
        courseId,
      });
      const ch = channels.find((c) => c.id === chId);
      setOpen(false);
      toast.success("Discussion created");
      const params = new URLSearchParams();
      if (ch?.spaceSlug) params.set("space", ch.spaceSlug);
      if (ch?.slug) params.set("channel", ch.slug);
      params.set("post", String(post.id));
      navigate(`/community?${params.toString()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create discussion";
      toast.error(msg);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageSquare className="w-4 h-4 mr-2" /> Discuss in the community
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Start a community discussion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-foreground/60">
                Channel
              </label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a channel" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.spaceName ? `${c.spaceName} · ` : ""}#{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-foreground/60">
                Title
              </label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-foreground/60">
                Message (optional)
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Add context, questions, or your take on this lesson…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={create.isPending || !title.trim() || !channelId}
            >
              {create.isPending ? "Creating…" : "Create discussion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}