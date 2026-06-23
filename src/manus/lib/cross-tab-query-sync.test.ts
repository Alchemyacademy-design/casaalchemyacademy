import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CROSS_TAB_CHANNEL,
  getSourceId,
  publishCrossTabInvalidation,
  subscribeCrossTab,
  type CrossTabPayload,
} from "./cross-tab-query-sync";

describe("cross-tab-query-sync", () => {
  beforeEach(() => {
    // Reset cached sourceId between tests so each one can simulate a new tab.
    // The module caches lazily via the getter, so we replace via re-importing
    // is the cleanest path. For these assertions we rely on the live cache.
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("publishes only event + query keys + sourceId; never user data", () => {
    const messages: unknown[] = [];
    const original = (globalThis as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
    class FakeChannel {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      postMessage(payload: unknown) {
        messages.push(payload);
      }
      close() {}
      addEventListener() {}
      removeEventListener() {}
    }
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeChannel as unknown as typeof BroadcastChannel;

    publishCrossTabInvalidation("lesson_progress.updated", [["lessons.progress"]]);

    expect(messages).toHaveLength(1);
    const payload = messages[0] as CrossTabPayload;
    expect(payload.event).toBe("lesson_progress.updated");
    expect(payload.queryKeys).toEqual([["lessons.progress"]]);
    expect(typeof payload.sourceId).toBe("string");
    // No leaked fields.
    expect(Object.keys(payload).sort()).toEqual(["event", "queryKeys", "sourceId"]);

    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = original;
  });

  it("subscribeCrossTab ignores messages from the same tab (loop protection)", () => {
    const sourceId = getSourceId();
    const received: CrossTabPayload[] = [];

    type Listener = (ev: MessageEvent) => void;
    const listeners: Listener[] = [];
    class FakeChannel {
      constructor(public name: string) {}
      postMessage() {}
      close() {}
      addEventListener(_: string, cb: Listener) { listeners.push(cb); }
      removeEventListener(_: string, cb: Listener) {
        const i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      }
    }
    const original = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeChannel as unknown as typeof BroadcastChannel;

    const off = subscribeCrossTab({ onEvent: (p) => received.push(p) });

    const selfMsg = new MessageEvent("message", {
      data: { event: "lesson_progress.updated", queryKeys: [["x"]], sourceId },
    });
    const foreignMsg = new MessageEvent("message", {
      data: { event: "lesson_progress.updated", queryKeys: [["y"]], sourceId: "other-tab" },
    });

    listeners.forEach((l) => l(selfMsg));
    listeners.forEach((l) => l(foreignMsg));

    expect(received).toHaveLength(1);
    expect(received[0].sourceId).toBe("other-tab");

    off();
    listeners.forEach((l) => l(foreignMsg));
    expect(received).toHaveLength(1); // no further events after cleanup
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = original;
  });

  it("ignores malformed payloads", () => {
    const received: CrossTabPayload[] = [];
    type Listener = (ev: MessageEvent) => void;
    const listeners: Listener[] = [];
    class FakeChannel {
      constructor(public name: string) {}
      postMessage() {}
      close() {}
      addEventListener(_: string, cb: Listener) { listeners.push(cb); }
      removeEventListener() {}
    }
    const original = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeChannel as unknown as typeof BroadcastChannel;

    const off = subscribeCrossTab({ onEvent: (p) => received.push(p) });

    listeners.forEach((l) => l(new MessageEvent("message", { data: { foo: "bar" } })));
    listeners.forEach((l) => l(new MessageEvent("message", { data: null })));
    listeners.forEach((l) => l(new MessageEvent("message", { data: "string" })));

    expect(received).toHaveLength(0);
    off();
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = original;
  });

  it("exposes a stable channel name", () => {
    expect(CROSS_TAB_CHANNEL).toBe("alchemy-academy:queries");
  });
});
