// Admin "View as member" simulator. Persists in sessionStorage so a
// second tab opened by the admin picks up the override immediately.
// The override is honored ONLY when the current user is admin — the
// real entitlement rules always apply to non-admin users.

import { useSyncExternalStore } from "react";

const KEY = "admin_preview_plan_v1";

export type PreviewPlan =
  | "none"           // signed-out visitor
  | "free"           // authenticated, no membership
  | "monthly_member"
  | "annual_member"
  | "individual_course";

export const PREVIEW_PLAN_LABELS: Record<PreviewPlan, string> = {
  none: "Signed-out visitor",
  free: "Free (no membership)",
  monthly_member: "Monthly member",
  annual_member: "Annual member",
  individual_course: "Single-course buyer",
};

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
  try { window.dispatchEvent(new StorageEvent("storage", { key: KEY })); } catch { /* noop */ }
}

function read(): PreviewPlan | null {
  if (typeof window === "undefined") return null;
  const v = window.sessionStorage.getItem(KEY);
  return (v as PreviewPlan | null) ?? null;
}

export function setPreviewPlan(p: PreviewPlan | null) {
  if (typeof window === "undefined") return;
  if (p === null) window.sessionStorage.removeItem(KEY);
  else window.sessionStorage.setItem(KEY, p);
  emit();
}

export function getPreviewPlan(): PreviewPlan | null {
  return read();
}

export function usePreviewPlan(): PreviewPlan | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => { if (!e.key || e.key === KEY) cb(); };
      window.addEventListener("storage", onStorage);
      return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
    },
    () => read(),
    () => null,
  );
}