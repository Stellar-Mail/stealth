import assert from "node:assert/strict";
import test from "node:test";

import {
  clampCollection,
  createSafeRecord,
  sanitizeText,
  sanitizeVendorInput,
} from "../services/security-guards.js";

test("sanitizeText trims hostile control characters and caps length", () => {
  const value = sanitizeText("  \u0000Hello\u0001 world\u0007  ", {
    maxLength: 12,
    fallback: "unknown",
  });

  assert.equal(value, "Hello world");
});

test("sanitizeVendorInput rejects malformed vendor data", () => {
  const normalized = sanitizeVendorInput({
    name: "   ",
    email: "not-an-email",
    category: "business",
  });

  assert.equal(normalized.valid, false);
  assert.equal(normalized.reason, "invalid_email");
});

test("clampCollection prevents oversized datasets from being processed", () => {
  const limited = clampCollection([1, 2, 3, 4, 5], 3);

  assert.deepEqual(limited, [1, 2, 3]);
});

test("createSafeRecord preserves safe defaults for hostile input", () => {
  const record = createSafeRecord({
    vendorId: "vendor-1",
    subject: "\u0000<script>bad</script>",
    preview: "   ",
    metadata: {
      nested: { value: "ok" },
      bad: Symbol("x"),
    },
  });

  assert.equal(record.subject, "scriptbadscript");
  assert.equal(record.preview, "");
  assert.equal(record.metadata?.nested?.value, "ok");
  assert.equal(record.metadata?.bad, undefined);
});
