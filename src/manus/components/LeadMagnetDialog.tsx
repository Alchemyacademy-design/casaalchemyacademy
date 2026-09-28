import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { resolveAssetUrl } from "@/manus/lib/asset-url";
import { hasRegisteredForWorkshop, markLeadPopupDismissed, markWorkshopRegistered, shouldShowLeadPopup } from "@/manus/lib/lead-magnet";
import { useAuth } from "@/manus/hooks/useAuth";
import printBanner from "@/assets/how-to-mix-prints-banner.png.asset.json";

type Workshop = {
  id: number;
  slug: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  cover_image_path: string | null;
};

function formatSession(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-AU", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat("en-AU", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(date).replace(/\s?(am|pm)$/i, (part) => part.trim().toLowerCase());
  return `${day}, ${time}`;
}

/** Home-only popup. The public session feed supplies the next published live workshop. */
export default function LeadMagnetDialog({ delayMs = 10000 }: { delayMs?: number }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"intro" | "form" | "confirmed">("intro");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const { data } = useQuery({
    queryKey: ["public", "upcoming_masterclasses"],
    enabled: !isAuthenticated,
    queryFn: async (): Promise<Workshop[]> => {
      const { data, error } = await supabase.rpc("get_public_upcoming_workshops" as never);
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: Number(row.id),
        slug: (row.slug as string | null) ?? null,
        title: String(row.title ?? ""),
        description: (row.description as string | null) ?? null,
        starts_at: String(row.starts_at),
        ends_at: (row.ends_at as string | null) ?? null,
        cover_image_path: (row.cover_image_path as string | null) ?? null,
      }));
    },
  });

  const session = data?.find((item) => Boolean(item.slug) && new Date(item.starts_at).getTime() > Date.now());
  const eligible = !isAuthenticated && session && !hasRegisteredForWorkshop(session.id);

  useEffect(() => {
    if (!eligible || !shouldShowLeadPopup()) return;
    const timer = window.setTimeout(() => {
      if (new Date(session.starts_at).getTime() > Date.now() && !hasRegisteredForWorkshop(session.id)) setOpen(true);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [eligible, session?.id, session?.starts_at, delayMs]);

  useEffect(() => {
    function onOpen() {
      if (eligible && shouldShowLeadPopup() && new Date(session.starts_at).getTime() > Date.now()) setOpen(true);
    }
    window.addEventListener("open-lead-magnet", onOpen);
    return () => window.removeEventListener("open-lead-magnet", onOpen);
  }, [eligible, session?.starts_at]);

  if (!session || ((!eligible && step !== "confirmed") || (!open && !eligible)) || new Date(session.starts_at).getTime() <= Date.now()) return null;

  const printSession = /gabrielle/i.test(session.description ?? "") && /print/i.test(`${session.title} ${session.description}`);
  const heading = printSession ? "How to mix prints with Gabrielle" : session.title.replace(/ [-–—] /g, ": ");
  const cover = printSession ? printBanner.url : resolveAssetUrl(session.cover_image_path);
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const { data: response, error: requestError } = await supabase.functions.invoke("capture-lead", {
        body: {
          name: name.trim(), email: email.trim(), phone: phone.trim(), website,
          source: "live_workshop",
          metadata: { workshop_id: session.id, workshop_slug: session.slug, placement: "ask_the_expert_popup", page_uri: window.location.href },
        },
      });
      if (requestError || !response?.ok) throw requestError ?? new Error("Registration failed");
      markWorkshopRegistered(session.id);
      setStep("confirmed");
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next && step !== "confirmed") markLeadPopupDismissed();
    }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md gap-0 overflow-y-auto rounded-md border-border bg-background p-0 sm:max-w-md">
        {cover && <img src={cover} alt={printSession ? "How to mix prints" : heading} className="aspect-[2.3/1] w-full object-cover" />}
        <div className="space-y-4 p-5 sm:p-7">
          <DialogHeader className="text-left">
            <p className="text-xs font-semibold uppercase text-primary">Ask the Expert LIVE</p>
            <DialogTitle className="font-serif text-2xl font-normal leading-snug text-foreground">{heading}</DialogTitle>
            <DialogDescription className="space-y-1 text-sm text-muted-foreground">
              <span className="block">{formatSession(session.starts_at, "Australia/Sydney")} Sydney time</span>
              {localZone && localZone !== "Australia/Sydney" && <span className="block">Your time: {formatSession(session.starts_at)}</span>}
            </DialogDescription>
          </DialogHeader>
          {step === "intro" && (
            <>
              <p className="text-sm leading-relaxed text-foreground">Free to attend, live on Zoom. Registration required. Members can watch the replay inside the Academy.</p>
              <Button type="button" className="w-full" onClick={() => setStep("form")}>Save your seat</Button>
            </>
          )}
          {step === "form" && (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-sm text-muted-foreground">Your confirmation arrives by email. The private Zoom link follows closer to the session.</p>
              <label className="block text-sm text-foreground">Name<input className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-foreground" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label className="block text-sm text-foreground">Email<input className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-foreground" type="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label className="block text-sm text-foreground">Phone<input className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-foreground" type="tel" required minLength={4} maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-px w-px" value={website} onChange={(event) => setWebsite(event.target.value)} />
              {error && <p role="alert" className="text-sm text-destructive">We couldn't save your seat. Please try again.</p>}
              <Button type="submit" className="w-full" disabled={submitting}>{submitting && <Loader2 className="animate-spin" />}{submitting ? "Saving your seat…" : "Save your seat"}</Button>
            </form>
          )}
          {step === "confirmed" && <div role="status" className="space-y-2 text-sm text-foreground"><p className="flex items-center gap-2 font-serif text-xl"><CheckCircle2 className="text-primary" /> You're in!</p><p>Your seat is confirmed. We've emailed your confirmation. The private class link will be sent closer to the session.</p></div>}
          <Button type="button" variant="link" className="h-auto p-0 text-muted-foreground" onClick={() => setOpen(false)}>{step === "confirmed" ? "Close" : "Maybe later"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}