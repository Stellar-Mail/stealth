# Fixtures — Mail-to-Ticket Converter

This document describes the test fixtures available for the Mail-to-Ticket Converter tool and how to use them.

## Overview

Fixtures are static, deterministic data samples used for testing and development. They represent realistic email and ticket scenarios without containing real user data or credentials.

## Fixture Files

### sample-emails.json

Contains 5 sample email messages representing common support scenarios.

**Structure:**

```json
{
  "id": "email-001",
  "threadId": "thread-001",
  "from": { "name": "Sarah Mitchell", "email": "sarah.m@client.org" },
  "to": { "name": "Support", "email": "support@company.com" },
  "subject": "Login page returns 500 error on submit",
  "body": "Hi, I'm getting a 500 Internal Server Error...",
  "receivedAt": "2026-07-15T09:23:00Z",
  "hasAttachments": false
}
```

**Scenarios covered:**

- Critical bug report (500 error)
- Billing dispute (incorrect invoice)
- Feature request (CSV export)
- Support issue (password reset)
- Technical problem (dashboard widget)

**Usage:**

```typescript
import sampleEmails from "../fixtures/sample-emails.json";

// Load all emails
const emails = sampleEmails;

// Find specific email
const criticalBug = emails.find((e) => e.subject.includes("500 error"));
```

### sample-tickets.json

Contains 4 sample tickets representing different states and priorities.

**Structure:**

```json
{
  "id": "ticket-001",
  "emailId": "email-001",
  "subject": "Login page returns 500 error on submit",
  "description": "Hi, I'm getting a 500 Internal Server Error...",
  "priority": "critical",
  "status": "open",
  "category": "bug",
  "assignedTo": "member-001",
  "createdBy": "admin@example.com",
  "createdAt": "2026-07-15T10:00:00Z",
  "updatedAt": "2026-07-15T10:00:00Z",
  "resolution": null
}
```

**Status distribution:**

- 2 open tickets
- 1 in-progress ticket
- 1 resolved ticket

**Priority distribution:**

- 1 critical
- 2 high
- 1 low

**Category distribution:**

- 1 bug
- 1 billing
- 1 feature-request
- 1 support

**Usage:**

```typescript
import sampleTickets from "../fixtures/sample-tickets.json";

// Filter by status
const openTickets = sampleTickets.filter((t) => t.status === "open");

// Filter by priority
const criticalTickets = sampleTickets.filter((t) => t.priority === "critical");

// Get resolved tickets with resolution time
const resolvedTickets = sampleTickets.filter((t) => t.status === "resolved" && t.resolution);
```

### team-members.json

Contains 5 sample team members with different roles.

**Structure:**

```json
{
  "id": "member-001",
  "name": "Alex Johnson",
  "email": "alex.johnson@company.com",
  "role": "Senior Support Engineer"
}
```

**Roles covered:**

- Senior Support Engineer
- Support Lead
- Billing Specialist
- Product Manager
- Junior Support Engineer

**Usage:**

```typescript
import teamMembers from "../fixtures/team-members.json";

// Find member by ID
const member = teamMembers.find((m) => m.id === "member-001");

// Filter by role
const engineers = teamMembers.filter((m) => m.role.includes("Engineer"));

// Get all member IDs for assignment dropdown
const memberIds = teamMembers.map((m) => m.id);
```

## Loading Fixtures in Tests

### Using Vitest (Recommended)

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(
  __dirname,
  "..",
  "..",
  "tools",
  "v2",
  "team",
  "mail-to-ticket-converter",
  "fixtures",
);

function loadJSON(filename: string) {
  return JSON.parse(readFileSync(resolve(fixtureDir, filename), "utf-8"));
}

describe("My Test", () => {
  it("uses fixtures", () => {
    const emails = loadJSON("sample-emails.json");
    expect(emails.length).toBe(5);
  });
});
```

### Using Direct Import (if configured)

```typescript
import sampleEmails from "../../fixtures/sample-emails.json";

describe("My Test", () => {
  it("uses fixtures", () => {
    expect(sampleEmails.length).toBe(5);
  });
});
```

## Fixture Data Characteristics

### Realistic but Sanitized

- Email addresses use fictional domains (client.org, startup.io, designlab.com)
- Names are generic but realistic
- Scenarios represent real support workflows
- No real credentials, tokens, or personal data

### Deterministic

- All dates are fixed ISO-8601 timestamps
- IDs follow predictable patterns (email-001, ticket-001, member-001)
- Data relationships are consistent (email IDs match ticket emailId fields)

### Comprehensive Coverage

- Multiple ticket statuses (open, in-progress, resolved, closed)
- Multiple priority levels (critical, high, medium, low)
- Multiple categories (bug, billing, feature-request, support, other)
- Different team roles and responsibilities

## Creating New Fixtures

When adding new test scenarios:

1. **Follow the existing schema** - Use the same field names and types
2. **Use fictional data** - Never include real user information
3. **Maintain consistency** - Keep ID patterns and date formats consistent
4. **Update documentation** - Document new scenarios in this file
5. **Add tests** - Ensure new fixtures are covered by tests

### Example: Adding a new email

```json
{
  "id": "email-006",
  "threadId": "thread-006",
  "from": { "name": "Jane Smith", "email": "jane.smith@example.com" },
  "to": { "name": "Support", "email": "support@company.com" },
  "subject": "API rate limiting issue",
  "body": "We're hitting rate limits on the API endpoint...",
  "receivedAt": "2026-07-18T16:45:00Z",
  "hasAttachments": false
}
```

## Fixture Validation

The test suite validates that:

- All required fields are present
- Field types are correct (strings, booleans, dates)
- Enum values are valid (priority, status, category)
- Dates are parseable ISO-8601 strings
- Referential integrity is maintained (emailId references exist)

Run fixture validation:

```bash
bun run test -- mail-to-ticket-converter
```

## Fixture Security Guidelines

- **Never** include real email addresses or domains
- **Never** include real names or personal information
- **Never** include API keys, tokens, or credentials
- **Never** include real company data or financial information
- **Always** use fictional but realistic data
- **Always** sanitize any copied real-world data

## Common Fixture Patterns

### Email with Attachments

```json
{
  "hasAttachments": true
}
```

### High-Priority Bug

```json
{
  "priority": "critical",
  "category": "bug",
  "subject": "Critical system failure..."
}
```

### Resolved Ticket with Resolution

```json
{
  "status": "resolved",
  "resolution": "Fixed by updating API timeout configuration"
}
```

### Assigned Ticket

```json
{
  "assignedTo": "member-001"
}
```

## Troubleshooting

### Fixture Not Loading

- Check file path is correct relative to test file
- Ensure JSON is valid (no trailing commas, proper quotes)
- Verify file encoding is UTF-8

### Type Errors

- Ensure fixture structure matches TypeScript types in `types.ts`
- Check that enum values are valid (priority, status, category)
- Verify date strings are ISO-8601 format

### Missing References

- Ensure emailId in tickets matches an email ID
- Verify assignedTo matches a team member ID
- Check that all referenced IDs exist in their respective fixtures
