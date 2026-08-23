import { describe, expect, it } from "vitest";
import {
  parseSafeContent,
  sanitizeRawContent,
  stripHtmlTags,
} from "@/features/mail/safe-rendering";

describe("safe-rendering mail parser", () => {
  it("strips script tags and inline execution handlers", () => {
    const maliciousHtml = `<div>Hello <script>alert('xss')</script><img src="x" onerror="alert(1)">World</div>`;
    const clean = sanitizeRawContent(maliciousHtml);
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("alert('xss')");
    expect(clean).not.toContain("onerror=");
    expect(clean).toContain("Hello ");
    expect(clean).toContain("World");
  });

  it("strips iframe and object tags", () => {
    const malicious = `<iframe src="https://attacker.com"></iframe><p>Safe paragraph</p>`;
    const clean = sanitizeRawContent(malicious);
    expect(clean).not.toContain("<iframe");
    expect(clean).toContain("<p>Safe paragraph</p>");
  });

  it("strips HTML markup when converting to plain text", () => {
    const html = `<h2>Welcome</h2><p>This is a <b>test</b> message.</p>`;
    const stripped = stripHtmlTags(html);
    expect(stripped).toBe("Welcome\n\nThis is a test message.");
  });

  it("parses plain text into structured paragraphs, bullet lists, and key-value fields", () => {
    const body = `Important Update

Here are the items:
- Item 1
- Item 2

Status: Approved
Amount: 50.00 XLM`;

    const parsed = parseSafeContent(body);
    expect(parsed.hasHtmlTags).toBe(false);
    expect(parsed.blocks).toHaveLength(4);
    expect(parsed.blocks[0]).toEqual({
      kind: "paragraph",
      text: "Important Update",
    });
    expect(parsed.blocks[1]).toEqual({
      kind: "paragraph",
      text: "Here are the items:",
    });
    expect(parsed.blocks[2]).toEqual({
      kind: "list",
      items: ["Item 1", "Item 2"],
    });
    expect(parsed.blocks[3]).toEqual({
      kind: "fields",
      fields: [
        { label: "Status", value: "Approved" },
        { label: "Amount", value: "50.00 XLM" },
      ],
    });
  });

  it("handles malicious HTML payload body safely without crashing", () => {
    const body = `<script>eval('malicious')</script><iframe src="javascript:alert(1)"></iframe><p>Safe content line</p>`;
    const parsed = parseSafeContent(body);
    expect(parsed.hasHtmlTags).toBe(true);
    expect(parsed.rawCleanText).not.toContain("eval");
    expect(parsed.rawCleanText).not.toContain("javascript:");
    expect(parsed.rawCleanText).toContain("Safe content line");
  });
});
