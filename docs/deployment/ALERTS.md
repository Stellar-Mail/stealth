# Operational Alerts and Runbooks

This guide defines the runbooks and operational procedures for responding to authentication, rate-limiting, and anomaly detection alerts on the Stealth API. For formal Service-Level Objectives, SLI mathematical definitions, and error budget burn rate targets, see [Service-Level Objectives](SLO.md).

---

## Metric Reference

The Stealth API handler exposes the following Prometheus-style metrics:

- `api_requests_total{method, path, status}`: Cumulative count of all processed requests.
- `api_errors_total{method, path, status}`: Cumulative count of all requests resulting in an error response.
- `api_latency`: Request latency histogram.

---

## Investigation Principles & Privacy Safeguards

When triaging anomalies, operators must strictly avoid accessing or logging sensitive user information.

### Prohibited Diagnostic Fields (DO NOT LOG or EXPOSE)

- **Raw IP Addresses**: Must not be logged in plaintext (use truncated subnets or hashed IP representations).
- **Stellar Private Keys**: Never expose or output signing or recovery keys.
- **Plaintext Message Content**: Do not extract email/message bodies during debug sessions.
- **Raw Cryptographic Signatures**: The signature strings themselves must not be included in logs or alerting tickets.
- **Account/Stellar G-Addresses**: Avoid using raw addresses as high-cardinality metric labels to prevent database bloat and trackability vectors.

### Safe Diagnostic Fields (RECOMMENDED FOR INVESTIGATION)

- **Request Correlation ID (`x-request-id`)**: The primary server-generated identifier to trace the lifecycle of a request.
- **HTTP Route & Method**: The target endpoint and request verb (e.g., `POST /api/v1/postage`).
- **Response Status Code**: The standard HTTP status returned (e.g., `401`, `409`, `429`).
- **Normalized Metrics Rates**: Aggregate error-to-success ratios.
- **Redacted logs**: Error metadata indicating only validation rules violated without mirroring the invalid values.

---

## Runbook: StealthAuthInvalidSignaturesSpike

### Alert Definition

Triggers when the rate of `401` unauthorized responses exceeds 5% of total requests over a 5-minute sliding window.

### Potential Causes

1.  **Client Signature Generation Drift**: A recent client release contains bugs in how payload digests or signatures are generated.
2.  **Clock Desynchronization**: The system time of clients or validators has drifted, causing valid signatures to fail validation due to expiration windows.
3.  **Active Credential/Signature Spraying**: A malicious actor is sending forged signatures trying to authenticate.

### Investigation Steps

1.  **Check Scope**: Determine if the spike is isolated to a specific path/method (e.g., `/api/v1/postage/index`) by querying:
    ```promql
    sum by (path, method) (rate(api_errors_total{status="401"}[5m]))
    ```
2.  **Analyze Logs**: Search application logs using correlation IDs for `401` status codes. Verify if the error message indicates a formatting issue (e.g., "Missing x-stealth-address header") or schema validation failure:
    ```
    [API ERROR] POST /api/v1/postage - 401 (1.20ms) ApiError: x-stealth-address must be a valid Stellar G-address
    ```
3.  **Check Clock Health**: Verify NTP synchronization status on the API servers and database nodes.

### Remediation

- If a clock sync issue is confirmed, remediate the NTP daemon on affected servers.
- If it is a client bug, roll back the recently promoted client version.
- If it is spraying, deploy a Cloudflare Web Application Firewall (WAF) rule to block or rate-limit the attacking subnets.

---

## Runbook: StealthAuthReplayAttemptsDetected

### Alert Definition

Triggers when the rate of `409` conflict responses exceeds 3% of total requests over a 5-minute sliding window.

### Potential Causes

1.  **Idempotency Key Duplication**: A client is incorrectly reuseing the same `X-Idempotency-Key` for different request bodies.
2.  **Network-Level Replay Attack**: An attacker has intercepted a valid signed request and is attempting to replay it to cause duplicate transactions or exhaust resources.
3.  **Aggressive Client Retries**: Network lag is causing clients to retry requests before receiving responses, triggering the idempotency lock.

### Investigation Steps

1.  **Check Idempotency Replays**: Query log outputs to determine if the `409` conflict is due to completed operations or in-progress operations:
    ```promql
    sum by (path) (rate(api_errors_total{status="409"}[5m]))
    ```
2.  **Analyze Request IDs**: Group the events by path to identify if multiple distinct client request attempts are sharing headers.
3.  **Validate Idempotency Storage Health**: Check the status of the strongly consistent layer (Durable Objects / SQLite) to ensure idempotency leases are being freed correctly.

### Remediation

- If caused by client-side idempotency generation bugs, update client routing logic or clear local storage cache if appropriate.
- If an active replay attack is suspected, rotate active verification keys or blacklist the compromised payload footprint.

---

## Runbook: StealthSustainedThrottling

### Alert Definition

Triggers when the rate of `429` too many requests responses exceeds 10% of total requests over a 10-minute sliding window.

### Potential Causes

1.  **IP or Account Abuse**: An actor is flooding endpoints with unauthenticated or authenticated traffic.
2.  **Misconfigured Client Pollers**: A client-side infinite loop or high-frequency polling script is flooding the API.
3.  **Under-provisioned Rate Limits**: The configured rate limit thresholds are too low for current organic user growth.

### Investigation Steps

1.  **Determine Scope**: Check if the rate-limiting is occurring primarily on IP limits or Account limits by querying:
    ```promql
    sum by (path) (rate(api_errors_total{status="429"}[5m]))
    ```
2.  **Correlate with Edge Metrics**: Check Cloudflare Web Analytics to see if request volume spikes match specific ASNs or countries.

### Remediation

- If a specific actor or botnet is responsible, block the traffic at the Cloudflare edge layer.
- If limits are too restrictive for normal usage, update rate limit rules in the database or config.

---

## Testing with Synthetic Metrics

Operators can test the alert pipeline without introducing security risks by simulating anomalies using synthetic metrics.

### Method 1: Target Path Mocking

Send synthetic requests with test headers to trigger the validation errors:

```bash
# Trigger 401 alert (Invalid G-Address)
for i in {1..50}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "x-stealth-address: invalid-stellar-address" \
    https://api.stealth.test/api/v1/postage
done

# Trigger 429 alert (IP Rate Limit)
# Run request bursts to trigger the IP rate-limiting threshold
for i in {1..100}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    https://api.stealth.test/api/v1/postage/quote
done
```

### Method 2: Prometheus Pushgateway Injection

For automated CI/CD validation, push synthetic metrics directly to the Prometheus Pushgateway:

```bash
# Push synthetic 401 spike
cat <<EOF | curl --data-binary @- http://pushgateway.monitoring.svc:9091/metrics/job/stealth_synthetic_test
api_errors_total{method="POST",path="/api/v1/postage",status="401"} 120
api_requests_total{method="POST",path="/api/v1/postage",status="401"} 120
api_requests_total{method="POST",path="/api/v1/postage",status="200"} 500
EOF

# Push synthetic 429 spike
cat <<EOF | curl --data-binary @- http://pushgateway.monitoring.svc:9091/metrics/job/stealth_synthetic_test
api_errors_total{method="GET",path="/api/v1/postage/quote",status="429"} 150
api_requests_total{method="GET",path="/api/v1/postage/quote",status="429"} 150
api_requests_total{method="GET",path="/api/v1/postage/quote",status="200"} 200
EOF
```
