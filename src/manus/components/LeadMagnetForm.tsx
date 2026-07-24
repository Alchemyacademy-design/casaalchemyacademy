import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { submitLead, type LeadSource } from "@/manus/lib/lead-magnet";
import { useNavigate } from "react-router-dom";

const Schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(200),
  email: z.string().trim().email("Please enter a valid email").max(320),
  phone: z.string().trim().min(4, "Please enter a valid phone").max(40),
});

type Props = {
  source: LeadSource;
  placement?: "popup" | "footer" | "quiz_gate";
  metadata?: Record<string, unknown>;
  ctaLabel?: string;
  redirectTo?: string;
  onSubmitted?: () => void;
  variant?: "light" | "dark";
};

export default function LeadMagnetForm({
  source,
  placement,
  metadata,
  ctaLabel = "Get the Magazine",
  redirectTo,
  onSubmitted,
  variant = "light",
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parse = Schema.safeParse({ name, email, phone });
    if (!parse.success) {
      toast.error(parse.error.issues[0]?.message ?? "Please review the form");
      return;
    }
    setBusy(true);
    try {
      const result = await submitLead({
        name: parse.data.name,
        email: parse.data.email,
        phone: parse.data.phone,
        source,
        metadata: { ...(metadata ?? {}), ...(placement ? { placement } : {}) },
        website,
      });
      toast.success("You're in. Your issue is ready.");
      onSubmitted?.();
      navigate(redirectTo ?? result.redirect ?? "/magazine-download");
    } catch (err) {
      toast.error("Could not submit", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const labelClass = variant === "dark" ? "text-white/80" : "text-foreground/70";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="lm-name" className={`text-xs ${labelClass}`}>Name</Label>
        <Input id="lm-name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div>
        <Label htmlFor="lm-email" className={`text-xs ${labelClass}`}>Email</Label>
        <Input id="lm-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <Label htmlFor="lm-phone" className={`text-xs ${labelClass}`}>Phone</Label>
        <Input id="lm-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
      </div>
      {/* Honeypot: hidden from users, catches bots */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Sending…" : ctaLabel}
      </Button>
      <p className={`text-[11px] ${labelClass}`}>
        By submitting, you agree to receive emails from Casa Alchemy Studio. Unsubscribe any time.
      </p>
    </form>
  );
}