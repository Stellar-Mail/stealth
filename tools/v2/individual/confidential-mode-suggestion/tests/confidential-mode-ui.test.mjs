import test from "node:test";
import assert from "node:assert/strict";

import { analyzeConfidentialMode } from "../services/index.ts";

test("confidential mode analyzer returns the default result shape", () => {
  const result = analyzeConfidentialMode({
    subject: "Project Update",
    body: "Here is the latest project update.",
  });

  assert.equal(result.score, 100);
  assert.equal(result.summary, "No confidential mode recommendations available.");

  assert.ok(Array.isArray(result.suggestions));
  assert.equal(result.suggestions.length, 0);
});
