/**
 * PDF Summary Tool — Fixture Execution Service Tests
 *
 * Verifies every success and failure fixture against the
 * FixtureExecutionService, ensuring the execution contract is stable.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FixtureExecutionService } from "../fixtures/execution.service";
import {
  SUCCESS_FIXTURES,
  FAILURE_FIXTURES,
} from "../fixtures/execution.fixtures";

describe("FixtureExecutionService", () => {
  let service: FixtureExecutionService;

  beforeEach(() => {
    service = new FixtureExecutionService();
  });

  // -----------------------------------------------------------------------
  // Success fixtures
  // -----------------------------------------------------------------------

  describe("success cases", () => {
    SUCCESS_FIXTURES.forEach(({ label, input, expectedOutput }) => {
      it(label, async () => {
        const result = await service.execute(input);

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();

        if (expectedOutput.hasData) {
          expect(result.data).toBeDefined();
        }
      });
    });
  });

  // -----------------------------------------------------------------------
  // Failure fixtures
  // -----------------------------------------------------------------------

  describe("failure cases", () => {
    FAILURE_FIXTURES.forEach(({ label, input, expectedOutput }) => {
      it(label, async () => {
        const result = await service.execute(input);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(expectedOutput.error?.code);
        expect(result.data).toBeUndefined();
      });
    });
  });

  // -----------------------------------------------------------------------
  // Contract invariants
  // -----------------------------------------------------------------------

  describe("contract invariants", () => {
    it("never throws — always returns a structured output", async () => {
      const edgeCases = [
        null,
        undefined,
        {},
        { action: "" },
        { action: 42 },
        "not-an-object",
      ];

      for (const badInput of edgeCases) {
        // eslint-disable-next-line no-await-in-loop
        const result = await service.execute(
          badInput as unknown as Parameters<typeof service.execute>[0],
        );
        expect(result).toHaveProperty("success");
        expect(typeof result.success).toBe("boolean");
      }
    });

    it("returns data XOR error — never both", async () => {
      const allFixtures = [...SUCCESS_FIXTURES, ...FAILURE_FIXTURES];

      for (const { input } of allFixtures) {
        // eslint-disable-next-line no-await-in-loop
        const result = await service.execute(input);

        if (result.success) {
          expect(result.data).toBeDefined();
          expect(result.error).toBeUndefined();
        } else {
          expect(result.error).toBeDefined();
          expect(result.data).toBeUndefined();
        }
      }
    });
  });
});
