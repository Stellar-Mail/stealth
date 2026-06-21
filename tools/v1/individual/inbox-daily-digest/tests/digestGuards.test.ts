import { describe, expect, it } from "vitest";
import { guardDigestEmails } from "../services";

describe("guardDigestEmails", () => {
  it("rejects non-array mailbox snapshots", () => {
    const result = guardDigestEmails("not-an-array");
    expect(result.emails).toEqual([]);
    expect(result.report.acceptedCount).toBe(0);
    expect(result.report.warnings[0]).toContain(
      "Mailbox snapshot was rejected because it is not an array",
    );
  });

  it("handles valid emails correctly", () => {
    const validEmails = [
      {
        id: "msg-1",
        sender: "alice@example.com",
        subject: "Meeting details",
        receivedAt: "2026-06-21T10:00:00Z",
        body: "Please confirm your availability for tomorrow's demo.",
        labels: ["work", "important"],
        attachments: ["agenda.pdf"],
      },
    ];

    const result = guardDigestEmails(validEmails);
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0]).toEqual({
      id: "msg-1",
      sender: "alice@example.com",
      subject: "Meeting details",
      receivedAt: "2026-06-21T10:00:00Z",
      body: "Please confirm your availability for tomorrow's demo.",
      labels: ["work", "important"],
      attachments: ["agenda.pdf"],
      wasTruncated: false,
    });
    expect(result.report.acceptedCount).toBe(1);
    expect(result.report.rejectedCount).toBe(0);
    expect(result.report.warnings).toHaveLength(0);
  });

  it("rejects invalid email formats or objects without sender/subject/body", () => {
    const invalidEmails = [
      "not-an-object",
      { id: "msg-2", sender: "", subject: "No sender", body: "body" },
      { id: "msg-3", sender: "sender", subject: "", body: "body" },
      { id: "msg-4", sender: "sender", subject: "No body", body: "" },
    ];

    const result = guardDigestEmails(invalidEmails);
    expect(result.emails).toHaveLength(0);
    expect(result.report.acceptedCount).toBe(0);
    expect(result.report.rejectedCount).toBe(4);
    expect(result.report.warnings).toHaveLength(4);
  });

  it("normalizes whitespaces, control characters, and html tags", () => {
    const rawEmails = [
      {
        id: "msg-5",
        sender: "  bob@example.com  ",
        subject: "Hello\nWorld",
        receivedAt: "2026-06-21",
        body: "<div>Click <b>here</b> for updates.</div>",
        labels: ["  tag1  ", "tag2"],
        attachments: [],
      },
    ];

    const result = guardDigestEmails(rawEmails);
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].sender).toBe("bob@example.com");
    expect(result.emails[0].subject).toBe("Hello World");
    expect(result.emails[0].body).toBe("Click here for updates.");
    expect(result.emails[0].labels).toEqual(["tag1", "tag2"]);
  });

  it("caps maximum emails and truncates extra long fields", () => {
    const options = {
      maxEmails: 2,
      maxBodyCharacters: 10,
      maxTextFieldCharacters: 5,
      maxLabels: 1,
      maxAttachments: 1,
    };

    const rawEmails = [
      {
        id: "msg-6",
        sender: "alex_long_sender_name",
        subject: "very_long_subject_here",
        receivedAt: "2026",
        body: "this is a very long body text that exceeds ten characters.",
        labels: ["label1", "label2", "label3"],
        attachments: ["file1.txt", "file2.txt"],
      },
      {
        id: "msg-7",
        sender: "john",
        subject: "test",
        receivedAt: "2026",
        body: "short body",
      },
      {
        id: "msg-8",
        sender: "ignored",
        subject: "ignored",
        receivedAt: "2026",
        body: "ignored",
      },
    ];

    const result = guardDigestEmails(rawEmails, options);
    expect(result.emails).toHaveLength(2); // Capped at maxEmails
    expect(result.report.acceptedCount).toBe(2);
    expect(result.emails[0].sender).toBe("alex_"); // Capped at 5 chars
    expect(result.emails[0].subject).toBe("very_"); // Capped at 5 chars
    expect(result.emails[0].body).toBe("this is a"); // Capped at 10 chars, trimmed to 9
    expect(result.emails[0].labels).toEqual(["label"]); // Capped at 1 label
    expect(result.emails[0].attachments).toEqual(["file1"]); // Capped at 1 attachment, "file1.txt" truncated to 5
    expect(result.emails[0].wasTruncated).toBe(true);
    expect(result.report.warnings).toContain("Mailbox snapshot was capped at 2 emails.");
    expect(result.report.warnings).toContain(
      "Email 1 exceeded one or more local processing limits.",
    );
  });

  it("builds a stable ID if the ID field is missing", () => {
    const rawEmails = [
      {
        sender: "bob@example.com",
        subject: "meeting setup",
        body: "testing",
      },
    ];

    const result = guardDigestEmails(rawEmails);
    expect(result.emails[0].id).toBe("bob-example-com-meeting-setup-0");
  });
});
