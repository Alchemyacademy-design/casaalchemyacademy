import { useSearchParams } from "react-router-dom";
import MemberLayout from "@/manus/components/MemberLayout";
import CommunityPremium from "@/manus/components/community/CommunityPremium";

export default function Community() {
  const [params] = useSearchParams();
  return (
    <MemberLayout>
      <CommunityPremium
        initialSpaceSlug={params.get("space") ?? undefined}
        initialChannelSlug={params.get("channel") ?? undefined}
        initialDraftTitle={params.get("title") ?? undefined}
        initialDraftBody={params.get("body") ?? undefined}
      />
    </MemberLayout>
  );
}
