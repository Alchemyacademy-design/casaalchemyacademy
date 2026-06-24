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

// Helper: invoke the React.lazy thunk that lazyWithRetry returns and return
// the underlying promise the test cares about.
function initLazy(comp: unknown): Promise<unknown> {
  const c = comp as { _payload: { _result?: unknown }; _init?: (p: unknown) => unknown };
  if (typeof c._init === "function") {
    try {
      const out = c._init(c._payload);
      return out instanceof Promise ? out : Promise.resolve(out);
    } catch (e) {
      const thrown = e as Promise<unknown> | Error;
      return thrown instanceof Promise ? thrown : Promise.reject(thrown);
    }
  }
  return Promise.resolve(c._payload._result);
}

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
    const Stub = () => null;
    const factory = vi.fn(async () => ({ default: Stub })) as unknown as () => Promise<{
      default: React.ComponentType<unknown>;
    }>;
    const Comp = lazyWithRetry(factory, "ok");
    const result = await initLazy(Comp);
    expect(result).toBeDefined();
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("aa:lazy-retry:ok")).toBeNull();
  });

  it("triggers exactly one reload on the first chunk-load failure", async () => {
    const factory = (async () => {
      throw new Error("Failed to fetch dynamically imported module");
    }) as unknown as () => Promise<{ default: React.ComponentType<unknown> }>;
    const Comp = lazyWithRetry(factory, "first");
    const settled = await Promise.race([
      initLazy(Comp),
      new Promise((r) => setTimeout(() => r("pending"), 20)),
    ]);
    expect(settled).toBe("pending");
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("aa:lazy-retry:first")).toBe("1");
  });

  it("rethrows on the second failure to break the reload loop", async () => {
    sessionStorage.setItem("aa:lazy-retry:loop", "1");
    const factory = (async () => {
      throw new Error("Loading chunk 7 failed");
    }) as unknown as () => Promise<{ default: React.ComponentType<unknown> }>;
    const Comp = lazyWithRetry(factory, "loop");
    await expect(initLazy(Comp)).rejects.toThrow(/Loading chunk/);
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("rethrows unrelated errors without reloading", async () => {
    const factory = (async () => {
      throw new TypeError("boom");
    }) as unknown as () => Promise<{ default: React.ComponentType<unknown> }>;
    const Comp = lazyWithRetry(factory, "unrelated");
    await expect(initLazy(Comp)).rejects.toThrow("boom");
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("aa:lazy-retry:unrelated")).toBeNull();
  });
});
