import { useEffect, useState } from "react";
import { trpc } from "@/manus/lib/trpc";
import { useAuth } from "@/manus/hooks/useAuth";

export type AccessState = "loading" | "guest" | "granted" | "pending" | "none";

export interface AccessStatusInput {
  authLoading: boolean;
  signedIn: boolean;
  statusLoading: boolean;
  accessConfirmed: boolean;
  hasPaidAccess: boolean;
  pollingExhausted: boolean;
}

/**
 * Single source of truth for the message shown after a Stripe checkout
 * outcome. Kept pure so both /payment/success and /payment/cancel render
 * exactly the same vocabulary for the same underlying entitlement state.
 */
export function deriveAccessState(input: AccessStatusInput): AccessState {
  if (input.authLoading) return "loading";
  if (!input.signedIn) return "guest";
  if (input.accessConfirmed || input.hasPaidAccess) return "granted";
  if (input.statusLoading) return "loading";
  return input.pollingExhausted ? "none" : "pending";
}

export const ACCESS_COPY: Record<AccessState, { label: string; tone: "neutral" | "positive" | "pending" }> = {
  loading: { label: "Checking your access…", tone: "neutral" },
  guest: { label: "Sign in to see your access", tone: "pending" },
  granted: { label: "Access released", tone: "positive" },
  pending: { label: "Access pending confirmation", tone: "pending" },
  none: { label: "No active access yet", tone: "neutral" },
};

const MAX_POLLS = 40;

export function useCheckoutAccessStatus(options: { sessionId?: string | null; poll?: boolean } = {}) {
  const { sessionId = null, poll = true } = options;
  const { user, isAdmin, isMember, hasPaidAccess, activeEntitlements, loading: authLoading, refresh: refreshAuth } = useAuth();
  const signedIn = !!user;
  const [attempts, setAttempts] = useState(0);

  const { data: status, isLoading, isFetching, refetch } = trpc.stripe.getPaymentStatus.useQuery(
    { sessionId: sessionId || undefined },
    {
      enabled: signedIn,
      refetchInterval: (query) => {
        if (!poll) return false;
        if (query.state.data?.accessConfirmed) return false;
        return attempts < MAX_POLLS ? 3000 : false;
      },
    },
  );

  useEffect(() => {
    if (!isLoading) setAttempts((n) => n + 1);
  }, [isLoading]);

  const accessConfirmed = Boolean(status?.accessConfirmed);

  // Once Stripe/Supabase confirm, refresh auth entitlements so every CTA on
  // the page reflects the newly granted access without a manual reload.
  useEffect(() => {
    if (accessConfirmed) void refreshAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessConfirmed]);

  const pollingExhausted = !poll || attempts >= MAX_POLLS;
  const state = deriveAccessState({
    authLoading,
    signedIn,
    statusLoading: signedIn && isLoading,
    accessConfirmed,
    hasPaidAccess,
    pollingExhausted,
  });

  const destination = isAdmin || isMember
    ? "/dashboard"
    : activeEntitlements.length > 0 || accessConfirmed
      ? "/mycourses"
      : "/plans";

  return {
    state,
    copy: ACCESS_COPY[state],
    accessConfirmed: state === "granted",
    checkoutStatus: status?.checkoutSession?.status ?? null,
    paymentStatus: status?.checkoutSession?.payment_status ?? null,
    destination: state === "granted" ? destination : null,
    signedIn,
    isChecking: signedIn && (isLoading || isFetching),
    pollingExhausted,
    refresh: async () => {
      setAttempts(0);
      await Promise.all([refetch(), refreshAuth()]);
    },
  };
}
