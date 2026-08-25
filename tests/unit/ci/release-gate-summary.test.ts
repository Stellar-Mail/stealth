import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  REQUIRED_GATES,
  MISSING_GATE_REASON,
  assembleGates,
  buildReleaseSummary,
  isReleasable,
  overallVerdict,
  sortGates,
} from "../../../scripts/ci/release-gate-lib.mjs";

function passingRequiredGates() {
  return REQUIRED_GATES.map((gateId) => ({
    gateId,
    name: gateId,
    owner: "test",
    dependency: "BETA-088",
    status: "pass",
  }));
}

describe("BETA-088 release-gate summary", () => {
  it("passes only when every required gate exists and passes", () => {
    const items = passingRequiredGates();
    expect(overallVerdict(items)).toBe("pass");
    expect(isReleasable(items)).toBe(true);
  });

  it("treats one missing required gate as fail and not releasable", () => {
    const loaded = passingRequiredGates().filter((g) => g.gateId !== "security");
    const { gates, missingRequiredGates } = assembleGates(loaded);
    expect(missingRequiredGates).toEqual(["security"]);
    expect(gates.find((g) => g.gateId === "security")?.status).toBe("fail");
    expect(gates.find((g) => g.gateId === "security")?.message).toBe(MISSING_GATE_REASON);
    expect(overallVerdict(gates)).toBe("fail");
    expect(isReleasable(gates)).toBe(false);
  });

  it("treats multiple missing required gates as fail", () => {
    const loaded = passingRequiredGates().filter(
      (g) => g.gateId !== "security" && g.gateId !== "provenance",
    );
    const { gates, missingRequiredGates } = assembleGates(loaded);
    expect(missingRequiredGates).toEqual(["security", "provenance"]);
    expect(overallVerdict(gates)).toBe("fail");
    expect(isReleasable(gates)).toBe(false);
  });

  it("returns blocked when a required gate is blocked", () => {
    const items = passingRequiredGates().map((g) =>
      g.gateId === "beta-security" ? { ...g, status: "blocked" } : g,
    );
    expect(overallVerdict(items)).toBe("blocked");
    expect(isReleasable(items)).toBe(false);
  });

  it("returns fail when a required gate failed", () => {
    const items = passingRequiredGates().map((g) =>
      g.gateId === "e2e" ? { ...g, status: "fail" } : g,
    );
    expect(overallVerdict(items)).toBe("fail");
    expect(isReleasable(items)).toBe(false);
  });

  it("never passes an empty result set", () => {
    expect(overallVerdict([])).toBe("fail");
    expect(isReleasable([])).toBe(false);
    const { gates } = assembleGates([]);
    expect(overallVerdict(gates)).toBe("fail");
    expect(gates).toHaveLength(REQUIRED_GATES.length);
  });

  it("does not treat fork-skipped security as releasable", () => {
    const items = passingRequiredGates().map((g) =>
      g.gateId === "security" ? { ...g, status: "skipped" } : g,
    );
    expect(overallVerdict(items, { forkPr: true })).toBe("pass");
    expect(isReleasable(items)).toBe(false);
  });

  it("keeps gate order deterministic for identical inputs", () => {
    const shuffled = [...passingRequiredGates()].reverse();
    const first = sortGates(shuffled).map((g) => g.gateId);
    const second = sortGates(shuffled).map((g) => g.gateId);
    expect(first).toEqual(second);
    expect(first).toEqual([...REQUIRED_GATES]);
  });

  it("writes a stable summary from the CLI for identical gate files", () => {
    const dir = mkdtempSync(join(tmpdir(), "release-gates-"));
    try {
      for (const gate of passingRequiredGates()) {
        writeFileSync(join(dir, `gate-result-${gate.gateId}.json`), JSON.stringify(gate));
      }
      execFileSync(
        process.execPath,
        ["scripts/ci/release-gate-summary.mjs", "--input-dir", dir, "--commit", "abc"],
        { cwd: process.cwd() },
      );
      const summary = JSON.parse(readFileSync(join(dir, "release-gate-summary.json"), "utf-8"));
      expect(summary.verdict).toBe("pass");
      expect(summary.releasable).toBe(true);
      expect(summary.gates.map((g: { gateId: string }) => g.gateId)).toEqual([...REQUIRED_GATES]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds a non-releasable summary when only client-checks is present", () => {
    const summary = buildReleaseSummary({
      loadedGates: [{ gateId: "client-checks", name: "Client Checks", status: "pass", owner: "x" }],
      commit: "deadbeef",
      toolVersions: { bun: "1.3.14" },
      artifactHashes: null,
      generatedAt: "2026-08-24T00:00:00.000Z",
    });
    expect(summary.verdict).toBe("fail");
    expect(summary.releasable).toBe(false);
    expect(summary.missingRequiredGates).toContain("security");
    expect(
      summary.failureOwnership.some((f: { message: string }) => f.message === MISSING_GATE_REASON),
    ).toBe(true);
  });
});
