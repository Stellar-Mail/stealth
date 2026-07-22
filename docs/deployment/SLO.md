# Service-Level Objectives (SLOs) and Service-Level Indicators (SLIs)

This document defines the Service-Level Indicators (SLIs), Service-Level Objectives (SLO targets), measurement windows, traffic exclusion policies, error budget management, and metrics implementation for the Stealth API.

---

## Overview & Reliability Targets

The Stealth API enforces high-reliability targets tied directly to user-visible outcomes (mailbox policies, postage quotes/settlements, delivery receipts, and authentication).

### Primary Target Summary

| Indicator                        | SLO Target                    | Primary Window    | Error Budget         | Metric Calculation Source       |
| :------------------------------- | :---------------------------- | :---------------- | :------------------- | :------------------------------ |
| **API Availability**             | **99.9%**                     | 30 days (rolling) | 0.1% (~43.2 min/mo)  | `computeAvailabilitySLI()`      |
| **API Latency**                  | **99.0% $\le 250\text{ ms}$** | 30 days (rolling) | 1.0%                 | `computeLatencySLI(250)`        |
| **Authentication Availability**  | **99.95%**                    | 30 days (rolling) | 0.05% (~21.6 min/mo) | `computeAuthAvailabilitySLI()`  |
| **Critical Postage Transitions** | **99.9%**                     | 30 days (rolling) | 0.1% (~43.2 min/mo)  | `computePostageTransitionSLI()` |

---

## Detailed Service-Level Indicators (SLIs)

### 1. API Availability SLI

Measures overall uptime and successful HTTP request processing across user-facing API routes.

- **Exact Numerator**: Count of processed API HTTP requests returning non-5xx status codes (`status!~"5.."`).
- **Exact Denominator**: Total count of processed API HTTP requests.
- **Target**: **99.9%** availability over a 30-day rolling window.
- **PromQL Definition**:
  ```promql
  sum(rate(api_requests_total{status!~"5..", path!~"/api/v1/health|/api/v1/openapi.json"}[30d]))
  /
  sum(rate(api_requests_total{path!~"/api/v1/health|/api/v1/openapi.json"}[30d]))
  ```
- **Programmatic Computation**: Executed via `computeAvailabilitySLI()` in `src/server/api/metrics.ts`.

---

### 2. API Latency SLI (Response Time)

Measures request responsiveness to guarantee sub-second interaction speed for mail clients and relay nodes.

- **Exact Numerator**: Count of non-5xx HTTP requests completed within $\le 250\text{ ms}$ duration.
- **Exact Denominator**: Total count of non-5xx HTTP requests processed.
- **Target**: **99.0%** of valid requests completed in $\le 250\text{ ms}$ over a 30-day rolling window.
- **PromQL Definition**:
  ```promql
  sum(rate(api_latency_bucket{le="250", status!~"5..", path!~"/api/v1/health|/api/v1/openapi.json"}[30d]))
  /
  sum(rate(api_latency_count{status!~"5..", path!~"/api/v1/health|/api/v1/openapi.json"}[30d]))
  ```
- **Programmatic Computation**: Executed via `computeLatencySLI(250)` in `src/server/api/metrics.ts`.

---

### 3. Authentication & Authorization Availability SLI

Measures reliability of SEP-10 Web Auth, actor header validation, and delegated authorization evaluation.

- **Exact Numerator**: Count of authentication and delegation checks returning success (`2xx`) or valid client credentials/scope rejections (`401`/`403` due to invalid signature or expired delegation) without server infrastructure errors (`5xx`).
- **Exact Denominator**: Total count of authentication and delegation checks processed.
- **Target**: **99.95%** availability over a 30-day rolling window.
- **PromQL Definition**:
  ```promql
  sum(rate(api_requests_total{path=~".*/auth.*", status!~"5.."}[30d]))
  /
  sum(rate(api_requests_total{path=~".*/auth.*"}[30d]))
  ```
- **Programmatic Computation**: Executed via `computeAuthAvailabilitySLI()` in `src/server/api/metrics.ts`.

---

### 4. Critical Postage Transitions SLI

Measures accuracy and processing availability for trust-sensitive postage workflows (`quote`, `submit`, `settle`, `refund`).

- **Exact Numerator**: Count of postage requests returning successful completion (`200`, `201`), handled idempotency replay (`409`), or structured input validation errors (`422`) without unhandled database lock failures (`500` or transient storage timeout).
- **Exact Denominator**: Total count of postage requests processed (`path=~"/api/v1/postage.*"`).
- **Target**: **99.9%** success rate over a 30-day rolling window.
- **PromQL Definition**:
  ```promql
  sum(rate(api_requests_total{path=~"/api/v1/postage.*", status=~"2..|409|422"}[30d]))
  /
  sum(rate(api_requests_total{path=~"/api/v1/postage.*"}[30d]))
  ```
- **Programmatic Computation**: Executed via `computePostageTransitionSLI()` in `src/server/api/metrics.ts`.

---

## Excluded Traffic Documentation

To prevent operational noise and metrics distortion, the following traffic categories are explicitly excluded from SLI numerators and denominators:

1. **Health Check Probes (`GET /api/v1/health`)**:
   - Automated Kubernetes/Cloudflare health checks running every 5 seconds.
   - Excluded via `path!~"/api/v1/health"`.
2. **Static OpenAPI Schema Documentation (`GET /api/v1/openapi.json`)**:
   - High-volume automated CI schema validation traffic.
   - Excluded via `path!~"/api/v1/openapi.json"`.
3. **Synthetic Load & E2E Testing Traffic**:
   - Load test runs and integration pipelines passing `x-stealth-synthetic: true` or metric label `synthetic="true"`.
   - Excluded by `options.excludeSynthetic` in `src/server/api/metrics.ts`.
4. **Cloudflare Edge WAF Blocks**:
   - Requests dropped or challenged at the Cloudflare edge layer prior to reaching the API origin Worker.

---

## Measurement Windows & Error Budget Management

### Rolling Windows

- **Primary SLO Window**: 30 days (720 hours) rolling window used for formal reliability tracking and reporting.
- **Short-Term Operational Window**: 5-minute and 1-hour sliding windows used for real-time alerting and error budget burn rate calculation.

### Error Budget Burn Rate Alerting

| Alert Severity       | Window  | Error Budget Consumed  | Burn Rate Multiplier | Action                                                     |
| :------------------- | :------ | :--------------------- | :------------------- | :--------------------------------------------------------- |
| **Page (Critical)**  | 1 hour  | 2.0% of 30-day budget  | **24.0x**            | Immediate incident escalation to primary engineer on call. |
| **Ticket (Warning)** | 6 hours | 5.0% of 30-day budget  | **6.0x**             | Create high-priority bug ticket for investigation.         |
| **Notice (Info)**    | 3 days  | 10.0% of 30-day budget | **1.0x**             | Review during weekly service reliability retrospective.    |

---

## Metrics Implementation & Programmatic Access

The in-memory metrics engine in `src/server/api/metrics.ts` exposes helper functions to compute SLIs programmatically from accumulated metrics snapshots:

```typescript
import {
  computeAvailabilitySLI,
  computeLatencySLI,
  computeAuthAvailabilitySLI,
  computePostageTransitionSLI,
  computeSLOSummary,
} from "@/server/api/metrics";

// Calculate individual SLIs
const availability = computeAvailabilitySLI();
console.log(
  `Availability: ${availability.ratio * 100}% (${availability.numerator}/${availability.denominator})`,
);

// Calculate overall summary
const summary = computeSLOSummary({ excludeSynthetic: true });
if (!summary.availability.met) {
  console.warn("Availability SLO target breached!");
}
```

---

## Related Runbooks & Documentation

- [Operational Alerts and Runbooks](ALERTS.md) - Diagnostic steps for auth spikes and throttling.
- [Prometheus Alert Rules](alerts.yaml) - Alert rule configurations.
- [Release Gates Checklist](RELEASE_GATES.md) - Pre-release validation rules.
