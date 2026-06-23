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

  it("falls back to localStorage when BroadcastChannel is missing", () => {
    const original = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = undefined;
    const setSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    const removeSpy = vi.spyOn(window.localStorage.__proto__, "removeItem");
    publishCrossTabInvalidation("lesson_progress.updated", [["lessons.progress"]]);
    expect(setSpy).toHaveBeenCalledWith("__alchemy_cross_tab_query__", expect.any(String));
    // Sentinel is immediately dropped so the key never accumulates.
    expect(removeSpy).toHaveBeenCalledWith("__alchemy_cross_tab_query__");
    setSpy.mockRestore();
    removeSpy.mockRestore();
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = original;
  });

  it("delivers a valid storage event to the subscriber and ignores own/invalid", () => {
    const received: CrossTabPayload[] = [];
    const off = subscribeCrossTab({ onEvent: (p) => received.push(p) });
    // Foreign valid event
    const foreign = {
      event: "lesson_progress.updated",
      queryKeys: [["lessons.progress"]],
      sourceId: "other-tab",
    };
    window.dispatchEvent(new StorageEvent("storage", {
      key: "__alchemy_cross_tab_query__",
      newValue: JSON.stringify(foreign),
    }));
    expect(received).toHaveLength(1);
    // Invalid JSON
    window.dispatchEvent(new StorageEvent("storage", {
      key: "__alchemy_cross_tab_query__",
      newValue: "not-json",
    }));
    // Own sourceId
    window.dispatchEvent(new StorageEvent("storage", {
      key: "__alchemy_cross_tab_query__",
      newValue: JSON.stringify({ ...foreign, sourceId: getSourceId() }),
    }));
    expect(received).toHaveLength(1);
    off();
  });

  it("cleanup removes both storage and BroadcastChannel listeners", () => {
    let listenerCount = 0;
    type Listener = (ev: MessageEvent) => void;
    class FakeChannel {
      closed = false;
      constructor(public name: string) {}
      postMessage() {}
      close() { this.closed = true; }
      addEventListener(_: string, _cb: Listener) { listenerCount++; }
      removeEventListener(_: string, _cb: Listener) { listenerCount--; }
    }
    const original = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeChannel as unknown as typeof BroadcastChannel;
    const removeStorageSpy = vi.spyOn(window, "removeEventListener");
    const off = subscribeCrossTab({ onEvent: () => {} });
    expect(listenerCount).toBe(1);
    off();
    expect(listenerCount).toBe(0);
    expect(removeStorageSpy).toHaveBeenCalledWith("storage", expect.any(Function));
    removeStorageSpy.mockRestore();
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = original;
  });

  it("useCrossTabQueryInvalidation invalidates the QueryClient for each key", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { useCrossTabQueryInvalidation } = await import("./cross-tab-query-sync");
    const invalidate = vi.fn();
    const client = { invalidateQueries: invalidate } as unknown as import("@tanstack/react-query").QueryClient;
    const { unmount } = renderHook(() => useCrossTabQueryInvalidation(client));
    window.dispatchEvent(new StorageEvent("storage", {
      key: "__alchemy_cross_tab_query__",
      newValue: JSON.stringify({
        event: "lesson_progress.updated",
        queryKeys: [["lessons.progress"], ["progress.moduleProgress"]],
        sourceId: "other-tab",
      }),
    }));
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["lessons.progress"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["progress.moduleProgress"] });
    unmount();
  });
});
