import { describe, expect, it, vi } from "vitest";
import { createLocalStorageStore } from "@/features/preferences/storage";

describe("createLocalStorageStore", () => {
  function createMockWindow(initial: Record<string, string> = {}) {
    const store: Record<string, string> = { ...initial };
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

    const localStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
    };

    return {
      localStorage,
      addEventListener: vi.fn((type: string, handler: EventListenerOrEventListenerObject) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(handler);
      }),
      removeEventListener: vi.fn((type: string, handler: EventListenerOrEventListenerObject) => {
        listeners.get(type)?.delete(handler);
      }),
      dispatchStorageEvent: (event: StorageEvent) => {
        listeners.get("storage")?.forEach((handler) => {
          if (typeof handler === "function") handler(event);
          else handler.handleEvent?.(event);
        });
      },
    };
  }

  it("returns the fallback value when localStorage is empty", () => {
    const win = createMockWindow();
    vi.stubGlobal("window", win);
    const store = createLocalStorageStore<Record<string, unknown>>("test-key", { foo: "default" });

    expect(store.getValue()).toEqual({ foo: "default" });
    expect(win.localStorage.getItem).toHaveBeenCalledWith("test-key");

    vi.unstubAllGlobals();
  });

  it("merges stored values with the fallback", () => {
    const win = createMockWindow({ "test-key": JSON.stringify({ foo: "stored" }) });
    vi.stubGlobal("window", win);
    const store = createLocalStorageStore<{ foo: string; bar: string }>("test-key", {
      foo: "default",
      bar: "default",
    });

    expect(store.getValue()).toEqual({ foo: "stored", bar: "default" });

    vi.unstubAllGlobals();
  });

  it("writes values and notifies in-memory subscribers", () => {
    const win = createMockWindow();
    vi.stubGlobal("window", win);
    const store = createLocalStorageStore<{ foo: string }>("test-key", { foo: "default" });

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set({ foo: "updated" });

    expect(win.localStorage.setItem).toHaveBeenCalledWith(
      "test-key",
      JSON.stringify({ foo: "updated" }),
    );
    expect(store.getValue()).toEqual({ foo: "updated" });
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    vi.unstubAllGlobals();
  });

  it("supports function-style updates", () => {
    const win = createMockWindow();
    vi.stubGlobal("window", win);
    const store = createLocalStorageStore<{ foo: string }>("test-key", { foo: "default" });

    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set((prev) => ({ ...prev, foo: "derived" }));

    expect(win.localStorage.setItem).toHaveBeenCalledWith(
      "test-key",
      JSON.stringify({ foo: "derived" }),
    );
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    vi.unstubAllGlobals();
  });

  it("returns a stable snapshot string when the underlying value has not changed", () => {
    const win = createMockWindow({ "test-key": JSON.stringify({ foo: "stable" }) });
    vi.stubGlobal("window", win);
    const store = createLocalStorageStore<{ foo: string }>("test-key", { foo: "default" });

    const first = store.getSnapshot();
    const second = store.getSnapshot();
    expect(second).toBe(first);

    vi.unstubAllGlobals();
  });
});
