// Thin wrappers around the admin edge functions. All authorization decisions
// are taken server-side; these helpers only carry the payload.

import { supabase } from "@/integrations/supabase/client";

type UserAccessAction =
  | "grant_membership"
  | "revoke_membership"
  | "grant_course_entitlement"
  | "revoke_course_entitlement"
  | "promote_admin"
  | "demote_admin";

export interface UserAccessPayload {
  action: UserAccessAction;
  target_user_id: string;
  plan_key?: "monthly_member" | "annual_member";
  course_id?: number;
  starts_at?: string;
  ends_at?: string;
  reason?: string;
  membership_id?: number;
  entitlement_id?: number;
}

export async function manageUserAccess(payload: UserAccessPayload) {
  const { data, error } = await supabase.functions.invoke(
    "admin-manage-user-access",
    { body: payload },
  );
  if (error) throw error;
  if ((data as { error?: string })?.error) {
    throw new Error((data as { error: string }).error);
  }
  return data;
}

type StripeAction =
  | "cancel_at_period_end"
  | "cancel_immediately"
  | "resync_subscription";

export interface StripeActionPayload {
  action: StripeAction;
  target_user_id: string;
  stripe_subscription_id: string;
  confirmation_email?: string;
  reason?: string;
}

export async function manageStripeSubscription(payload: StripeActionPayload) {
  const { data, error } = await supabase.functions.invoke(
    "admin-manage-stripe-subscription",
    { body: payload },
  );
  if (error) throw error;
  if ((data as { error?: string })?.error) {
    throw new Error((data as { error: string }).error);
  }
  return data;
}

export function maskStripeId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}***${id.slice(-4)}`;
}

export const DESIGNATED_ADMIN_EMAIL = "contact@casaalchemystudio.com";

export function isDesignatedAdminEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === DESIGNATED_ADMIN_EMAIL;
}
