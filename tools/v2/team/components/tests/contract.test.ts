/**
 * contract.test.ts — Components (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, resolve by id,
 * prop validation, list, and the edge/error paths (unknown id, unknown prop).
 * No UI is exercised.
 */

import { describe, it, expect } from "vitest";
import { createComponentsContract } from "../contract";
import {
  ComponentErrorCode,
  ok,
  fail,
  type ComponentResult,
  type ComponentContractOutput,
} from "../contract";
import { COMPONENT_DEFINITIONS } from "../fixtures";

function makeContract() {
  return createComponentsContract(COMPONENT_DEFINITIONS);
}

describe("components contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    const r = ok("v");
    expect(r).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(ComponentErrorCode.ComponentNotFound, "missing");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(ComponentErrorCode.ComponentNotFound);
      expect(r.message).toBe("missing");
    }
  });
});

describe("components contract — resolve", () => {
  it("resolves a known component into a descriptor", () => {
    const contract = makeContract();
    const res = contract.execute({ operation: "resolve", input: { id: "button" } });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "resolve") {
      expect(res.value.descriptor.id).toBe("button");
      expect(res.value.descriptor.name).toBe("Button");
      expect(res.value.descriptor.props.label).toBe("string");
    }
  });

  it("reports disabled components (enabled:false)", () => {
    const contract = makeContract();
    const res = contract.execute({ operation: "resolve", input: { id: "legacy-banner" } });
    if (res.ok && res.value.operation === "resolve") {
      expect(res.value.descriptor.enabled).toBe(false);
    }
  });

  it("rejects an unknown component id (no throw)", () => {
    const contract = makeContract();
    const res: ComponentResult<ComponentContractOutput> = contract.execute({
      operation: "resolve",
      input: { id: "does-not-exist" },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ComponentErrorCode.ComponentNotFound);
  });

  it("rejects an unknown prop on a known component (no throw)", () => {
    const contract = makeContract();
    const res: ComponentResult<ComponentContractOutput> = contract.execute({
      operation: "resolve",
      input: { id: "button", props: { notAProp: 1 } },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ComponentErrorCode.InvalidInput);
  });

  it("rejects a missing id (no throw)", () => {
    const contract = makeContract();
    const res: ComponentResult<ComponentContractOutput> = contract.execute({
      operation: "resolve",
      input: { id: "  " },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(ComponentErrorCode.InvalidInput);
  });
});

describe("components contract — list", () => {
  it("lists all registered components", () => {
    const contract = makeContract();
    const res = contract.execute({ operation: "list" });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "list") {
      const ids = res.value.descriptors.map((d) => d.id).sort();
      expect(ids).toEqual(["button", "legacy-banner", "modal"]);
    }
  });
});
