import { describe, expect, it } from "vitest";
import {
  ScenarioConflictError,
  ScenarioRegistry,
  createScenarioRegistry,
  type RegistrableScenario,
} from "../scenarioRegistry";

const scenario = (id: string, name = id): RegistrableScenario => ({
  id,
  name,
  description: `Demo scenario ${name}`,
});

describe("ScenarioRegistry", () => {
  describe("registration", () => {
    it("registers scenarios and keeps insertion order", () => {
      const registry = new ScenarioRegistry();
      registry.register(scenario("relay-verification"));
      registry.register(scenario("proof-pending"));

      expect(registry.size).toBe(2);
      expect(registry.ids()).toEqual(["relay-verification", "proof-pending"]);
    });

    it("throws on a duplicate id and stays unchanged", () => {
      const registry = new ScenarioRegistry([scenario("relay-verification")]);

      expect(() => registry.register(scenario("relay-verification"))).toThrow(
        ScenarioConflictError,
      );
      expect(registry.size).toBe(1);
    });

    it("registers many at once and rejects internal duplicates", () => {
      const registry = createScenarioRegistry();

      registry.registerAll([scenario("a"), scenario("b")]);
      expect(registry.ids()).toEqual(["a", "b"]);

      expect(() => registry.registerAll([scenario("c"), scenario("c")])).toThrow(
        ScenarioConflictError,
      );
      expect(registry.has("c")).toBe(false);
    });
  });

  describe("loading", () => {
    it("loads a scenario by id", () => {
      const relay = scenario("relay-verification", "Relay Verification");
      const registry = new ScenarioRegistry([relay]);

      expect(registry.get("relay-verification")).toBe(relay);
      expect(registry.has("relay-verification")).toBe(true);
    });

    it("returns undefined for an unknown id", () => {
      const registry = new ScenarioRegistry();

      expect(registry.get("missing")).toBeUndefined();
      expect(registry.has("missing")).toBe(false);
    });
  });

  describe("conflict detection", () => {
    it("detects ids that clash with existing scenarios", () => {
      const registry = new ScenarioRegistry([scenario("a"), scenario("b")]);

      expect(registry.detectConflicts([scenario("b"), scenario("c")])).toEqual(["b"]);
    });

    it("detects duplicates within the incoming batch", () => {
      const registry = new ScenarioRegistry();

      expect(registry.detectConflicts([scenario("x"), scenario("x"), scenario("y")])).toEqual([
        "x",
      ]);
    });

    it("returns an empty array when there are no conflicts", () => {
      const registry = new ScenarioRegistry([scenario("a")]);

      expect(registry.detectConflicts([scenario("b"), scenario("c")])).toEqual([]);
    });
  });

  describe("merging", () => {
    it("merges non-conflicting scenarios", () => {
      const registry = new ScenarioRegistry([scenario("a")]);

      const conflicts = registry.merge([scenario("b"), scenario("c")]);

      expect(conflicts).toEqual([]);
      expect(registry.ids()).toEqual(["a", "b", "c"]);
    });

    it("throws on conflict by default and changes nothing", () => {
      const registry = new ScenarioRegistry([scenario("a", "Original")]);

      expect(() => registry.merge([scenario("a", "Replacement")])).toThrow(ScenarioConflictError);
      expect(registry.get("a")?.name).toBe("Original");
    });

    it("keeps existing entries with the 'skip' strategy", () => {
      const registry = new ScenarioRegistry([scenario("a", "Original")]);

      const conflicts = registry.merge(
        [scenario("a", "Replacement"), scenario("b", "New")],
        "skip",
      );

      expect(conflicts).toEqual(["a"]);
      expect(registry.get("a")?.name).toBe("Original");
      expect(registry.get("b")?.name).toBe("New");
    });

    it("replaces entries with the 'overwrite' strategy", () => {
      const registry = new ScenarioRegistry([scenario("a", "Original")]);

      const conflicts = registry.merge([scenario("a", "Replacement")], "overwrite");

      expect(conflicts).toEqual(["a"]);
      expect(registry.get("a")?.name).toBe("Replacement");
      expect(registry.size).toBe(1);
    });
  });

  describe("clear", () => {
    it("removes all scenarios", () => {
      const registry = new ScenarioRegistry([scenario("a"), scenario("b")]);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.list()).toEqual([]);
    });
  });
});
