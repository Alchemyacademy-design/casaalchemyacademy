/**
 * Cross-tab React-Query invalidation bridge.
 *
 * Why this exists:
 * - `lesson_progress` is not yet on the Realtime publication, and adding it
 *   would require a schema/migration change that is out of scope for Phase 1.
 * - When a learner marks a lesson complete in one tab, sibling tabs should
 *   reflect the new progress without requiring a manual refresh.
 *
 * What we transmit:
 * - ONLY an event name and a list of React-Query keys to invalidate.
 * - We do not transmit user content, tokens, lesson payloads or anything else.
 *
 * Transport:
 * - Primary: BroadcastChannel (modern browsers, same-origin).
 * - Fallback: `localStorage` storage events (Safari private mode, very old
 *   browsers). The fallback writes a short-lived sentinel and immediately
 *   removes it so quota is never consumed.
 *
 * Loop protection:
 * - Each tab tags messages with a randomly generated `sourceId`. Messages
 *   originating from the current tab are ignored.
 */
import { useEffect } from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const CROSS_TAB_CHANNEL = "alchemy-academy:queries";
const STORAGE_KEY = "__alchemy_cross_tab_query__";

export type CrossTabEvent =
  | "lesson_progress.updated"
  | "membership.updated"
  | "entitlement.updated";

export interface CrossTabPayload {
  event: CrossTabEvent;
  /** React-Query keys (read-only — never includes data). */
  queryKeys: ReadonlyArray<QueryKey>;
  /** UUID of the publishing tab. Used for loop protection. */
  sourceId: string;
}

/* ------------------------------------------------------------------ */
/* Source id                                                           */
/* ------------------------------------------------------------------ */

let cachedSourceId: string | null = null;
export function getSourceId(): string {
  if (cachedSourceId) return cachedSourceId;
  const uuid =
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  cachedSourceId = uuid;
  return uuid;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function isCrossTabPayload(value: unknown): value is CrossTabPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.event !== "string") return false;
  if (typeof v.sourceId !== "string") return false;
  if (!Array.isArray(v.queryKeys)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Transports                                                          */
/* ------------------------------------------------------------------ */

type Cleanup = () => void;

function hasBroadcastChannel(): boolean {
  return typeof globalThis !== "undefined" && typeof (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel === "function";
}

function publishViaBroadcast(payload: CrossTabPayload): boolean {
  if (!hasBroadcastChannel()) return false;
  try {
    const ch = new BroadcastChannel(CROSS_TAB_CHANNEL);
    ch.postMessage(payload);
    ch.close();
    return true;
  } catch {
    return false;
  }
}

function publishViaStorage(payload: CrossTabPayload): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const wire = JSON.stringify({ ...payload, ts: Date.now() });
    window.localStorage.setItem(STORAGE_KEY, wire);
    // Immediately drop so the key never accumulates.
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function publishCrossTabInvalidation(
  event: CrossTabEvent,
  queryKeys: ReadonlyArray<QueryKey>,
): void {
  if (!queryKeys.length) return;
  const payload: CrossTabPayload = { event, queryKeys, sourceId: getSourceId() };
  const ok = publishViaBroadcast(payload);
  if (!ok) publishViaStorage(payload);
}

export interface CrossTabSubscribeOptions {
  /** Invoked for every valid foreign message (already deduped by sourceId). */
  onEvent: (payload: CrossTabPayload) => void;
}

export function subscribeCrossTab(opts: CrossTabSubscribeOptions): Cleanup {
  const sourceId = getSourceId();
  const cleanups: Cleanup[] = [];

  if (hasBroadcastChannel()) {
    const ch = new BroadcastChannel(CROSS_TAB_CHANNEL);
    const onMessage = (ev: MessageEvent) => {
      if (!isCrossTabPayload(ev.data)) return;
      if (ev.data.sourceId === sourceId) return;
      opts.onEvent(ev.data);
    };
    ch.addEventListener("message", onMessage);
    cleanups.push(() => {
      ch.removeEventListener("message", onMessage);
      ch.close();
    });
  }

  if (typeof window !== "undefined" && window.localStorage) {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== STORAGE_KEY || !ev.newValue) return;
      try {
        const parsed = JSON.parse(ev.newValue) as unknown;
        if (!isCrossTabPayload(parsed)) return;
        if (parsed.sourceId === sourceId) return;
        opts.onEvent(parsed);
      } catch {
        /* ignore malformed payloads */
      }
    };
    window.addEventListener("storage", onStorage);
    cleanups.push(() => window.removeEventListener("storage", onStorage));
  }

  return () => {
    for (const c of cleanups) c();
  };
}

/**
 * React hook: subscribes the supplied QueryClient to cross-tab invalidations
 * and unsubscribes on unmount. Foreign messages trigger `invalidateQueries`
 * for each key in the payload. Messages originating in this tab are skipped
 * to prevent loops.
 */
export function useCrossTabQueryInvalidation(client: QueryClient): void {
  useEffect(() => {
    const off = subscribeCrossTab({
      onEvent: (payload) => {
        for (const key of payload.queryKeys) {
          client.invalidateQueries({ queryKey: key });
        }
      },
    });
    return off;
  }, [client]);
}
