import { describe, expect, it } from 'vitest';

import {
  stellarAddressSchema,
  hash32Schema,
  stroopAmountSchema,
  senderRuleSchema,
  postageStatusSchema,
  mailboxPolicySchema,
} from '../../../src/server/api/domain';

// ---------------------------------------------------------------------------
// Property-based generators (hand-rolled for zero-dependency CI)
// ---------------------------------------------------------------------------

function seedFrom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

function* generateStellarAddresses(seed: number, count: number): Generator<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const random = seedFrom(seed);
  for (let i = 0; i < count; i++) {
    let addr = 'G';
    for (let j = 0; j < 55; j++) {
      addr += chars[Math.floor(random() * chars.length)];
    }
    yield addr;
  }
}

function* generateHashes(seed: number, count: number): Generator<string> {
  const hex = 'abcdef0123456789';
  const random = seedFrom(seed);
  for (let i = 0; i < count; i++) {
    let hash = '';
    for (let j = 0; j < 64; j++) {
      hash += hex[Math.floor(random() * hex.length)];
    }
    yield hash;
  }
}

function* generateAmountStrings(seed: number, count: number): Generator<string> {
  const random = seedFrom(seed);
  for (let i = 0; i < count; i++) {
    const val = BigInt(Math.floor(random() * 1e12));
    yield val.toString();
    yield '0';
    yield (2n ** 127n - 1n).toString();
  }
}

function* generateInvalidAddresses(seed: number, count: number): Generator<string> {
  const invalid = ['', 'GTOOSHORT', 'X' + 'A'.repeat(55), 'G' + '0'.repeat(55), 'G' + '!'.repeat(55), 'g' + 'a'.repeat(55)];
  for (let i = 0; i < count && i < invalid.length; i++) {
    yield invalid[i];
  }
}

function* generateInvalidHashes(seed: number, count: number): Generator<string> {
  const invalid = ['', 'abc', 'Z'.repeat(64), 'a'.repeat(63), 'g'.repeat(64), '0x' + 'a'.repeat(62)];
  for (let i = 0; i < count && i < invalid.length; i++) {
    yield invalid[i];
  }
}

function* generateInvalidAmounts(seed: number, count: number): Generator<string> {
  const invalid = ['', '-1', '1.5', '0x10', 'abc', (2n ** 127n).toString(), ' 100 '];
  for (let i = 0; i < count && i < invalid.length; i++) {
    yield invalid[i];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property-based tests — Stellar address schema', () => {
  const SEED = 42;

  it('accepts 100 generated G-addresses', () => {
    for (const addr of generateStellarAddresses(SEED, 100)) {
      expect(() => stellarAddressSchema.parse(addr)).not.toThrow();
    }
  });

  it('rejects invalid addresses', () => {
    for (const addr of generateInvalidAddresses(SEED, 10)) {
      expect(() => stellarAddressSchema.parse(addr)).toThrow();
    }
  });

  it('has reproducible failures with seed', () => {
    const addr = generateStellarAddresses(SEED, 1).next().value!;
    // Same seed = same output
    const addr2 = generateStellarAddresses(SEED, 1).next().value!;
    expect(addr).toBe(addr2);
    expect(() => stellarAddressSchema.parse(addr)).not.toThrow();
  });
});

describe('Property-based tests — hash32 schema', () => {
  const SEED = 99;

  it('accepts 100 generated hashes', () => {
    for (const hash of generateHashes(SEED, 100)) {
      expect(() => hash32Schema.parse(hash)).not.toThrow();
    }
  });

  it('rejects invalid hashes', () => {
    for (const hash of generateInvalidHashes(SEED, 10)) {
      expect(() => hash32Schema.parse(hash)).toThrow();
    }
  });

  it('normalises to lowercase', () => {
    const result = hash32Schema.parse('A'.repeat(64));
    expect(result).toBe('a'.repeat(64));
  });
});

describe('Property-based tests — stroop amount schema', () => {
  const SEED = 77;

  it('accepts generated amount strings', () => {
    for (const amount of generateAmountStrings(SEED, 50)) {
      expect(() => stroopAmountSchema.parse(amount)).not.toThrow();
    }
  });

  it('accepts max i128', () => {
    const max = (2n ** 127n - 1n).toString();
    expect(() => stroopAmountSchema.parse(max)).not.toThrow();
  });

  it('rejects invalid amounts', () => {
    for (const amount of generateInvalidAmounts(SEED, 10)) {
      expect(() => stroopAmountSchema.parse(amount)).toThrow();
    }
  });

  it('rejects value exceeding i128 max', () => {
    const tooBig = (2n ** 127n).toString();
    expect(() => stroopAmountSchema.parse(tooBig)).toThrow();
  });
});

describe('Property-based tests — sender rule and postage status', () => {
  it('accepts all valid sender rules', () => {
    expect(() => senderRuleSchema.parse('default')).not.toThrow();
    expect(() => senderRuleSchema.parse('allow')).not.toThrow();
    expect(() => senderRuleSchema.parse('block')).not.toThrow();
  });

  it('rejects invalid sender rules', () => {
    for (const invalid of ['', 'unknown', 'ALLOW', 'Block', 'allow,block']) {
      expect(() => senderRuleSchema.parse(invalid)).toThrow();
    }
  });

  it('accepts all valid postage statuses', () => {
    expect(() => postageStatusSchema.parse('pending')).not.toThrow();
    expect(() => postageStatusSchema.parse('settled')).not.toThrow();
    expect(() => postageStatusSchema.parse('refunded')).not.toThrow();
  });

  it('rejects invalid postage statuses', () => {
    for (const invalid of ['', 'PENDING', 'active', 'completed']) {
      expect(() => postageStatusSchema.parse(invalid)).toThrow();
    }
  });
});

describe('Property-based tests — mailbox policy schema', () => {
  it('accepts valid policy', () => {
    const policy = {
      allowUnknown: false,
      minimumPostage: '1000',
      requireVerified: true,
    };
    expect(() => mailboxPolicySchema.parse(policy)).not.toThrow();
  });

  it('rejects policy with invalid minimumPostage', () => {
    const policy = { allowUnknown: false, minimumPostage: '-1', requireVerified: true };
    expect(() => mailboxPolicySchema.parse(policy)).toThrow();
  });

  it('rejects policy with missing fields', () => {
    expect(() => mailboxPolicySchema.parse({ allowUnknown: false })).toThrow();
    expect(() => mailboxPolicySchema.parse({})).toThrow();
  });

  it('rejects policy with wrong types', () => {
    expect(() => mailboxPolicySchema.parse({ allowUnknown: 'yes', minimumPostage: '1000', requireVerified: true })).toThrow();
    expect(() => mailboxPolicySchema.parse({ allowUnknown: false, minimumPostage: '1000', requireVerified: 1 })).toThrow();
  });
});

describe('Timestamp invariants', () => {
  const timestampSchema = import('../../../src/server/api/domain').then(m => m.postageSchema);

  it('rejects non-ISO timestamps', async () => {
    const { postageSchema } = await import('../../../src/server/api/domain');
    const base = {
      amount: '1000',
      createdAt: 'not-a-date',
      messageId: 'a'.repeat(64),
      paymentHash: 'b'.repeat(64),
      recipient: 'G' + 'A'.repeat(55),
      sender: 'G' + 'B'.repeat(55),
      status: 'pending' as const,
    };
    expect(() => postageSchema.parse(base)).toThrow();
  });
});
