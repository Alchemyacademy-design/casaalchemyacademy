import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import LeadMagnetForm from "./LeadMagnetForm";
import { markLeadPopupDismissed, shouldShowLeadPopup } from "@/manus/lib/lead-magnet";
import { useAuth } from "@/manus/hooks/useAuth";

/**
 * Timed lead-magnet pop-up. Appears once per visitor per 7-day window.
 * Suppressed for signed-in users and admins.
 *
 * Trigger delay ~10s after mount; user can also open manually via
 * `window.dispatchEvent(new Event("open-lead-magnet"))`.
 */
export default function LeadMagnetDialog({ delayMs = 10000 }: { delayMs?: number }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) return;
    if (!shouldShowLeadPopup()) return;
    const t = window.setTimeout(() => setOpen(true), delayMs);
    return () => window.clearTimeout(t);
  }, [isAuthenticated, delayMs]);

  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener("open-lead-magnet", onOpen);
    return () => window.removeEventListener("open-lead-magnet", onOpen);
  }, []);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) markLeadPopupDismissed();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal">Consider this your first experiment.</DialogTitle>
          <DialogDescription>
            Subscribe and get our latest issue, free. Real projects, real principles — the professional knowledge you need to design your own home, with confidence.
          </DialogDescription>
        </DialogHeader>
        <LeadMagnetForm source="popup" ctaLabel="Get the Magazine" />
      </DialogContent>
    </Dialog>
  );
}