import { useSearchParams } from "react-router-dom";
import MemberLayout from "@/manus/components/MemberLayout";
import CommunityCenter from "@/manus/components/community/CommunityCenter";

export default function Community() {
  const [params] = useSearchParams();
  return (
    <MemberLayout>
      <CommunityCenter
        initialChannelSlug={params.get("channel") ?? undefined}
        initialDraftTitle={params.get("title") ?? undefined}
        initialDraftBody={params.get("body") ?? undefined}
      />
    </MemberLayout>
  );
}
