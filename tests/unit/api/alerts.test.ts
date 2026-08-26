import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { checkApiReadiness, checkDetailedHealth } from "../../../src/server/api/health";
import {
  incrementCounter,
  recordHistogram,
  snapshot,
  reset,
  computeSLOSummary,
  computeAvailabilitySLI,
  computeAuthAvailabilitySLI,
  computeProvisioningSLI,
  computeRelayDeliverySLI,
  computeChainQueueSLI,
  computeStorageAvailabilitySLI,
  computeSyncAvailabilitySLI,
} from "../../../src/server/api/metrics";
import type { ApiRepository } from "../../../src/server/api/repository";

interface ParsedAlert {
  alert: string;
  expr: string;
  forDuration: string;
  severity: string;
  tier: string;
  owner: string;
  summary: string;
  description: string;
  user_impact: string;
  threshold: string;
  deduplication: string;
  silence_rule: string;
  dashboard_url: string;
  runbook_url: string;
}

function cleanVal(str: string): string {
  return str
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function parseAlertsYaml(content: string): ParsedAlert[] {
  const alerts: ParsedAlert[] = [];
  const lines = content.split("\n");

  let current: Partial<ParsedAlert> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- alert:")) {
      if (current && current.alert) {
        alerts.push(current as ParsedAlert);
      }
      current = {
        alert: cleanVal(trimmed.replace("- alert:", "")),
      };
    } else if (current) {
      if (trimmed.startsWith("expr:")) {
        current.expr = cleanVal(trimmed.replace("expr:", ""));
      } else if (trimmed.startsWith("for:")) {
        current.forDuration = cleanVal(trimmed.replace("for:", ""));
      } else if (trimmed.startsWith("severity:")) {
        current.severity = cleanVal(trimmed.replace("severity:", ""));
      } else if (trimmed.startsWith("tier:")) {
        current.tier = cleanVal(trimmed.replace("tier:", ""));
      } else if (trimmed.startsWith("owner:")) {
        current.owner = cleanVal(trimmed.replace("owner:", ""));
      } else if (trimmed.startsWith("summary:")) {
        current.summary = cleanVal(trimmed.replace("summary:", ""));
      } else if (trimmed.startsWith("description:")) {
        current.description = cleanVal(trimmed.replace("description:", ""));
      } else if (trimmed.startsWith("user_impact:")) {
        current.user_impact = cleanVal(trimmed.replace("user_impact:", ""));
      } else if (trimmed.startsWith("threshold:")) {
        current.threshold = cleanVal(trimmed.replace("threshold:", ""));
      } else if (trimmed.startsWith("deduplication:")) {
        current.deduplication = cleanVal(trimmed.replace("deduplication:", ""));
      } else if (trimmed.startsWith("silence_rule:")) {
        current.silence_rule = cleanVal(trimmed.replace("silence_rule:", ""));
      } else if (trimmed.startsWith("dashboard_url:")) {
        current.dashboard_url = cleanVal(trimmed.replace("dashboard_url:", ""));
      } else if (trimmed.startsWith("runbook_url:")) {
        current.runbook_url = cleanVal(trimmed.replace("runbook_url:", ""));
      }
    }
  }

  if (current && current.alert) {
    alerts.push(current as ParsedAlert);
  }

  return alerts;
}

function createRepository(overrides: Partial<ApiRepository> = {}): ApiRepository {
  return {
    getCounter: async () => 0,
    acquireIdempotencyRecord: async () => ({ status: "acquired" }),
    getIdempotencyRecord: async () => null,
    getPolicy: async () => null,
    getPostage: async () => null,
    getReceipt: async () => null,
    createReceiptIfAbsent: async (receipt) => ({ created: true, receipt }),
    markReceiptRead: async () => ({ outcome: "not-found" }),
    getRelayDeadLetterCount: async () => 0,
    getRelayLastFailedDelivery: async () => null,
    getRelayLastSuccessfulDelivery: async () => null,
    getRelayQueueDepth: async () => 0,
    getRelayRetryCount: async () => 0,
    getSenderRule: async () => "default",
    incrementCounter: async () => 1,
    setIdempotencyRecord: async () => undefined,
    setPolicy: async (_owner, policy) => policy,
    setPostage: async (postage) => postage,
    setReceipt: async (receipt) => receipt,
    setSenderRule: async (_owner, _sender, rule) => rule,
    transitionPostage: async () => ({ outcome: "not-found" }),
    ...overrides,
  } as any;
}

function never<T>(): Promise<T> {
  return new Promise(() => undefined);
}

describe("Operational Alerts and Operator Runbooks (BETA-093)", () => {
  beforeEach(() => {
    reset();
  });

  describe("Alerts YAML Configuration & Integrity", () => {
    const yamlPath = resolve(process.cwd(), "docs/deployment/alerts.yaml");
    const alertsMdPath = resolve(process.cwd(), "docs/deployment/ALERTS.md");
    const fileContent = readFileSync(yamlPath, "utf8");
    const alertsMdContent = readFileSync(alertsMdPath, "utf8");
    const alerts = parseAlertsYaml(fileContent);

    it("defines valid alerting rules structure", () => {
      expect(fileContent).toContain("groups:");
      expect(fileContent).toContain("stealth-beta-operational-alerts");
      expect(alerts.length).toBeGreaterThanOrEqual(10);
    });

    const REQUIRED_ALERTS = [
      "StealthAuthAbuseSpike",
      "StealthProvisioningFailureSpike",
      "StealthChainQueueAgeStalled",
      "StealthChainDeadLettersDetected",
      "StealthStorageObjectErrorRate",
      "StealthIndexerGapsDetected",
      "StealthRpcFailuresSpike",
      "StealthPolicyDriftDetected",
      "StealthRelaySendFailureSpike",
      "StealthSloBurnRateCritical",
    ];

    it("contains all 10 required beta failure mode alerts", () => {
      const alertNames = alerts.map((r) => r.alert);

      for (const reqAlert of REQUIRED_ALERTS) {
        expect(alertNames).toContain(reqAlert);
      }
    });

    it("enforces complete required schema on every alert rule", () => {
      for (const rule of alerts) {
        expect(rule.alert).toBeDefined();
        expect(rule.expr).toBeDefined();
        expect(rule.forDuration).toBeDefined();

        // Labels
        expect(["critical", "warning", "info"]).toContain(rule.severity);
        expect(rule.tier).toBeDefined();
        expect(rule.owner).toBeDefined();

        // Annotations
        expect(rule.summary).toBeDefined();
        expect(rule.description).toBeDefined();
        expect(rule.user_impact).toBeDefined();
        expect(rule.threshold).toBeDefined();
        expect(rule.deduplication).toBeDefined();
        expect(rule.silence_rule).toBeDefined();
        expect(rule.dashboard_url).toMatch(/^https?:\/\//);
        expect(rule.runbook_url).toMatch(/^https?:\/\//);

        // Verify runbook anchor exists in ALERTS.md
        const runbookUrl = rule.runbook_url;
        const hashIdx = runbookUrl.indexOf("#");
        if (hashIdx !== -1) {
          const anchor = runbookUrl.slice(hashIdx + 1);
          const hasAnchorOrAlert =
            alertsMdContent.toLowerCase().includes(anchor.toLowerCase()) ||
            alertsMdContent.includes(rule.alert);
          expect(hasAnchorOrAlert).toBe(true);
        }
      }
    });
  });

  describe("Health Readiness & Independent Subsystem Probes", () => {
    it("reports healthy status across all subsystems when all probes respond", async () => {
      const result = await checkDetailedHealth({
        getContext: async () => ({ repository: createRepository() }) as any,
        timeoutMs: 50,
      });

      expect(result.ready).toBe(true);
      expect(result.status).toBe("healthy");
      expect(result.dependencies.bindings).toBe("ok");
      expect(result.dependencies.coordinator).toBe("ok");
      expect(result.dependencies.storage).toBe("ok");
      expect(result.subsystems.relay).toBe("ok");
      expect(result.subsystems.indexer).toBe("ok");
      expect(result.subsystems.queue).toBe("ok");
      expect(result.subsystems.rpc).toBe("ok");
      expect(result.subsystems.policy).toBe("ok");
      expect(result.timestamp).toBeDefined();
    });

    it("reports degraded status and isolates relay failure when relay probe fails", async () => {
      const result = await checkDetailedHealth({
        getContext: async () =>
          ({
            repository: createRepository({
              getRelayQueueDepth: async () => {
                throw new Error("Relay node network timeout");
              },
            }),
          }) as any,
        timeoutMs: 50,
      });

      expect(result.ready).toBe(false);
      expect(result.status).toBe("degraded");
      expect(result.dependencies.storage).toBe("ok");
      expect(result.dependencies.coordinator).toBe("ok");
      expect(result.subsystems.relay).toBe("unavailable");
      expect(result.subsystems.storage).toBe("ok");
    });

    it("reports degraded status and isolates RPC failure when postage probe fails", async () => {
      const result = await checkDetailedHealth({
        getContext: async () =>
          ({
            repository: createRepository({
              getPostage: async () => {
                throw new Error("Soroban RPC node unavailable");
              },
            }),
          }) as any,
        timeoutMs: 50,
      });

      expect(result.ready).toBe(false);
      expect(result.status).toBe("degraded");
      expect(result.subsystems.rpc).toBe("unavailable");
      expect(result.dependencies.storage).toBe("ok");
    });

    it("bounds slow dependency checks with timeouts safely", async () => {
      const result = await checkDetailedHealth({
        getContext: async () =>
          ({
            repository: createRepository({
              getCounter: () => never<number>(),
            }),
          }) as any,
        timeoutMs: 10,
      });

      expect(result.ready).toBe(false);
      expect(result.dependencies.coordinator).toBe("timeout");
    });
  });

  describe("Synthetic Metric Injections & Failure Mode Triggers", () => {
    it("evaluates Auth Abuse Spike conditions on production API metrics", () => {
      // Inject normal traffic on auth routes
      for (let i = 0; i < 90; i++) {
        incrementCounter("api_requests_total", {
          method: "POST",
          path: "/api/v1/auth/session",
          status: "200",
        });
      }
      // Inject 10 401 unauthorized errors
      for (let i = 0; i < 10; i++) {
        incrementCounter("api_requests_total", {
          method: "POST",
          path: "/api/v1/auth/session",
          status: "401",
        });
        incrementCounter("api_errors_total", {
          method: "POST",
          path: "/api/v1/auth/session",
          status: "401",
          error_type: "ERR_UNAUTHORIZED",
        });
      }

      const snap = snapshot();
      let authErrors = 0;
      let authRequests = 0;
      for (const [key, count] of Object.entries(snap.counters)) {
        if (key.startsWith("api_errors_total") && key.includes("/api/v1/auth")) authErrors += count;
        if (key.startsWith("api_requests_total") && key.includes("/api/v1/auth"))
          authRequests += count;
      }
      const authErrorRatio = authErrors / authRequests;
      expect(authErrorRatio).toBe(0.1); // 10% error rate > 5% alert threshold
    });

    it("evaluates RPC Failure Spike and Latency conditions", () => {
      for (let i = 0; i < 98; i++) {
        incrementCounter("api_requests_total", {
          method: "POST",
          path: "/api/v1/postage/quote",
          status: "200",
        });
      }
      for (let i = 0; i < 2; i++) {
        incrementCounter("api_requests_total", {
          method: "POST",
          path: "/api/v1/postage/quote",
          status: "503",
        });
        incrementCounter("api_errors_total", {
          method: "POST",
          path: "/api/v1/postage/quote",
          status: "503",
          error_type: "ERR_RPC_TIMEOUT",
        });
      }

      const snap = snapshot();
      let rpcErrors = 0;
      let totalRequests = 0;
      for (const [key, count] of Object.entries(snap.counters)) {
        if (key.startsWith("api_errors_total") && key.includes("ERR_RPC_TIMEOUT"))
          rpcErrors += count;
        if (key.startsWith("api_requests_total")) totalRequests += count;
      }
      const rpcRatio = rpcErrors / totalRequests;
      expect(rpcRatio).toBe(0.02); // 2% > 1% threshold
    });

    it("evaluates Multi-Window SLO Availability calculation with path exclusion", () => {
      // Add health check requests (excluded)
      for (let i = 0; i < 100; i++) {
        incrementCounter("api_requests_total", {
          method: "GET",
          path: "/api/v1/health",
          status: "200",
        });
      }
      // Add normal user requests
      for (let i = 0; i < 999; i++) {
        incrementCounter("api_requests_total", {
          method: "GET",
          path: "/api/v1/inbox",
          status: "200",
        });
      }
      // Add 1 500 error
      incrementCounter("api_requests_total", {
        method: "GET",
        path: "/api/v1/inbox",
        status: "500",
      });

      const sli = computeAvailabilitySLI();
      expect(sli.denominator).toBe(1000); // Excludes the 100 /api/v1/health requests
      expect(sli.numerator).toBe(999);
      expect(sli.ratio).toBe(0.999);
      expect(sli.met).toBe(true);
    });
  });

  describe("Privacy & Redaction Safeguards", () => {
    it("ensures metrics snapshot contains no private keys, passwords, or seed phrases", () => {
      incrementCounter("api_requests_total", {
        method: "GET",
        path: "/api/v1/inbox",
        status: "200",
      });

      const snap = snapshot();
      const serialized = JSON.stringify(snap);

      expect(serialized).not.toMatch(/S[A-Z0-9]{55}/);
      expect(serialized).not.toContain("password");
      expect(serialized).not.toContain("token");
      expect(serialized).not.toContain("private_key");
    });
  });
});
