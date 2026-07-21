import { describe, it, expect } from "vitest";
import {
  createDemoInboxData,
  getDemoMessagesByLabel,
  getUnreadDemoMessages,
  getStarredDemoMessages,
  getDemoMessagesWithAttachments,
  getDemoMessagesWithEvents,
} from "../fixtures/demoInboxData";
import {
  validateDemoDataset,
  validateDemoMessage,
  validateSafeEmailAddress,
  assertDemoDataSafety,
} from "../helpers/demoDataValidator";

describe("Demo Inbox Data", () => {
  describe("createDemoInboxData", () => {
    it("should create a valid demo dataset", () => {
      const dataset = createDemoInboxData();

      expect(dataset).toBeDefined();
      expect(dataset.id).toBe("demo-inbox-dataset");
      expect(dataset.name).toBe("Demo Inbox Dataset");
      expect(dataset.messages).toBeDefined();
      expect(dataset.senders).toBeDefined();
      expect(Array.isArray(dataset.messages)).toBe(true);
      expect(Array.isArray(dataset.senders)).toBe(true);
    });

    it("should contain messages with safe email addresses", () => {
      const dataset = createDemoInboxData();

      dataset.messages.forEach((message) => {
        // Check sender address uses safe domains
        expect(
          message.sender.address.endsWith("@example.com") ||
            message.sender.address.endsWith("@example.org") ||
            message.sender.address.endsWith(".stealth.demo"),
        ).toBe(true);

        // Check recipient addresses use safe domains
        message.recipients.forEach((recipient) => {
          expect(
            recipient.endsWith("@example.com") ||
              recipient.endsWith("@example.org") ||
              recipient.endsWith(".stealth.demo"),
          ).toBe(true);
        });
      });
    });

    it("should have messages with required fields", () => {
      const dataset = createDemoInboxData();

      dataset.messages.forEach((message) => {
        expect(message.id).toBeTruthy();
        expect(message.threadId).toBeTruthy();
        expect(message.subject).toBeTruthy();
        expect(message.snippet).toBeTruthy();
        expect(message.body).toBeTruthy();
        expect(message.sender).toBeDefined();
        expect(message.recipients).toBeDefined();
        expect(message.date).toBeTruthy();
        expect(typeof message.isRead).toBe("boolean");
        expect(typeof message.isStarred).toBe("boolean");
        expect(Array.isArray(message.labels)).toBe(true);
        expect(Array.isArray(message.attachments)).toBe(true);
      });
    });
  });

  describe("filter functions", () => {
    const dataset = createDemoInboxData();

    it("should filter messages by label", () => {
      const inboxMessages = getDemoMessagesByLabel("inbox");
      expect(inboxMessages.length).toBeGreaterThan(0);

      inboxMessages.forEach((message) => {
        expect(message.labels).toContain("inbox");
      });
    });

    it("should filter unread messages", () => {
      const unreadMessages = getUnreadDemoMessages();
      expect(unreadMessages.length).toBeGreaterThan(0);

      unreadMessages.forEach((message) => {
        expect(message.isRead).toBe(false);
      });
    });

    it("should filter starred messages", () => {
      const starredMessages = getStarredDemoMessages();
      expect(starredMessages.length).toBeGreaterThan(0);

      starredMessages.forEach((message) => {
        expect(message.isStarred).toBe(true);
      });
    });

    it("should filter messages with attachments", () => {
      const messagesWithAttachments = getDemoMessagesWithAttachments();
      expect(messagesWithAttachments.length).toBeGreaterThan(0);

      messagesWithAttachments.forEach((message) => {
        expect(message.attachments.length).toBeGreaterThan(0);
      });
    });

    it("should filter messages with calendar events", () => {
      const messagesWithEvents = getDemoMessagesWithEvents();
      expect(messagesWithEvents.length).toBeGreaterThan(0);

      messagesWithEvents.forEach((message) => {
        expect(message.calendarEvent).toBeDefined();
      });
    });
  });

  describe("data safety", () => {
    const dataset = createDemoInboxData();

    it("should pass comprehensive safety validation", () => {
      // Use the validator to ensure compliance
      expect(() => assertDemoDataSafety(dataset)).not.toThrow();

      const result = validateDemoDataset(dataset);
      expect(result.isValid).toBe(true);

      // Should have no errors (warnings might be acceptable)
      const errors = result.issues.filter((issue) => issue.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("should validate safe email addresses", () => {
      expect(validateSafeEmailAddress("user@example.com")).toBe(true);
      expect(validateSafeEmailAddress("user@example.org")).toBe(true);
      expect(validateSafeEmailAddress("user@notifications.stealth.demo")).toBe(true);

      expect(validateSafeEmailAddress("user@gmail.com")).toBe(false);
      expect(validateSafeEmailAddress("user@company.com")).toBe(false);
      expect(validateSafeEmailAddress("user@real-domain.com")).toBe(false);
    });

    it("should not contain real PII or sensitive data", () => {
      dataset.messages.forEach((message) => {
        const issues = validateDemoMessage(message);
        const errors = issues.filter((issue) => issue.severity === "error");

        // Should have no validation errors
        expect(errors).toHaveLength(0);
      });
    });

    it("should use deterministic data", () => {
      const dataset1 = createDemoInboxData();
      const dataset2 = createDemoInboxData();

      // Same function calls should produce identical results
      expect(dataset1.messages.length).toBe(dataset2.messages.length);
      expect(dataset1.senders?.length).toBe(dataset2.senders?.length);

      // Message IDs should be identical
      dataset1.messages.forEach((message1, index) => {
        const message2 = dataset2.messages[index];
        expect(message1.id).toBe(message2.id);
        expect(message1.subject).toBe(message2.subject);
      });
    });

    it("should have valid attachment metadata", () => {
      const messagesWithAttachments = getDemoMessagesWithAttachments();

      messagesWithAttachments.forEach((message) => {
        message.attachments.forEach((attachment) => {
          expect(attachment.id).toBeTruthy();
          expect(attachment.filename).toBeTruthy();
          expect(attachment.contentType).toBeTruthy();
          expect(attachment.sizeBytes).toBeGreaterThan(0);
          expect(attachment.url).toBeTruthy();
          expect(attachment.url.startsWith("/demo/")).toBe(true);
        });
      });
    });

    it("should have valid calendar event metadata", () => {
      const messagesWithEvents = getDemoMessagesWithEvents();

      messagesWithEvents.forEach((message) => {
        const event = message.calendarEvent!;
        expect(event.id).toBeTruthy();
        expect(event.title).toBeTruthy();
        expect(event.startTime).toBeTruthy();
        expect(event.endTime).toBeTruthy();
        expect(Array.isArray(event.attendees)).toBe(true);

        // Validate date format
        expect(() => new Date(event.startTime)).not.toThrow();
        expect(() => new Date(event.endTime)).not.toThrow();

        // End should be after start
        expect(new Date(event.endTime).getTime()).toBeGreaterThan(
          new Date(event.startTime).getTime(),
        );
      });
    });
  });
});
