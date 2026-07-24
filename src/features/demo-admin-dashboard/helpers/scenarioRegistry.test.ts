import { describe, expect, it } from "vitest";
import type { Draft } from "../types/draft";
import { createScenarioRegistry, demoScenarios, loadScenarioIntoDraft } from "./scenarioRegistry";

describe("createScenarioRegistry", () => {
  it("lists all provided scenarios", () => {
    const registry = createScenarioRegistry();
    expect(registry.list()).toHaveLength(demoScenarios.length);
  });

  it("looks up scenarios by id", () => {
    const registry = createScenarioRegistry();
    const first = demoScenarios[0];
    expect(registry.get(first.id)?.name).toBe(first.name);
    expect(registry.has(first.id)).toBe(true);
    expect(registry.has("missing")).toBe(false);
  });

  it("keeps the last entry when ids are duplicated", () => {
    const registry = createScenarioRegistry([
      {
        id: "dup",
        name: "First",
        description: "first",
        draft: { id: "d1", subject: "s1", body: "b1", recipients: [] },
      },
      {
        id: "dup",
        name: "Second",
        description: "second",
        draft: { id: "d2", subject: "s2", body: "b2", recipients: [] },
      },
    ]);
    expect(registry.list()).toHaveLength(1);
    expect(registry.get("dup")?.name).toBe("Second");
  });
});

describe("loadScenarioIntoDraft", () => {
  const scenario = {
    id: "scenario-test",
    name: "Test",
    description: "test",
    draft: {
      id: "draft-test",
      subject: "Scenario subject",
      body: "Scenario body",
      recipients: ["new@example.com"],
    },
  };

  it("replaces the current draft when mode is replace", () => {
    const current: Draft = {
      id: "existing",
      subject: "Old",
      body: "Old body",
      recipients: ["old@example.com"],
    };
    const result = loadScenarioIntoDraft(current, scenario, "replace");
    expect(result.id).toBe("draft-test");
    expect(result.recipients).toEqual(["new@example.com"]);
  });

  it("replaces when there is no current draft, even in merge mode", () => {
    const result = loadScenarioIntoDraft(null, scenario, "merge");
    expect(result.id).toBe("draft-test");
  });

  it("merges recipients without duplicates and keeps the current id", () => {
    const current: Draft = {
      id: "existing",
      subject: "Old",
      body: "Old body",
      recipients: ["old@example.com", "new@example.com"],
    };
    const result = loadScenarioIntoDraft(current, scenario, "merge");
    expect(result.id).toBe("existing");
    expect(result.subject).toBe("Scenario subject");
    expect(result.recipients).toEqual(["old@example.com", "new@example.com"]);
  });
});
