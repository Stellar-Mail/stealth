import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
const USER = "GUSER222222222222222222222222222222222222222222222222222";

const killswitchGet = (KillswitchesRoute.options as any).server?.handlers?.GET;
const killswitchPost = (KillswitchesRoute.options as any).server?.handlers?.POST;
const stateGet = (StateRoute.options as any).server?.handlers?.GET;
const attachmentsPost = (AttachmentsRoute.options as any).server?.handlers?.POST;

function svc() {
  return new BetaControlService({ config: defaultConfig() });
}

describe("BETA-095 admin beta control routes", () => {
  beforeEach(() => {
    setBetaControlServiceForTests(svc());
  });
  afterEach(() => {
    setBetaControlServiceForTests(undefined);
  });

  it("rejects unauthenticated killswitch reads with 401", async () => {
    const res = await killswitchGet({
      request: new Request("http://localhost/api/v1/admin/beta/killswitches", { method: "GET" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects non-admin killswitch reads with 403", async () => {
    const res = await killswitchGet({
      request: new Request("http://localhost/api/v1/admin/beta/killswitches", {
        method: "GET",
        headers: { "x-stealth-address": USER },
      }),
    });
    expect(res.status).toBe(403);
  });

  it("lists all seven capabilities for an operator", async () => {
    const res = await killswitchGet({
      request: new Request("http://localhost/api/v1/admin/beta/killswitches", {
        method: "GET",
        headers: { "x-stealth-address": ADMIN },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.killSwitches.map((k: any) => k.capability).sort()).toEqual(
      [...BETA_CAPABILITIES].sort(),
    );
  });

  it("requires a reason (audit) on mutation and rejects without it (422)", async () => {
    const res = await killswitchPost({
      request: new Request("http://localhost/api/v1/admin/beta/killswitches", {
        method: "POST",
        headers: { "x-stealth-address": ADMIN, "content-type": "application/json" },
        body: JSON.stringify({ capability: "signup", state: "closed" }),
      }),
    });
    expect(res.status).toBe(422);
  });

  it("lets an operator close a switch and reflects it immediately", async () => {
    const res = await killswitchPost({
      request: new Request("http://localhost/api/v1/admin/beta/killswitches", {
        method: "POST",
        headers: { "x-stealth-address": ADMIN, "content-type": "application/json" },
        body: JSON.stringify({ capability: "signup", state: "closed", reason: "operator action" }),
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.killSwitch.state).toBe("closed");

    const stateRes = await stateGet({
      request: new Request("http://localhost/api/v1/beta/state", { method: "GET" }),
    });
    const stateBody = (await stateRes.json()) as any;
    const signup = stateBody.data.killSwitches.find((k: any) => k.capability === "signup");
    expect(signup.enabled).toBe(false);
  });

  it("rejects a non-admin mutation with 403", async () => {
    const res = await killswitchPost({
      request: new Request("http://localhost/api/v1/admin/beta/killswitches", {
        method: "POST",
        headers: { "x-stealth-address": USER, "content-type": "application/json" },
        body: JSON.stringify({ capability: "signup", state: "closed", reason: "operator action" }),
      }),
    });
    expect(res.status).toBe(403);
  });
});

describe("BETA-095 kill-switch enforcement on the real beta path", () => {
  beforeEach(() => {
    setBetaControlServiceForTests(svc());
  });
  afterEach(() => {
    setBetaControlServiceForTests(undefined);
  });

  it("blocks attachments when the kill switch is closed (503)", async () => {
    // Close the switch via the operator API.
    await killswitchPost({
      request: new Request("http://localhost/api/v1/admin/beta/killswitches", {
        method: "POST",
        headers: { "x-stealth-address": ADMIN, "content-type": "application/json" },
        body: JSON.stringify({ capability: "attachments", state: "closed", reason: "incident" }),
      }),
    });

    const res = await attachmentsPost({
      request: new Request("http://localhost/api/v1/attachments/initiate", {
        method: "POST",
        headers: { "x-stealth-address": USER, "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("beta_capability_disabled");
    expect(body.error.details.capability).toBe("attachments");
  });

  it("allows attachments when the kill switch is open (200 path reached)", async () => {
    const res = await attachmentsPost({
      request: new Request("http://localhost/api/v1/attachments/initiate", {
        method: "POST",
        headers: { "x-stealth-address": USER, "content-type": "application/json" },
        body: JSON.stringify({ message_id: "a".repeat(64), attachments: [] }),
      }),
    });
    // It should proceed past the kill switch (and fail later on body validation, not 503).
    expect(res.status).not.toBe(503);
  });
});

describe("BETA-095 read-only client state exposes no secrets", () => {
  beforeEach(() => {
    setBetaControlServiceForTests(svc());
  });
  afterEach(() => {
    setBetaControlServiceForTests(undefined);
  });

  const SECRET_KEYS = [
    "secret",
    "password",
    "token",
    "seed",
    "privatekey",
    "apikey",
    "cursor",
    "key",
  ];

  function deepScan(obj: unknown): string[] {
    const found: string[] = [];
    const walk = (value: unknown, path: string) => {
      if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) {
          if (SECRET_KEYS.some((s) => k.toLowerCase().includes(s))) found.push(`${path}.${k}`);
          walk(v, `${path}.${k}`);
        }
      }
    };
    walk(obj, "");
    return found;
  }

  it("beta/state response contains no secret-bearing fields", async () => {
    const res = await stateGet({
      request: new Request("http://localhost/api/v1/beta/state", { method: "GET" }),
    });
    const body = (await res.json()) as any;
    const secrets = deepScan(body.data ?? body);
    expect(secrets).toEqual([]);
  });
});
