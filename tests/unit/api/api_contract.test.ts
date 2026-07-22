import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { MemoryApiRepository } from '../../../src/server/api/memory-repository';
import {
  assertPostageParticipant,
  getMailboxPolicy,
  getSenderRule,
  setMailboxPolicy,
  setSenderRule,
} from '../../../src/server/api/policy-service';
import { quotePostage, submitPostage } from '../../../src/server/api/postage-service';
import { getPostage } from '../../../src/server/api/postage-service';
import { normalizeResponse } from './response_normalizer';

const fixturesDir = path.resolve(__dirname, '../../test-fixtures/api/v1');

function loadFixture(name: string) {
  const filePath = path.join(fixturesDir, `${name}.json`);
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

describe('API v1 contract tests', () => {
  it('auth success fixture matches handler', async () => {
    // Assuming there is an auth handler; replace with actual import when available
    const repo = new MemoryApiRepository();
    // Simulate a successful auth response (stubbed here)
    const response = { status: 200, body: { token: 'dummy-token', expires: '2026-12-31T23:59:59Z' } };
    const normalized = normalizeResponse(response);
    const expected = loadFixture('auth_success');
    expect(normalized).toMatchObject(expected);
  });

  // Add more tests for each fixture similarly
});
