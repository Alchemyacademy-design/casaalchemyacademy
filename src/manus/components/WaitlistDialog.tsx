import { useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { submitLead } from "@/manus/lib/lead-magnet";

const Schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(200),
  email: z.string().trim().email("Please enter a valid email").max(320),
});

export type WaitlistPlan = "annual" | "monthly";

const PLAN_LABELS: Record<WaitlistPlan, string> = {
  annual: "Annual Member",
  monthly: "Monthly Member",
};

/**
 * Pre-launch waitlist capture. Opened from the landing-page pricing cards in
 * place of checkout while subscriptions are closed. Stores the email in
 * public.leads (source = "waitlist") via the capture-lead edge function, which
 * also syncs HubSpot and sends a confirmation email.
 */
export default function WaitlistDialog({ plan, onClose }: { plan: WaitlistPlan; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parse = Schema.safeParse({ name, email });
    if (!parse.success) {
      toast.error(parse.error.issues[0]?.message ?? "Please review the form");
      return;
    }
    setBusy(true);
    try {
      await submitLead({
        name: parse.data.name,
        email: parse.data.email,
        phone: "",
        source: "waitlist",
        metadata: {
          plan,
          plan_label: PLAN_LABELS[plan],
          placement: `Pricing — ${PLAN_LABELS[plan]}`,
          page_uri: window.location.href,
        },
        website,
      });
      setDone(true);
    } catch (err) {
      toast.error("Could not join the waitlist", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <div className="py-4 text-center">
            <div className="text-3xl mb-3" aria-hidden="true">✓</div>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-normal">You're on the list.</DialogTitle>
              <DialogDescription>
                Memberships aren't open just yet, but your spot is saved. You'll be the first to know the moment doors open, with early access before we announce it publicly.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={onClose} className="mt-4 w-full">Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl font-normal">Join the waitlist.</DialogTitle>
              <DialogDescription>
                Memberships open soon. Leave your details and you'll be first in line for the <strong>{PLAN_LABELS[plan]}</strong> plan, with early access before the public launch.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <Label htmlFor="wl-name" className="text-xs text-foreground/70">Name</Label>
                <Input id="wl-name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <Label htmlFor="wl-email" className="text-xs text-foreground/70">Email</Label>
                <Input id="wl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              {/* Honeypot: hidden from users, catches bots */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Joining…" : "Join the Waitlist"}
              </Button>
              <p className="text-[11px] text-foreground/70">
                By joining, you agree to receive emails from Casa Alchemy Studio. Unsubscribe any time.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
