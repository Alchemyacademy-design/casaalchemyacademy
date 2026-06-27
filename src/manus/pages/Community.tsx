import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import MemberLayout from "@/manus/components/MemberLayout";
import CommunityPremium from "@/manus/components/community/CommunityPremium";
import { useChannelBySlug } from "@/manus/hooks/community/useCommunityData";

const STORAGE_KEY = "community:last";

function CommunityContent({
  space,
  channel,
  title,
  body,
}: {
  space?: string;
  channel?: string;
  title?: string;
  body?: string;
}) {
  const { data: matchedChannel, isLoading } = useChannelBySlug(channel, space);
  const [selectionReady, setSelectionReady] = useState(!channel);

  useEffect(() => {
    setSelectionReady(!channel);
  }, [channel, space]);

  useEffect(() => {
    if (!channel || isLoading) return;
    if (matchedChannel) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ spaceId: matchedChannel.space_id, channelId: matchedChannel.id }),
        );
      } catch {
        // Storage can be unavailable in privacy modes; the inner resolver still applies the link.
      }
    }
    setSelectionReady(true);
  }, [channel, isLoading, matchedChannel]);

  if (!selectionReady) {
    return (
      <div className="aa-community-loading" aria-label="Carregando conversa">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <CommunityPremium
      initialSpaceSlug={space}
      initialChannelSlug={channel}
      initialDraftTitle={title}
      initialDraftBody={body}
    />
  );
}

export default function Community() {
  const [params] = useSearchParams();
  return (
    <MemberLayout>
      <CommunityContent
        space={params.get("space") ?? undefined}
        channel={params.get("channel") ?? undefined}
        title={params.get("title") ?? undefined}
        body={params.get("body") ?? undefined}
      />
    </MemberLayout>
  );
}
