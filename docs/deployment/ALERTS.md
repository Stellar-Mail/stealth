# Operational Alerts and Runbooks

This guide defines the runbooks and operational procedures for responding to authentication, relay delivery, chain queue saturation, storage anomalies, rate-limiting, and failure alerts on the Stealth API. For formal Service-Level Objectives, SLI mathematical definitions, and error budget burn rate targets, see [Service-Level Objectives](SLO.md).

---

## Metric Reference

The Stealth API handler and service workers expose Prometheus-style metrics across core RED/USE dimensions:

### Core API Metrics

- `api_requests_total{method, path, status}`: Cumulative count of all processed HTTP requests.
- `api_errors_total{method, path, status, error_type}`: Cumulative count of all requests resulting in an error response.
- `api_latency`: Request latency histogram.

### Stage-Specific RED/USE Metrics

- **Auth**: `auth_requests_total{operation, status, outcome}`, `auth_latency`, `auth_errors_total{operation, error_type}`, `auth_active_sessions{method}`
- **Provisioning**: `provisioning_operations_total{step, status, outcome}`, `provisioning_latency`, `provisioning_errors_total{step, error_type}`
- **Relay**: `relay_requests_total{stage, status, delivery_state}`, `relay_latency`, `relay_errors_total{stage, error_type}`, `relay_retry_count{stage, reason}`
- **Storage**: `storage_operations_total{backend, operation, status}`, `storage_latency`, `storage_errors_total{backend, operation, error_type}`, `storage_utilization_ratio{backend}`
- **Sync**: `sync_operations_total{operation, status}`, `sync_latency`, `sync_errors_total{operation, error_type}`, `sync_gaps_detected_total{stream_type}`
- **Chain Queues**: `chain_queue_depth{queue_name, status}`, `chain_queue_operations_total{operation, status, outcome}`, `chain_queue_latency`, `chain_queue_errors_total{operation, error_type}`, `chain_dead_letters_total{job_type, error_code}`
- **Delivery**: `delivery_operations_total{stage, status, outcome}`, `delivery_latency`, `delivery_errors_total{stage, error_type}`, `delivery_stage_transitions_total{from_stage, to_stage, status}`

---

## Investigation Principles & Privacy Safeguards

When triaging anomalies, operators must strictly avoid accessing or logging sensitive user information.

### Prohibited Diagnostic Fields (DO NOT LOG or EXPOSE)

- **Plaintext Message Content**: Do not extract email subjects, message bodies, or attachment contents during debug sessions.
- **Ciphertext Envelopes**: Do not dump raw ciphertext blocks or encrypted payload bytes into logs or tickets.
- **Stellar Private Keys / Seeds**: Never log, output, or transfer signing seeds (`S...`) or recovery phrases.
- **Raw Cryptographic Signatures**: The signature strings themselves must not be included in logs or alerting tickets.
- **Account/Stellar G-Addresses in Metric Labels**: Avoid using raw addresses as metric labels to prevent database bloat and correspondent enumeration.
- **Bearer Tokens / Session Cookies**: All credentials and tokens must be stripped or redacted as `[REDACTED_TOKEN]`.

### Safe Diagnostic Fields (RECOMMENDED FOR INVESTIGATION)

- **Browser-Safe Support ID (`x-support-id` / `supportId`)**: A compact identifier (e.g., `sup_4f8a12bc`) provided by users to support engineers that indexes server trace records without revealing account or message details.
- **Request Correlation ID (`x-request-id` / `x-correlation-id`)**: Server-generated and client-supplied identifiers to trace the lifecycle of a request across services.
- **W3C Trace Context (`traceparent` / `traceId` / `spanId`)**: Distributed trace identifiers linking browser client calls to edge workers and background workers.
- **Stage & Operation Identifiers**: Standardized taxonomy tags (`stage="delivery"`, `operation="submitRelay"`).
- **Error Codes**: Structured taxonomy codes (`ERR_RPC_TIMEOUT`, `ERR_RATE_LIMITED`, `ERR_PAYLOAD_REJECTED`).
- **Response Status Code & Latency**: Standard HTTP status (`200`, `401`, `409`, `422`, `429`, `500`) and elapsed duration in milliseconds.

---

## Operator Triage Walkthrough: Tracing a Failed Send

Here is the standard operating procedure for investigating a failed message transmission reported by a beta user:

### Step 1: Obtain Support ID or Request ID

The user reports: _"My message send failed at 14:32 UTC with support ID `sup_8f21bc90`"_.

### Step 2: Search Privacy-Safe Correlated Logs

Query the structured log aggregator using the support ID:

```bash
# Filter logs by support ID
logcli query '{app="stealth-api"} |= "sup_8f21bc90"'
```

Sample sanitized log stream returned:

```json
{"timestamp":"2026-08-21T14:32:01.102Z","stage":"delivery","operation":"quote","status":200,"outcome":"success","supportId":"sup_8f21bc90","requestId":"req-8f21bc90","latencyMs":14.2}
{"timestamp":"2026-08-21T14:32:01.350Z","stage":"delivery","operation":"escrow","status":201,"outcome":"success","supportId":"sup_8f21bc90","requestId":"req-8f21bc90","latencyMs":85.0}
{"timestamp":"2026-08-21T14:32:02.110Z","stage":"relay","operation":"submit","status":503,"outcome":"unexpected_error","errorCode":"ERR_RPC_TIMEOUT","errorType":"RelayTimeoutError","supportId":"sup_8f21bc90","requestId":"req-8f21bc90","retryable":true,"attempt":3,"latencyMs":1200.5}
{"timestamp":"2026-08-21T14:32:02.200Z","stage":"chain_queue","operation":"enqueue","status":200,"outcome":"success","queueName":"relay_retry_queue","supportId":"sup_8f21bc90","requestId":"req-8f21bc90"}
```

### Step 3: Diagnostic Assessment Without Privacy Intrusion

- **Identified Failure Stage**: `relay` submission timed out after 3 retry attempts (`ERR_RPC_TIMEOUT`).
- **System Recovery**: The send coordinator automatically enqueued the operation into `relay_retry_queue` for background completion.
- **Privacy Verification**: The operator did not access message plaintext, recipient addresses, or private keys.

---

## Runbook: StealthAuthInvalidSignaturesSpike

### Alert Definition

Triggers when the rate of `401` unauthorized responses exceeds 5% of total requests over a 5-minute sliding window (`sum(rate(auth_errors_total{error_type="ERR_UNAUTHORIZED"}[5m])) > 0.05`).

### Potential Causes

1. **Client Signature Generation Drift**: Recent client release altered payload canonicalization.
2. **Clock Desynchronization**: System time drift between clients and validators causing expired validity windows.
3. **Active Credential Spraying**: Malicious entity sending forged signatures.

### Remediation

- Check NTP synchronization on API edge workers and Stellar Horizon nodes.
- If caused by client bug, rollback recent web client deployment.
- If malicious spraying, deploy Cloudflare WAF challenge on abusive source ASNs.

---

## Runbook: StealthRelayDeliveryFailureSpike

### Alert Definition

Triggers when Relay Delivery SLI drops below 99.5% over a 15-minute window (`rate(relay_errors_total[15m]) / rate(relay_requests_total[15m]) > 0.005`).

### Potential Causes

1. **Relay Node Outage or Network Partition**: Relay nodes are unreachable or returning 502/503.
2. **Relay Rate Limiting**: Upstream relay nodes are rejecting requests with 429 due to burst volume.
3. **Relay Transport Certificate Expiry**: TLS handshake errors between API worker and relay endpoint.

### Investigation & Remediation

1. Query relay errors by error type:
   ```promql
   sum by (error_type) (rate(relay_errors_total[5m]))
   ```
2. Check relay health checks: `GET /api/v1/health` and verify relay transport circuit breaker status.
3. If primary relay is degraded, fail over to secondary relay endpoints configured in runtime config.

---

## Runbook: StealthChainQueueSaturationAndDeadLetters

### Alert Definition

Triggers when chain dead-letter rate exceeds 0.1% or queue depth exceeds 500 jobs (`sum(rate(chain_dead_letters_total[10m])) > 0` or `chain_queue_depth > 500`).

### Potential Causes

1. **Soroban RPC Congestion**: High transaction fees or RPC submission latency on Stellar network.
2. **Contract Lock Contention**: Concurrent settlement operations conflicting on contract state.
3. **Poison Payloads**: Unhandled validation failure causing jobs to exhaust retry budgets.

### Investigation & Remediation

1. Inspect dead letter queue entries using administrative CLI without printing encrypted payloads:
   ```bash
   npm run dlq:list -- --status=dead --limit=10
   ```
2. Analyze top error codes:
   ```promql
   sum by (error_code) (rate(chain_dead_letters_total[1h]))
   ```
3. If transient RPC errors, trigger bulk retry of dead letters:
   ```bash
   npm run dlq:retry-all -- --error-code=ERR_RPC_TIMEOUT
   ```

---

## Runbook: StealthStorageErrorRateSpike

### Alert Definition

Triggers when storage operations return 5xx errors exceeding 0.01% of total operations over a 5-minute window (`rate(storage_errors_total[5m]) / rate(storage_operations_total[5m]) > 0.0001`).

### Potential Causes

1. **Cloudflare R2 Service Degradation**: Cloudflare object store API availability incident.
2. **Storage Secret Misconfiguration**: Incorrect credentials for encrypted envelope storage.
3. **KV Quota Exceeded**: Hitting rate limits on Cloudflare KV namespace writes.

### Remediation

1. Check Cloudflare status page for R2 / KV service incidents.
2. Verify storage adapter fallback to secondary object store if configured.

---

## Runbook: StealthProvisioningFailureSpike

### Alert Definition

Triggers when user provisioning error rate exceeds 1% over a 15-minute window (`rate(provisioning_errors_total[15m]) / rate(provisioning_operations_total[15m]) > 0.01`).

### Potential Causes

1. **Username Reservation Collisions**: Automated bots attempting to claim contested handles.
2. **Wallet Link Verification Failure**: Incompatible client wallet signature formats.

### Remediation

1. Check provisioning errors by step:
   ```promql
   sum by (step, error_type) (rate(provisioning_errors_total[5m]))
   ```
2. Verify rate-limiting on registration routes (`/api/v1/auth/register`, `/api/v1/accounts/provision`).

---

## Runbook: StealthSyncDegraded

### Alert Definition

Triggers when sync operations fail or sequence gap count spikes (`rate(sync_errors_total[5m]) > 1` or `rate(sync_gaps_detected_total[5m]) > 5`).

### Potential Causes

1. **Checkpoint Sequence Gaps**: Out-of-order delivery receipt indexing.
2. **Database Lock Contention on User Mailbox**: Simultaneous multi-device sync requests.

### Remediation

1. Query gap count by stream type:
   ```promql
   sum by (stream_type) (rate(sync_gaps_detected_total[15m]))
   ```
2. Trigger checkpoint rewind within allowable max rewind limits (`maxRewindLimit=100`).

---

## Testing with Synthetic Metrics

Operators can test the alert pipeline without introducing security risks by simulating anomalies using synthetic metrics.

### Method 1: Target Path Mocking

Send synthetic requests with test headers to trigger validation errors:

```bash
# Trigger 401 alert (Invalid G-Address)
for i in {1..50}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "x-stealth-address: invalid-stellar-address" \
    https://api.stealth.test/api/v1/postage
done
```

### Method 2: Prometheus Pushgateway Injection

For automated CI/CD validation, push synthetic metrics directly to the Prometheus Pushgateway:

```bash
# Push synthetic relay delivery failure spike
cat <<EOF | curl --data-binary @- http://pushgateway.monitoring.svc:9091/metrics/job/stealth_synthetic_test
relay_errors_total{stage="relay",error_type="ERR_RPC_TIMEOUT"} 50
relay_requests_total{stage="relay",status="503",delivery_state="FAILED"} 50
relay_requests_total{stage="relay",status="200",delivery_state="ACKNOWLEDGED"} 200
EOF
```
