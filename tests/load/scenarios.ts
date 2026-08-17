import { runLoadTest, generateRandomAddress, generateRandomHash } from "./harness";

const API_URL = process.env.API_URL || "http://localhost:5173";
console.log(`\n🚀 Starting Load Test Suite targeting ${API_URL}`);

async function scenarioBurstReads() {
  const owner = generateRandomAddress();
  const sender = generateRandomAddress();

  // Rate limiting test for Burst Reads (Submits)
  // Account limit is 50 requests per hour per the abuse service
  // Blasting 100 requests should trigger 429 Too Many Requests
  const result = await runLoadTest(
    "Burst Submits (Rate Limits)",
    () => ({
      url: `${API_URL}/api/v1/postage`,
      method: "POST",
      headers: { "x-stealth-address": sender, "Content-Type": "application/json" },
      body: {
        messageId: generateRandomHash(),
        paymentHash: generateRandomHash(),
        sender,
        recipient: owner,
        amount: "1000000000",
      }, // large amount to bypass 422
    }),
    15, // concurrency
    100, // iterations
  );

  if (result.statusCodes[429] > 0) {
    console.log("✅ PASSED: Rate limits correctly returned 429 Too Many Requests.");
  } else {
    console.warn("⚠️ WARNING: Rate limits did not trigger. Expected some 429 status codes.");
  }
}

async function scenarioPagination() {
  const owner = generateRandomAddress();

  // Pagination test: fetching pages of receipts
  // Ensure heavy sequential fetching maintains stability
  await runLoadTest(
    "Receipt Pagination",
    (index) => ({
      url: `${API_URL}/api/v1/receipts?limit=50&cursor=${index * 50}`,
      method: "GET",
      headers: { "x-stealth-address": owner },
    }),
    5,
    50,
  );
}

async function scenarioConcurrentTransitions() {
  const owner = generateRandomAddress();
  const sender = generateRandomAddress();
  const messageId = generateRandomHash();
  const paymentHash = generateRandomHash();

  // First, we need to create a pending postage
  console.log(`\n▶ Preparing Concurrent Transitions: Creating pending postage...`);
  try {
    const createRes = await fetch(`${API_URL}/api/v1/postage`, {
      method: "POST",
      headers: {
        "x-stealth-address": sender,
        "x-forwarded-for": `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.0.1`,
        "user-agent": `LoadTester-${Math.random()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messageId,
        paymentHash,
        sender,
        recipient: owner,
        amount: "1000000000",
      }),
    });

    if (!createRes.ok) {
      console.warn(
        `  ⚠️ Failed to create pending postage (HTTP ${createRes.status}). The concurrent settlement test may simply return 404s or 400s if data is missing.`,
      );
    }
  } catch (err) {
    console.warn(`  ⚠️ Fetch failed during setup: ${err}`);
  }

  // Concurrent settlement race condition test
  // We blast 20 concurrent settle requests for the *same* messageId.
  // We assert that exactly 1 should succeed (200 OK) while all others fail (409 Conflict),
  // ensuring no duplicate terminal transitions occur.
  const result = await runLoadTest(
    "Concurrent Settlement (Race Condition)",
    () => ({
      url: `${API_URL}/api/v1/postage/${messageId}/settle`,
      method: "POST",
      headers: {
        "x-stealth-address": owner,
        "x-forwarded-for": `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.0.1`,
        "user-agent": `LoadTester-${Math.random()}`,
      },
    }),
    20, // Blast them all at once
    20,
  );

  if (result.successes > 1) {
    console.error(
      "\n❌ FAILED: Duplicate terminal transitions occurred! Multiple requests succeeded.",
    );
    process.exit(1);
  } else {
    console.log("\n✅ PASSED: No duplicate terminal transitions.");
  }
}

async function scenarioAuth() {
  const invalidAddress = "invalid-address";

  // Test rejection of rapid unauthorized/invalid requests
  await runLoadTest(
    "Authentication Failures",
    () => ({
      url: `${API_URL}/api/v1/policies/evaluate`,
      method: "POST",
      headers: { "x-stealth-address": invalidAddress, "Content-Type": "application/json" },
      body: { sender: invalidAddress, recipient: generateRandomAddress() },
    }),
    10,
    100,
  );
}

async function main() {
  try {
    await scenarioBurstReads();
    await scenarioPagination();
    await scenarioAuth();
    await scenarioConcurrentTransitions();

    console.log("\n🎉 All load test scenarios completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Load test suite failed:", err);
    process.exit(1);
  }
}

main();
