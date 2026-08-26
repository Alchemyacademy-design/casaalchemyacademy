import { useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { submitLead } from "@/manus/lib/lead-magnet";

const Schema = z.object({
  firstName: z.string().trim().min(1, "Please enter your first name").max(100),
  lastName: z.string().trim().min(1, "Please enter your last name").max(100),
  email: z.string().trim().email("Please enter a valid email").max(320),
});

export type WaitlistPlan = "annual" | "monthly" | "undecided";

const PLAN_LABELS: Record<WaitlistPlan, string> = {
  annual: "Annual Member",
  monthly: "Monthly Member",
  undecided: "Not sure yet",
};

/**
 * Pre-launch waitlist capture. Opened from the single shared CTA below the
 * landing-page pricing cards while memberships are closed. Stores the lead in
 * public.leads (source = "waitlist") via the capture-lead edge function, which
 * also syncs HubSpot (firstname/lastname as separate contact properties) and
 * sends a confirmation email.
 */
export default function WaitlistDialog({ onClose }: { onClose: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<WaitlistPlan>("undecided");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parse = Schema.safeParse({ firstName, lastName, email });
    if (!parse.success) {
      toast.error(parse.error.issues[0]?.message ?? "Please review the form");
      return;
    }
    setBusy(true);
    try {
      await submitLead({
        name: `${parse.data.firstName} ${parse.data.lastName}`,
        firstName: parse.data.firstName,
        lastName: parse.data.lastName,
        email: parse.data.email,
        phone: "",
        source: "waitlist",
        metadata: {
          plan,
          plan_label: PLAN_LABELS[plan],
          // Only set placement when a concrete plan was chosen, so the HubSpot
          // lead-source label stays "Academy Waitlist" for undecided leads.
          ...(plan !== "undecided" ? { placement: PLAN_LABELS[plan] } : {}),
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

  const planOptions: WaitlistPlan[] = ["annual", "monthly", "undecided"];

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
                Memberships open soon. Leave your details and you'll be first in line, with early access before the public launch.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="wl-first-name" className="text-xs text-foreground/70">First Name</Label>
                  <Input id="wl-first-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                </div>
                <div>
                  <Label htmlFor="wl-last-name" className="text-xs text-foreground/70">Last Name</Label>
                  <Input id="wl-last-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                </div>
              </div>
              <div>
                <Label htmlFor="wl-email" className="text-xs text-foreground/70">Email</Label>
                <Input id="wl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <fieldset>
                <legend className="text-xs text-foreground/70 mb-1.5">Which plan are you interested in?</legend>
                <div className="grid grid-cols-3 gap-2">
                  {planOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPlan(option)}
                      aria-pressed={plan === option}
                      className={`rounded-md border px-2 py-2 text-xs transition-colors ${
                        plan === option
                          ? "border-foreground bg-foreground text-background"
                          : "border-input bg-transparent text-foreground/80 hover:bg-accent"
                      }`}
                    >
                      {PLAN_LABELS[option]}
                    </button>
                  ))}
                </div>
              </fieldset>
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
