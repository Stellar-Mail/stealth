/**
 * Cross-Account Intent Isolation Tests (BETA-084 / #1991)
 *
 * Unit-level property tests for the `validateIntent` function in
 * `src/server/api/authorization/intents.ts`.
 *
 * Coverage:
 *   - All 5 intent types with a mismatched actor (all must throw)
 *   - All 5 intent types with the correct actor (all must return true)
 *   - Amount ceiling enforcement for postage intents
 *   - Mainnet refusal for every intent type
 *   - Unknown intent type rejection
 *   - Keys intent with all operation variants (publish, rotate, retire, revoke)
 *
 * Control owner: `src/server/api/authorization/intents.ts` → `validateIntent`
 * Depends on:   BETA-078 (#1985) — authorization layer ✅
 */

import { describe, expect, it } from "vitest";
import { validateIntent } from "../../../../src/server/api/authorization/intents";
import type { BetaRuntimeConfig } from "../../../../src/config/schema";

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

const ALICE = `G${"A".repeat(55)}`;
const BOB = `G${"B".repeat(55)}`;
const CAROL = `G${"C".repeat(55)}`;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TESTNET_CONFIG: BetaRuntimeConfig = {
  network: {
    stellarNetwork: "testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "http://localhost",
  },
  secrets: {
    operatorSecret: `S${"A".repeat(55)}`,
  },
  contracts: {
    policies: `C${"A".repeat(55)}`,
    postage: `C${"B".repeat(55)}`,
    registry: `C${"C".repeat(55)}`,
  },
  environment: "beta",
} as any;

const MAINNET_CONFIG: BetaRuntimeConfig = {
  ...TESTNET_CONFIG,
  network: {
    ...TESTNET_CONFIG.network,
    stellarNetwork: "mainnet",
  },
} as any;

// ===========================================================================
// Tests
// ===========================================================================

describe("Cross-Account Intent Isolation (BETA-084 / #1991)", () => {
  // -------------------------------------------------------------------------
  // Mainnet refusal — all intent types
  // -------------------------------------------------------------------------

  describe("Mainnet refusal: validateIntent rejects all intents on mainnet config", () => {
    it.each([
      ["policy", { type: "policy" as const, ownerAddress: ALICE }],
      ["lifecycle", { type: "lifecycle" as const, userAddress: ALICE }],
      ["receipt", { type: "receipt" as const, recipientAddress: ALICE }],
      [
        "keys/publish",
        { type: "keys" as const, ownerAddress: ALICE, operation: "publish" as const },
      ],
      ["keys/rotate", { type: "keys" as const, ownerAddress: ALICE, operation: "rotate" as const }],
      ["keys/retire", { type: "keys" as const, ownerAddress: ALICE, operation: "retire" as const }],
      ["keys/revoke", { type: "keys" as const, ownerAddress: ALICE, operation: "revoke" as const }],
      ["postage", { type: "postage" as const, senderAddress: ALICE, amountStroops: "100" }],
    ])("rejects '%s' intent on mainnet regardless of actor match", (_label, intent) => {
      expect(() => validateIntent(intent, ALICE, MAINNET_CONFIG)).toThrow(
        "Refusing to sign mainnet transactions in beta configuration",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Actor mismatch — all 5 intent types (IDOR attack vectors)
  // -------------------------------------------------------------------------

  describe("Actor mismatch: Bob cannot sign any intent type for Alice (all must throw)", () => {
    it("policy intent: Bob cannot sign for Alice's policy", () => {
      expect(() =>
        validateIntent({ type: "policy", ownerAddress: ALICE }, BOB, TESTNET_CONFIG),
      ).toThrow("Actor mismatch");
    });

    it("lifecycle intent: Bob cannot sign for Alice's lifecycle changes", () => {
      expect(() =>
        validateIntent({ type: "lifecycle", userAddress: ALICE }, BOB, TESTNET_CONFIG),
      ).toThrow("Actor mismatch");
    });

    it("receipt intent: Bob cannot sign for Alice's receipt emission", () => {
      expect(() =>
        validateIntent({ type: "receipt", recipientAddress: ALICE }, BOB, TESTNET_CONFIG),
      ).toThrow("Actor mismatch");
    });

    it("postage intent: Bob cannot sign for Alice's postage settlement", () => {
      expect(() =>
        validateIntent(
          { type: "postage", senderAddress: ALICE, amountStroops: "100" },
          BOB,
          TESTNET_CONFIG,
        ),
      ).toThrow("Actor mismatch");
    });

    it("keys/publish intent: Bob cannot sign for Alice's key publication", () => {
      expect(() =>
        validateIntent(
          { type: "keys", ownerAddress: ALICE, operation: "publish" },
          BOB,
          TESTNET_CONFIG,
        ),
      ).toThrow("Actor mismatch");
    });

    it("keys/rotate intent: Bob cannot sign for Alice's key rotation", () => {
      expect(() =>
        validateIntent(
          { type: "keys", ownerAddress: ALICE, operation: "rotate" },
          BOB,
          TESTNET_CONFIG,
        ),
      ).toThrow("Actor mismatch");
    });

    it("keys/retire intent: Bob cannot sign for Alice's key retirement", () => {
      expect(() =>
        validateIntent(
          { type: "keys", ownerAddress: ALICE, operation: "retire" },
          BOB,
          TESTNET_CONFIG,
        ),
      ).toThrow("Actor mismatch");
    });

    it("keys/revoke intent: Bob cannot sign for Alice's key revocation", () => {
      expect(() =>
        validateIntent(
          { type: "keys", ownerAddress: ALICE, operation: "revoke" },
          BOB,
          TESTNET_CONFIG,
        ),
      ).toThrow("Actor mismatch");
    });
  });

  // -------------------------------------------------------------------------
  // Three-party isolation: Carol cannot sign for Alice or Bob
  // -------------------------------------------------------------------------

  describe("Three-party isolation: Carol cannot sign for Alice or Bob", () => {
    it("Carol cannot sign a policy intent for Alice", () => {
      expect(() =>
        validateIntent({ type: "policy", ownerAddress: ALICE }, CAROL, TESTNET_CONFIG),
      ).toThrow("Actor mismatch");
    });

    it("Carol cannot sign a policy intent for Bob", () => {
      expect(() =>
        validateIntent({ type: "policy", ownerAddress: BOB }, CAROL, TESTNET_CONFIG),
      ).toThrow("Actor mismatch");
    });

    it("Carol cannot sign a lifecycle intent for Bob", () => {
      expect(() =>
        validateIntent({ type: "lifecycle", userAddress: BOB }, CAROL, TESTNET_CONFIG),
      ).toThrow("Actor mismatch");
    });

    it("Carol cannot sign a postage intent for Alice's sender address", () => {
      expect(() =>
        validateIntent(
          { type: "postage", senderAddress: ALICE, amountStroops: "500" },
          CAROL,
          TESTNET_CONFIG,
        ),
      ).toThrow("Actor mismatch");
    });
  });

  // -------------------------------------------------------------------------
  // Correct actor — all 5 intent types (baseline: authorized paths)
  // -------------------------------------------------------------------------

  describe("Correct actor: each principal can sign only their own intents (authorized baseline)", () => {
    it("Alice can sign her own policy intent", () => {
      expect(validateIntent({ type: "policy", ownerAddress: ALICE }, ALICE, TESTNET_CONFIG)).toBe(
        true,
      );
    });

    it("Bob can sign his own lifecycle intent", () => {
      expect(validateIntent({ type: "lifecycle", userAddress: BOB }, BOB, TESTNET_CONFIG)).toBe(
        true,
      );
    });

    it("Carol can sign her own receipt intent", () => {
      expect(
        validateIntent({ type: "receipt", recipientAddress: CAROL }, CAROL, TESTNET_CONFIG),
      ).toBe(true);
    });

    it("Alice can sign her own postage intent within ceiling", () => {
      expect(
        validateIntent(
          { type: "postage", senderAddress: ALICE, amountStroops: "100000000" }, // 10 XLM — under ceiling
          ALICE,
          TESTNET_CONFIG,
        ),
      ).toBe(true);
    });

    it("Bob can sign his own keys/publish intent", () => {
      expect(
        validateIntent(
          { type: "keys", ownerAddress: BOB, operation: "publish" },
          BOB,
          TESTNET_CONFIG,
        ),
      ).toBe(true);
    });

    it("Bob can sign his own keys/rotate intent", () => {
      expect(
        validateIntent(
          { type: "keys", ownerAddress: BOB, operation: "rotate" },
          BOB,
          TESTNET_CONFIG,
        ),
      ).toBe(true);
    });

    it("Bob can sign his own keys/retire intent", () => {
      expect(
        validateIntent(
          { type: "keys", ownerAddress: BOB, operation: "retire" },
          BOB,
          TESTNET_CONFIG,
        ),
      ).toBe(true);
    });

    it("Bob can sign his own keys/revoke intent (with keyId)", () => {
      expect(
        validateIntent(
          { type: "keys", ownerAddress: BOB, operation: "revoke", keyId: "key-001" },
          BOB,
          TESTNET_CONFIG,
        ),
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Postage amount ceiling enforcement
  // -------------------------------------------------------------------------

  describe("Postage amount ceiling enforcement (control: intents.ts → 100 XLM max)", () => {
    it.each([
      ["exactly at ceiling (1_000_000_000 stroops = 100 XLM)", "1000000000", true],
      ["1 stroop under ceiling", "999999999", true],
      ["minimum amount (1 stroop)", "1", true],
      ["zero amount", "0", true],
    ])("allows postage amount %s for the correct actor", (_label, amountStroops, shouldPass) => {
      const action = () =>
        validateIntent(
          { type: "postage", senderAddress: ALICE, amountStroops },
          ALICE,
          TESTNET_CONFIG,
        );
      if (shouldPass) {
        expect(action()).toBe(true);
      } else {
        expect(action).toThrow("Postage amount exceeds the maximum allowed ceiling");
      }
    });

    it.each([
      ["1 stroop over ceiling (1_000_000_001 stroops)", "1000000001"],
      ["2× ceiling (2_000_000_000 stroops)", "2000000000"],
      ["very large amount", "9999999999999"],
    ])(
      "rejects postage amount %s — exceeds ceiling even for the correct actor",
      (_label, amountStroops) => {
        expect(() =>
          validateIntent(
            { type: "postage", senderAddress: ALICE, amountStroops },
            ALICE,
            TESTNET_CONFIG,
          ),
        ).toThrow("Postage amount exceeds the maximum allowed ceiling");
      },
    );

    it("Bob cannot exploit the ceiling check to sign a large postage for Alice", () => {
      // Both actor mismatch AND ceiling violation — actor mismatch is checked first
      expect(() =>
        validateIntent(
          { type: "postage", senderAddress: ALICE, amountStroops: "9999999999" },
          BOB,
          TESTNET_CONFIG,
        ),
      ).toThrow("Actor mismatch");
    });
  });

  // -------------------------------------------------------------------------
  // Unknown intent type
  // -------------------------------------------------------------------------

  describe("Unknown intent type rejection", () => {
    it("rejects a completely unknown intent type", () => {
      expect(() => validateIntent({ type: "unknown" } as any, ALICE, TESTNET_CONFIG)).toThrow(
        "Unknown intent type",
      );
    });

    it("rejects an intent with null type field", () => {
      expect(() => validateIntent({ type: null } as any, ALICE, TESTNET_CONFIG)).toThrow(
        "Unknown intent type",
      );
    });

    it("rejects an intent with undefined type field", () => {
      expect(() => validateIntent({} as any, ALICE, TESTNET_CONFIG)).toThrow("Unknown intent type");
    });
  });
});
