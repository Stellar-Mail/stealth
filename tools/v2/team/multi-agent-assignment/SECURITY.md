# Security & Threat Model: Multi-Agent Assignment

## Threat Assumptions

This tool assigns incoming messages, tickets, or proofs to multiple team agents. Due to its position in the routing layer, it is vulnerable to the following threats:

1. **Denial of Service (DoS) via Payload Size**
   Hostile inputs could send assignments containing thousands of agent IDs or massive history payloads. This could lock up the event loop or cause database transaction timeouts.

2. **Privilege Escalation**
   An attacker might attempt to assign an item to an admin agent or a system account that should not handle standard team routing, potentially exposing sensitive admin-only capabilities.

3. **Malformed Inputs (Injection & Data Corruption)**
   Injecting SQL-like strings, null bytes, or malformed JSON into the `agent_ids` array could lead to data corruption or crashes in downstream services.

4. **Resource Exhaustion via Repeated Assignments**
   A rapid succession of reassignment events for the same item could flood the audit log and trigger rate limits on third-party integrations (like Slack notifications).

## Unsafe Inputs

- **Unbounded Arrays**: Any array of agent IDs that is not capped (e.g., > 50 agents).
- **Non-UUID Formats**: Agent IDs that do not conform to the expected UUID or system ID format.
- **Empty Assignments**: Assigning to zero agents without explicitly closing or returning the ticket to an unassigned queue.
- **Cross-Tenant IDs**: Agent IDs that belong to a different workspace/tenant.

## Mitigation Strategy

- Enforce strict validation on all incoming assignment requests using the helpers defined in `guards.ts`.
- Cap the number of assigned agents to a reasonable maximum.
- Ensure all agent IDs are deduplicated and validated against a strict UUID/format regex before any processing occurs.
