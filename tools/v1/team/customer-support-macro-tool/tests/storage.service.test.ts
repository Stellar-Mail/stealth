/**
 * Customer Support Macro Tool
 * Unit tests: storage.service.ts
 *
 * Tests for the persistence layer — load, save, clear, and the in-memory adapter.
 * No DOM globals needed; the in-memory adapter replaces localStorage entirely.
 */

import { describe, expect, it } from "vitest";
import {
  clearMacros,
  createInMemoryAdapter,
  loadMacros,
  saveMacros,
} from "../services/storage.service";
import { FIXTURE_MACROS } from "../fixtures/macros.fixture";

// ---------------------------------------------------------------------------
// In-memory adapter
// ---------------------------------------------------------------------------

describe("createInMemoryAdapter", () => {
  it("returns null for an unknown key", () => {
    const adapter = createInMemoryAdapter();
    expect(adapter.getItem("missing")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    const adapter = createInMemoryAdapter();
    adapter.setItem("key", "value");
    expect(adapter.getItem("key")).toBe("value");
  });

  it("removes a key", () => {
    const adapter = createInMemoryAdapter();
    adapter.setItem("key", "value");
    adapter.removeItem("key");
    expect(adapter.getItem("key")).toBeNull();
  });

  it("can be pre-seeded with initial data", () => {
    const adapter = createInMemoryAdapter({ preloaded: "data" });
    expect(adapter.getItem("preloaded")).toBe("data");
  });
});

// ---------------------------------------------------------------------------
// loadMacros / saveMacros / clearMacros
// ---------------------------------------------------------------------------

describe("loadMacros", () => {
  it("returns an empty array when storage is empty", () => {
    const adapter = createInMemoryAdapter();
    expect(loadMacros(adapter)).toEqual([]);
  });

  it("returns macros previously saved", () => {
    const adapter = createInMemoryAdapter();
    saveMacros(FIXTURE_MACROS, adapter);
    const loaded = loadMacros(adapter);
    expect(loaded).toHaveLength(FIXTURE_MACROS.length);
    expect(loaded[0].id).toBe(FIXTURE_MACROS[0].id);
  });

  it("returns an empty array when stored data is malformed JSON", () => {
    const adapter = createInMemoryAdapter({
      csmt_macros_v1: "{this is not json",
    });
    expect(loadMacros(adapter)).toEqual([]);
  });

  it("returns an empty array when stored data is not an array", () => {
    const adapter = createInMemoryAdapter({
      csmt_macros_v1: JSON.stringify({ not: "an array" }),
    });
    expect(loadMacros(adapter)).toEqual([]);
  });
});

describe("saveMacros", () => {
  it("persists macros that can be loaded back", () => {
    const adapter = createInMemoryAdapter();
    saveMacros(FIXTURE_MACROS, adapter);
    const loaded = loadMacros(adapter);
    expect(loaded).toHaveLength(FIXTURE_MACROS.length);
  });

  it("overwrites existing data", () => {
    const adapter = createInMemoryAdapter();
    saveMacros(FIXTURE_MACROS, adapter);
    saveMacros([], adapter);
    expect(loadMacros(adapter)).toEqual([]);
  });
});

describe("clearMacros", () => {
  it("removes macros from storage", () => {
    const adapter = createInMemoryAdapter();
    saveMacros(FIXTURE_MACROS, adapter);
    clearMacros(adapter);
    expect(loadMacros(adapter)).toEqual([]);
  });

  it("is a no-op when storage is already empty", () => {
    const adapter = createInMemoryAdapter();
    expect(() => clearMacros(adapter)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Round-trip integrity
// ---------------------------------------------------------------------------

describe("round-trip save/load integrity", () => {
  it("preserves all macro fields after save and load", () => {
    const adapter = createInMemoryAdapter();
    saveMacros(FIXTURE_MACROS, adapter);
    const loaded = loadMacros(adapter);
    for (let i = 0; i < FIXTURE_MACROS.length; i++) {
      expect(loaded[i]).toEqual(FIXTURE_MACROS[i]);
    }
  });
});
