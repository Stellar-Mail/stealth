import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

import { BetaControlService } from "@/server/api/beta-controls/service";
import { setBetaControlServiceForTests } from "@/server/api/beta-controls";
import { BETA_CAPABILITIES, type BetaCapability } from "@/server/api/beta-controls/types";
import type { BetaControlConfig } from "@/config/schema";
import { Route as KillswitchesRoute } from "@/routes/api/v1/admin/beta/killswitches/index";
import { Route as StateRoute } from "@/routes/api/v1/beta/state";
import { Route as AttachmentsRoute } from "@/routes/api/v1/attachments/initiate";

function defaultConfig(): BetaControlConfig {
  const killSwitchDefaults = Object.fromEntries(
    BETA_CAPABILITIES.map((c) => [c, "open"]),
  ) as Record<BetaCapability, "open" | "closed">;
  return { controlTtlSeconds: 5, killSwitchDefaults, featureFlagDefaults: {} };
}

const ADMIN = "GADMIN77777777777777777777777777777777777777777777777777";
const BETA_USER = "GUSER555555555555555555555555555555555555555555555555555";

const killswitchPost = (KillswitchesRoute.options as any).server?.handlers?.POST;
const stateGet = (StateRoute.options as any).server?.handlers?.GET;
const attachmentsPost = (AttachmentsRoute.options as any).server?.handlers?.POST;

function adminClose(capability: BetaCapability, reason: string) {
  return killswitchPost({
    request: new Request("http://localhost/api/v1/admin/beta/killswitches", {
      method: "POST",
      headers: { "x-stealth-address": ADMIN, "content-type": "application/json" },
      body: JSON.stringify({ capability, state: "closed", reason }),
    }),
  });
}
function adminOpen(capability: BetaCapability, reason: string) {
  return killswitchPost({
    request: new Request("http://localhost/api/v1/admin/beta/killswitches", {
      method: "POST",
      headers: { "x-stealth-address": ADMIN, "content-type": "application/json" },
      body: JSON.stringify({ capability, state: "open", reason }),
    }),
  });
}
function betaUserAttempt() {
  return attachmentsPost({
    request: new Request("http://localhost/api/v1/attachments/initiate", {
      method: "POST",
      headers: { "x-stealth-address": BETA_USER, "content-type": "application/json" },
      body: JSON.stringify({ message_id: "a".repeat(64), attachments: [] }),
    }),
  });
}

describe("BETA-095 operator / security-tester / beta-user journeys (evidence)", () => {
  beforeEach(() => {
    setBetaControlServiceForTests(new BetaControlService({ config: defaultConfig() }));
  });

  it("completes operator incident -> denial -> recovery -> rollback with redacted evidence", async () => {
    const evidence: any = {
      task: "BETA-095",
      generatedAt: new Date().toISOString(),
      identifiers: {},
      journeys: {},
    };

    // --- Identifiers (versions / manifest) ---
    try {
      evidence.identifiers.packageVersion = JSON.parse(
        execSync("node -e \"console.log(require('./package.json').version)\"").toString(),
      );
    } catch {
      evidence.identifiers.packageVersion = "unknown";
    }
    try {
      evidence.identifiers.gitCommit = execSync("git rev-parse --short HEAD").toString().trim();
    } catch {
      evidence.identifiers.gitCommit = "unknown";
    }
    evidence.identifiers.controlConfig = defaultConfig();

    // --- Operator journey: close attachments during an incident ---
    const operatorClose = await adminClose("attachments", "P1: attachment abuse suspected");
    expect(operatorClose.status).toBe(200);
    evidence.journeys.operator = { closedAttachments: operatorClose.status };

    // Security-tester journey: read-only state shows the switch disabled, no secrets.
    const secRes = await stateGet({
      request: new Request("http://localhost/api/v1/beta/state", { method: "GET" }),
    });
    const secBody = (await secRes.json()) as any;
    const attachmentsState = secBody.data.killSwitches.find(
      (k: any) => k.capability === "attachments",
    );
    expect(attachmentsState.enabled).toBe(false);
    evidence.journeys.securityTester = { observedAttachmentDisabled: !attachmentsState.enabled };

    // --- Beta-user journey: attempt is denied (503) ---
    const denied = await betaUserAttempt();
    expect(denied.status).toBe(503);
    const deniedBody = (await denied.json()) as any;
    expect(deniedBody.error.code).toBe("beta_capability_disabled");
    evidence.journeys.betaUser = { denialStatus: denied.status, denialCode: deniedBody.error.code };

    // --- Recovery: operator reopens ---
    const reopen = await adminOpen("attachments", "mitigated: abuse contained");
    expect(reopen.status).toBe(200);
    const retry = await betaUserAttempt();
    expect(retry.status).not.toBe(503);
    evidence.journeys.recovery = { reopened: reopen.status, retryStatus: retry.status };

    // --- Rollback: operator closes again (fail-safe during uncertainty) ---
    const rollback = await adminClose("attachments", "rollback: re-evaluate");
    expect(rollback.status).toBe(200);
    const stillDenied = await betaUserAttempt();
    expect(stillDenied.status).toBe(503);
    evidence.journeys.rollback = { closedAgain: rollback.status, denialStatus: stillDenied.status };

    // --- Redaction proof: evidence contains no secret material ---
    const serialized = JSON.stringify(evidence);
    const secretPattern = /(password|secret|token|seed|privatekey|api[_-]?key|cursorsecret)/i;
    expect(serialized).not.toMatch(secretPattern);
    expect(serialized).not.toMatch(/G[A-Z0-9]{55,}/); // no raw Stellar secret keys / leaked seeds

    const outDir = "scripts/beta";
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(`${outDir}/beta-controls-evidence.json`, JSON.stringify(evidence, null, 2));
  });
});
