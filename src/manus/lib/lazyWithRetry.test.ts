import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadError, __resetLazyRetryFlags, lazyWithRetry } from "./lazyWithRetry";

describe("isChunkLoadError", () => {
  it("matches the common chunk-load failure signatures", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module: /a.js"))).toBe(true);
    expect(isChunkLoadError(new Error("Loading chunk 42 failed"))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error("x"), { name: "ChunkLoadError" }))).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isChunkLoadError(new Error("TypeError: foo is not a function"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe("lazyWithRetry", () => {
  const reloadSpy = vi.fn();
  beforeEach(() => {
    __resetLazyRetryFlags();
    reloadSpy.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });
  });
  afterEach(() => {
    __resetLazyRetryFlags();
  });

  it("resolves a normal import without touching sessionStorage", async () => {
    const factory = vi.fn(async () => ({ default: (() => null) as unknown as React.ComponentType }));
    const Comp = lazyWithRetry(factory, "ok");
    // Access the internal payload by invoking the factory React would call.
    await expect(
      // @ts-expect-error — React lazy internals are not in the public types.
      Comp._payload._result ?? Comp._init?.(Comp._payload),
    ).resolves.toBeDefined();
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("aa:lazy-retry:ok")).toBeNull();
  });

  it("triggers exactly one reload on the first chunk-load failure", async () => {
    const factory = vi.fn(async () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    const Comp = lazyWithRetry(factory, "first");
    // @ts-expect-error — invoke the React lazy thunk directly.
    const init = Comp._init ?? ((p: { _result: () => Promise<unknown> }) => p._result());
    // @ts-expect-error — payload accessor for the test.
    const payload = Comp._payload;
    const p = init(payload);
    // The retry path returns a never-resolving promise; race it.
    const settled = await Promise.race([p, new Promise((r) => setTimeout(() => r("pending"), 20))]);
    expect(settled).toBe("pending");
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("aa:lazy-retry:first")).toBe("1");
  });

  it("rethrows on the second failure to break the reload loop", async () => {
    sessionStorage.setItem("aa:lazy-retry:loop", "1");
    const factory = vi.fn(async () => {
      throw new Error("Loading chunk 7 failed");
    });
    const Comp = lazyWithRetry(factory, "loop");
    // @ts-expect-error — invoke the React lazy thunk directly.
    const init = Comp._init ?? ((p: { _result: () => Promise<unknown> }) => p._result());
    // @ts-expect-error — payload accessor for the test.
    const payload = Comp._payload;
    await expect(init(payload)).rejects.toThrow(/Loading chunk/);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("rethrows unrelated errors without reloading", async () => {
    const factory = vi.fn(async () => {
      throw new TypeError("boom");
    });
    const Comp = lazyWithRetry(factory, "unrelated");
    // @ts-expect-error — invoke the React lazy thunk directly.
    const init = Comp._init ?? ((p: { _result: () => Promise<unknown> }) => p._result());
    // @ts-expect-error — payload accessor for the test.
    const payload = Comp._payload;
    await expect(init(payload)).rejects.toThrow("boom");
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("aa:lazy-retry:unrelated")).toBeNull();
  });
});
