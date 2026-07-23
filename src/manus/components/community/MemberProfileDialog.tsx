import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { initialsFrom, resolveAvatarUrl } from "@/manus/components/UserAvatar";
import type { CommunityAuthorProfile } from "@/manus/hooks/community/useCommunityPremiumData";
import { Briefcase, MapPin } from "lucide-react";

/**
 * Read-only member card shown when a community avatar/name is clicked.
 * Fed by `get_public_profiles` RPC — never shows email or private prefs.
 */
export default function MemberProfileDialog({
  profile,
  fallbackName,
  open,
  onOpenChange,
}: {
  profile?: CommunityAuthorProfile | null;
  fallbackName: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const name = profile?.display_name || profile?.full_name || fallbackName;
  const url = resolveAvatarUrl(profile?.avatar_path);
  const initials = initialsFrom(name);
  const secondary = profile?.full_name && profile.display_name && profile.full_name !== profile.display_name
    ? profile.full_name
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4">
            {url ? (
              <img src={url} alt="" className="h-16 w-16 rounded-full object-cover border border-[var(--aa-cream-dark)]" />
            ) : (
              <span
                aria-hidden="true"
                className="h-16 w-16 rounded-full flex items-center justify-center text-lg font-medium"
                style={{ background: "var(--aa-cream-dark)", color: "var(--aa-olive-dark)" }}
              >
                {initials}
              </span>
            )}
            <div className="text-left">
              <DialogTitle className="font-serif text-2xl font-normal">{name}</DialogTitle>
              {secondary && <DialogDescription>{secondary}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 text-sm" style={{ color: "var(--aa-text-dark)" }}>
          {(profile?.profession || profile?.region) && (
            <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.12em]" style={{ color: "var(--aa-text-mid)" }}>
              {profile?.profession && (
                <span className="inline-flex items-center gap-1.5"><Briefcase size={13} />{profile.profession}</span>
              )}
              {profile?.region && (
                <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{profile.region}</span>
              )}
            </div>
          )}
          {profile?.bio ? (
            <p className="leading-6 whitespace-pre-wrap">{profile.bio}</p>
          ) : (
            <p className="italic" style={{ color: "var(--aa-text-mid)" }}>
              This member hasn't added a bio yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}