import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom Prometheus/OpenTelemetry Metrics
const signupBurstDuration = new Trend('signup_burst_duration');
const mailboxSyncLatency = new Trend('mailbox_sync_latency');
const storageUploadLatency = new Trend('storage_upload_latency');
const chainQueueAge = new Trend('chain_queue_age_ms');
const errorRate = new Rate('http_error_rate');
const idempotencyViolations = new Counter('idempotency_violations');

export const options = {
  scenarios: {
    // Scenario 1: Normal steady state
    steady_state: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
    // Scenario 2: Burst signup & authentication spike
    signup_burst: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      stages: [
        { duration: '30s', target: 200 }, // Sudden spike
        { duration: '1m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      preAllocatedVUs: 100,
      maxVUs: 300,
      gracefulStop: '10s',
    },
    // Scenario 3: Abusive & degraded dependency load
    abusive_stress: {
      executor: 'constant-vus',
      vus: 50,
      duration: '1m',
      startTime: '3m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<450', 'p(99)<800'],
    http_error_rate: ['rate<0.01'], // < 1% error rate
    chain_queue_age_ms: ['p(95)<3000'], // Chain Queue lag under 3s
    idempotency_violations: ['count==0'], // Strict zero-tolerance for idempotency failure
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `load-test-${__VU}-${__ITER}-${Date.now()}`,
    },
  };

  group('1. Auth & Signup Burst Path', () => {
    const payload = JSON.stringify({
      username: `beta_user_${__VU}_${Date.now()}`,
      signature: '0xREDACTED_MOCK_ED25519_SIG',
    });

    const startTime = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/auth/signup`, payload, params);
    signupBurstDuration.add(Date.now() - startTime);

    const success = check(res, {
      'signup status 201 or 429': (r) => r.status === 201 || r.status === 429,
    });
    errorRate.add(!success);
  });

  group('2. Encrypted Relay & Storage Upload Path', () => {
    const attachPayload = JSON.stringify({
      blobSize: 1024 * 500, // 500KB encrypted payload
      checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    });

    const startUpload = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/storage/upload`, attachPayload, params);
    storageUploadLatency.add(Date.now() - startUpload);

    check(res, {
      'storage upload accepted': (r) => r.status === 200 || r.status === 202,
    });
  });

  group('3. Idempotent Chain Queue Writes', () => {
    const chainWritePayload = JSON.stringify({
      txHash: `0xmock_hash_${__VU}_${__ITER}`,
      idempotencyKey: `tx-key-${__VU}-${__ITER}`,
    });

    // Execute same write twice to test idempotency guard
    const res1 = http.post(`${BASE_URL}/api/v1/chain/queue`, chainWritePayload, params);
    const res2 = http.post(`${BASE_URL}/api/v1/chain/queue`, chainWritePayload, params);

    if (res1.status === 200 && res2.status === 200) {
      const body1 = JSON.parse(res1.body as string);
      const body2 = JSON.parse(res2.body as string);
      
      // Violates idempotency if duplicate state creation occurs
      if (body1.txId !== body2.txId) {
        idempotencyViolations.add(1);
      }
    }
  });

  sleep(1);
}