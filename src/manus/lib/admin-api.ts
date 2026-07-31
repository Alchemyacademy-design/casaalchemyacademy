// Thin wrappers around the admin edge functions. All authorization decisions
// are taken server-side; these helpers only carry the payload.

import { supabase } from "@/integrations/supabase/client";

type UserAccessAction =
  | "grant_membership"
  | "revoke_membership"
  | "grant_course_entitlement"
  | "revoke_course_entitlement"
  | "promote_admin"
  | "demote_admin"
  | "delete_user";

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
  confirmation_email?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Sessão expirada — entre novamente para continuar.",
  forbidden: "Apenas administradores podem executar esta ação.",
  designated_admin_protected: "O administrador principal da plataforma não pode ser removido.",
  cannot_delete_self: "Você não pode excluir a sua própria conta.",
  confirmation_email_mismatch: "O e-mail digitado não confere com o do usuário.",
  target_not_found: "Usuário não encontrado (talvez já tenha sido excluído).",
  delete_failed: "A exclusão falhou no servidor. Tente novamente.",
  invalid_payload: "Dados inválidos enviados para a exclusão.",
};

/** Extracts the JSON error body that `functions.invoke` hides behind a generic error. */
async function readInvokeError(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  if (ctx && typeof (ctx as Response).json === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      const code = (body as { error?: string })?.error;
      const message = (body as { message?: string })?.message;
      if (code) return ERROR_MESSAGES[code] ?? (message ? `${code}: ${message}` : code);
      if (message) return message;
    } catch {
      /* body was not JSON */
    }
  }
  return (error as Error)?.message ?? "Erro desconhecido";
}

export async function deleteUserAccount(targetUserId: string, confirmationEmail: string, reason?: string) {
  return manageUserAccess({
    action: "delete_user",
    target_user_id: targetUserId,
    confirmation_email: confirmationEmail,
    reason,
  });
}

export async function manageUserAccess(payload: UserAccessPayload) {
  const { data, error } = await supabase.functions.invoke(
    "admin-manage-user-access",
    { body: payload },
  );
  if (error) throw new Error(await readInvokeError(error));
  if ((data as { error?: string })?.error) {
    const code = (data as { error: string }).error;
    throw new Error(ERROR_MESSAGES[code] ?? code);
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
