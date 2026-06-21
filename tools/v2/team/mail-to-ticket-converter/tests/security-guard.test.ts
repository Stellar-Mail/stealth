import { describe, expect, it } from "vitest";
import { MailToTicketSecurityGuard } from "../services/security-guard.service";

const baseInput = {
  subject: "Invoice follow-up",
  body: "Can support convert this customer email into a ticket?",
  from: "Customer@Example.com",
  to: ["Support@example.com"],
  cc: [],
  attachmentNames: ["invoice.pdf"],
  teamId: "team_support",
  requestedPriority: "normal" as const,
};

describe("MailToTicketSecurityGuard", () => {
  it("sanitizes safe mail input without touching main app state", () => {
    const guard = new MailToTicketSecurityGuard();

    const result = guard.sanitize(baseInput);

    expect(result.ok).toBe(true);
    expect(result.value?.from).toBe("customer@example.com");
    expect(result.value?.to).toEqual(["support@example.com"]);
    expect(result.value?.teamId).toBe("team_support");
    expect(result.value?.requestedPriority).toBe("normal");
  });

  it("rejects header injection and invalid sender input", () => {
    const guard = new MailToTicketSecurityGuard();

    const result = guard.sanitize({
      ...baseInput,
      subject: "Need help\nBcc: victim@example.com",
      from: "not an email",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("from must be a valid email address");
    expect(result.errors).toContain("input contains header-injection-like content");
  });

  it("removes active markup and control characters from ticket text", () => {
    const guard = new MailToTicketSecurityGuard();

    const result = guard.sanitize({
      ...baseInput,
      body: "hello\u0000<script>alert('x')</script>world",
      attachmentNames: ["../evidence\\thread.txt"],
    });

    expect(result.ok).toBe(true);
    expect(result.value?.body).toContain("[removed unsafe markup]");
    expect(result.value?.body).not.toContain("<script>");
    expect(result.value?.attachmentNames).toEqual([".._evidence_thread.txt"]);
  });

  it("bounds large messages and many attachments for predictable performance", () => {
    const guard = new MailToTicketSecurityGuard({
      maxBodyLength: 20,
      maxAttachments: 2,
    });

    const result = guard.sanitize({
      ...baseInput,
      body: "x".repeat(200),
      attachmentNames: ["a.txt", "b.txt", "c.txt"],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("too many attachments for immediate ticket conversion");
  });

  it("flags high-cost conversions so future integration can defer them", () => {
    const guard = new MailToTicketSecurityGuard();

    const shouldDefer = guard.shouldDefer({
      ...baseInput,
      body: "long body ".repeat(10_000),
      to: Array.from({ length: 20 }, (_, index) => `user${index}@example.com`),
      attachmentNames: Array.from({ length: 8 }, (_, index) => `evidence-${index}.txt`),
    });

    expect(shouldDefer).toBe(true);
  });
});
