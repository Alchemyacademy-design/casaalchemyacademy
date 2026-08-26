import { supabase } from "@/integrations/supabase/client";

const DISMISS_KEY = "casa.leadPopupDismissedAt";
const SUBMIT_KEY = "casa.leadSubmittedAt";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type LeadSource = "popup" | "quiz" | "waitlist";

export interface LeadPayload {
  name: string;
  /** Optional explicit split; when present the edge function uses these for
   *  HubSpot firstname/lastname instead of splitting `name`. */
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  source: LeadSource;
  metadata?: Record<string, unknown>;
  /** Honeypot; leave blank. */
  website?: string;
}

/**
 * Whether the lead-magnet pop-up should be shown to the current visitor.
 * Suppressed if they already submitted or dismissed within the last 7 days.
 */
export function shouldShowLeadPopup(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (const key of [DISMISS_KEY, SUBMIT_KEY]) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const ts = Number(raw);
      if (Number.isFinite(ts) && Date.now() - ts < SEVEN_DAYS_MS) return false;
    }
  } catch {
    // localStorage unavailable — fail open.
  }
  return true;
}

export function markLeadPopupDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch { /* noop */ }
}

export function markLeadSubmitted(): void {
  try {
    window.localStorage.setItem(SUBMIT_KEY, String(Date.now()));
  } catch { /* noop */ }
}

export async function submitLead(payload: LeadPayload): Promise<{ ok: true; redirect: string | null; leadId?: number }> {
  const { data, error } = await supabase.functions.invoke("capture-lead", {
    body: payload,
  });
  if (error) {
    // Try to surface the underlying body.
    let detail = error.message;
    try {
      const ctx = (error as { context?: { text?: () => Promise<string> } }).context;
      const text = await ctx?.text?.();
      if (text) detail = text;
    } catch { /* noop */ }
    throw new Error(detail || "Could not submit lead");
  }
  markLeadSubmitted();
  return data as { ok: true; redirect: string; leadId?: number };
}