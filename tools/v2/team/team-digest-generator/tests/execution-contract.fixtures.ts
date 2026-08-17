/**
 * execution-contract.fixtures.ts — Success and failure fixtures for the test execution contract
 *
 * Exposes deterministic sample fixtures for unit testing, integration testing,
 * and headless backend validation without UI dependencies.
 */

import type { TeamDigestItem } from "../src/digestGenerator";
import type { ActivityItem } from "../services/digest-generator.service.mjs";

// ---------------------------------------------------------------------------
// Success Fixtures
// ---------------------------------------------------------------------------

/** Valid TeamDigestItem array fixture for success cases. */
export const VALID_ITEMS_FIXTURE: TeamDigestItem[] = [
  {
    id: "item-101",
    author: "Alice Smith",
    subject: "Refactored auth pipeline",
    project: "Core Security",
    tags: ["auth", "security"],
    createdAt: "2026-07-27T08:00:00Z",
    isActionItem: true,
  },
  {
    id: "item-102",
    author: "Bob Jones",
    subject: "Updated documentation for v2",
    project: "Documentation",
    tags: ["docs"],
    createdAt: "2026-07-27T09:30:00Z",
    isActionItem: false,
  },
];

/** Valid ActivityItem array fixture for activity digest generation. */
export const VALID_ACTIVITY_FIXTURE: ActivityItem[] = [
  {
    id: "email-201",
    from: "alice@example.com",
    subject: "PR ready for review",
    receivedAt: "2026-07-27T10:00:00Z",
    signals: ["needs review", "PR ready"],
  },
  {
    id: "email-202",
    from: "bob@example.com",
    subject: "CI pipeline deployed successfully",
    receivedAt: "2026-07-27T11:00:00Z",
    signals: ["deployed"],
  },
];

/** Valid email string fixture. */
export const VALID_EMAIL_FIXTURE = "developer@example.com";

/** Valid HTML snippet fixture containing XSS payload to be sanitized. */
export const VALID_SANITIZE_FIXTURE = {
  html: '<p>Hello Team</p><script>alert("xss")</script><a href="javascript:void(0)">Link</a>',
  subject: "Daily Digest\x00\x1F",
};

// ---------------------------------------------------------------------------
// Failure Fixtures
// ---------------------------------------------------------------------------

/** Invalid TeamDigestItem array missing an author field. */
export const INVALID_ITEMS_MISSING_AUTHOR: TeamDigestItem[] = [
  {
    id: "item-400",
    author: "",
    subject: "Missing author test",
    createdAt: "2026-07-27T10:00:00Z",
  },
];

/** Invalid ActivityItem payload (non-array). */
export const INVALID_ACTIVITY_NOT_ARRAY: unknown = {
  id: "not-an-array",
};

/** Invalid email string containing SQL injection characters. */
export const INVALID_EMAIL_FIXTURE = "admin'--@example.com";

/** Unknown operation fixture for testing contract routing failure. */
export const INVALID_OPERATION_FIXTURE = {
  type: "non_existent_operation_type",
};
