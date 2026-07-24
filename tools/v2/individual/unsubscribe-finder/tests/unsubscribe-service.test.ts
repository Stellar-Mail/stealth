import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { analyzeUnsubscribeCandidates } from "../index.ts";
import type {
  UnsubscribeFinderFailure,
  UnsubscribeFinderRequest,
  UnsubscribeFinderSuccess,
} from "../types/index.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));
const successFixturePath = join(currentDir, "..", "fixtures", "sample-unsubscribe-candidates.json");
const emptyInputFixturePath = join(
  currentDir,
  "..",
  "fixtures",
  "sample-unsubscribe-empty-input.json",
);
const invalidMessageFixturePath = join(
  currentDir,
  "..",
  "fixtures",
  "sample-unsubscribe-invalid-message.json",
);

async function loadFixture<T>(fixturePath: string): Promise<T> {
  const raw = await readFile(fixturePath, "utf8");
  return JSON.parse(raw) as T;
}

test("analyzeUnsubscribeCandidates returns structured candidates for valid input", async () => {
  const fixture = await loadFixture<{
    tool: "unsubscribe-finder";
    version: 1;
    sourceMessages: UnsubscribeFinderRequest["sourceMessages"];
    expectedCandidates: UnsubscribeFinderSuccess["candidates"];
    reviewNotes: string[];
  }>(successFixturePath);

  const response = analyzeUnsubscribeCandidates({
    tool: fixture.tool,
    version: fixture.version,
    sourceMessages: fixture.sourceMessages,
  });

  assert.equal(response.status, "ok");
  assert.equal(response.tool, "unsubscribe-finder");
  assert.equal(response.version, 1);
  assert.deepEqual(response.candidates, fixture.expectedCandidates);
  assert.deepEqual(response.reviewNotes, fixture.reviewNotes);
  assert.deepEqual(response.summary, {
    totalMessages: 4,
    detected: 1,
    needsReview: 1,
    unsafe: 1,
    ignored: 1,
  });
});

test("analyzeUnsubscribeCandidates rejects empty input with a stable error code", async () => {
  const fixture = await loadFixture<{
    tool: "unsubscribe-finder";
    version: 1;
    sourceMessages: [];
    expectedError: UnsubscribeFinderFailure["error"];
    reviewNotes: string[];
  }>(emptyInputFixturePath);

  const response = analyzeUnsubscribeCandidates({
    tool: fixture.tool,
    version: fixture.version,
    sourceMessages: fixture.sourceMessages,
  });

  assert.equal(response.status, "error");
  assert.equal(response.error.code, fixture.expectedError.code);
  assert.equal(response.error.message, fixture.expectedError.message);
});

test("analyzeUnsubscribeCandidates rejects malformed source messages with a stable error code", async () => {
  const fixture = await loadFixture<{
    tool: "unsubscribe-finder";
    version: 1;
    sourceMessages: unknown[];
    expectedError: UnsubscribeFinderFailure["error"];
    reviewNotes: string[];
  }>(invalidMessageFixturePath);

  const response = analyzeUnsubscribeCandidates({
    tool: fixture.tool,
    version: fixture.version,
    sourceMessages: fixture.sourceMessages as UnsubscribeFinderRequest["sourceMessages"],
  });

  assert.equal(response.status, "error");
  assert.equal(response.error.code, fixture.expectedError.code);
  assert.equal(response.error.message, fixture.expectedError.message);
  assert.deepEqual(response.error.invalidFields, fixture.expectedError.invalidFields);
  assert.equal(response.error.sourceMessageId, "message-invalid-001");
});
