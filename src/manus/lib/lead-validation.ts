// Client mirror of capture-lead's BodySchema rules for name, email and phone,
// plus mapping of a 400 invalid_payload `details` object to a field message.
import { z } from "zod";

export const LEAD_FIELD_MESSAGES = {
  name: "Please enter your name",
  email: "Please check your email address",
  phone: "Please enter your phone number",
} as const;

type LeadField = keyof typeof LEAD_FIELD_MESSAGES;
const ORDER: LeadField[] = ["name", "email", "phone"];

export function validateLeadFields(input: { name: string; email: string; phone: string }): string | null {
  if (input.name.trim().length < 1 || input.name.trim().length > 200) return LEAD_FIELD_MESSAGES.name;
  if (!z.string().trim().email().max(320).safeParse(input.email).success) return LEAD_FIELD_MESSAGES.email;
  const phone = input.phone.trim();
  if (phone.length < 4 || phone.length > 40) return LEAD_FIELD_MESSAGES.phone;
  return null;
}

export function messageFromDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const keys = Object.keys(details as Record<string, unknown>);
  const field = ORDER.find((f) => keys.includes(f));
  return field ? LEAD_FIELD_MESSAGES[field] : null;
}

/** Reads `details` from a supabase.functions.invoke error (FunctionsHttpError) when status is 400. */
export async function fieldMessageFromInvokeError(err: unknown): Promise<string | null> {
  const ctx = (err as { context?: unknown } | null)?.context;
  if (!(ctx instanceof Response) || ctx.status !== 400) return null;
  try {
    const body = await ctx.clone().json();
    return messageFromDetails(body?.details);
  } catch {
    return null;
  }
}
