import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  TICKET_CONVERTER_STATES,
  convertMailToTicket,
  createTicketConversionReport,
} from "../index.mjs";

const sampleMessages = JSON.parse(
  readFileSync(new URL("../fixtures/sample-mail-items.json", import.meta.url), "utf-8"),
);

describe("Mail-to-Ticket Converter", () => {
  it("returns loading state for pending callers", () => {
    const report = createTicketConversionReport({ isLoading: true });

    assert.equal(report.state, TICKET_CONVERTER_STATES.LOADING);
    assert.equal(report.status, "pending");
    assert.deepEqual(report.tickets, []);
  });

  it("returns empty state for a valid empty message list", () => {
    const report = createTicketConversionReport({ messages: [] });

    assert.equal(report.state, TICKET_CONVERTER_STATES.EMPTY);
    assert.equal(report.status, "ready");
    assert.equal(report.summary.totalMessages, 0);
  });

  it("returns error state for invalid messages", () => {
    const report = createTicketConversionReport({ messages: [{ body: "Missing id and title" }] });

    assert.equal(report.state, TICKET_CONVERTER_STATES.ERROR);
    assert.equal(report.status, "blocked");
    assert.ok(report.errors.some((message) => message.includes("id is required")));
  });

  it("converts fixtures into deterministic ticket candidates", () => {
    const report = createTicketConversionReport({ messages: sampleMessages });

    assert.equal(report.state, TICKET_CONVERTER_STATES.SUCCESS);
    assert.equal(report.status, "converted");
    assert.equal(report.tickets.length, 5);
    assert.equal(report.summary.highestPriority, "critical");
    assert.deepEqual(report.summary.priorities, {
      critical: 1,
      high: 1,
      medium: 2,
      low: 1,
    });
  });

  it("routes security outage mail to the security response queue", () => {
    const report = createTicketConversionReport({ messages: sampleMessages });
    const securityTicket = report.tickets.find((ticket) => ticket.id === "ticket-mail-002");

    assert.equal(securityTicket.category, "security");
    assert.equal(securityTicket.priority, "critical");
    assert.equal(securityTicket.queue, "Security Response");
    assert.equal(securityTicket.slaHours, 4);
    assert.ok(securityTicket.tags.includes("has-attachments"));
  });

  it("normalizes reply prefixes and keeps source mail metadata", () => {
    const accessTicket = convertMailToTicket(sampleMessages[0]);

    assert.equal(accessTicket.title, "Urgent login access blocked");
    assert.equal(accessTicket.category, "access");
    assert.equal(accessTicket.priority, "high");
    assert.equal(accessTicket.source.threadId, "thread-access-001");
    assert.equal(accessTicket.source.senderEmail, "jordan@example.com");
    assert.ok(accessTicket.tags.includes("vip"));
  });

  it("allows local caller configuration without touching global defaults", () => {
    const ticket = convertMailToTicket(sampleMessages[4], {
      ticketIdPrefix: "case",
      queues: {
        support: "Triage",
      },
    });

    assert.equal(ticket.id, "case-mail-005");
    assert.equal(ticket.category, "support");
    assert.equal(ticket.priority, "low");
    assert.equal(ticket.queue, "Triage");
  });
});
