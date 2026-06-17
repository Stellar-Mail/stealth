import { describe, expect, it } from "vitest";

import type { Email, MailLocation } from "../../../src/components/mail/data";
import {
  buildCommands,
  type CommandContext,
  type CommandId,
} from "../../../src/features/command-palette/types";
import {
  buildPaletteModel,
  fuzzyScore,
  selectableRows,
} from "../../../src/features/command-palette/search";

const email = (over: Partial<Email> = {}): Email => ({
  id: "1",
  from: "Lina Park",
  email: "lina*vantage.studio",
  subject: "Q2 brand system",
  preview: "preview",
  body: "body",
  time: "9:42 AM",
  unread: false,
  starred: false,
  folder: "inbox" as MailLocation,
  avatarColor: "#5b6470",
  ...over,
});

const ctxOf = (over: Partial<CommandContext> = {}): CommandContext => ({
  email: null,
  folder: "inbox",
  ...over,
});

const availability = (ctx: CommandContext) => {
  const map = new Map<CommandId, { enabled: boolean; help?: string }>();
  for (const command of buildCommands(ctx)) {
    map.set(
      command.id,
      command.availability.enabled
        ? { enabled: true }
        : { enabled: false, help: command.availability.help },
    );
  }
  return map;
};

// ---------------------------------------------------------------------------
// Contextual availability — commands reflect the selected message + folder
// ---------------------------------------------------------------------------
describe("buildCommands availability", () => {
  it("disables message commands with help when nothing is selected", () => {
    const a = availability(ctxOf({ email: null }));
    for (const id of [
      "approve-sender",
      "block-sender",
      "quote-postage",
      "inspect-proof",
      "settle-delivery",
      "refund-postage",
      "archive-thread",
    ] as CommandId[]) {
      expect(a.get(id)?.enabled).toBe(false);
      expect(a.get(id)?.help).toBeTruthy();
    }
    // Global commands stay enabled.
    for (const id of [
      "compose",
      "open-calendar",
      "open-settings",
      "open-shortcuts",
      "go-inbox",
      "relay-diagnostics",
    ] as CommandId[]) {
      expect(a.get(id)?.enabled).toBe(true);
    }
  });

  it("enables approve/block/refund for a paid request", () => {
    const a = availability(
      ctxOf({
        email: email({ folder: "requests", labels: ["Request", "Paid"] }),
        folder: "requests",
      }),
    );
    expect(a.get("approve-sender")?.enabled).toBe(true);
    expect(a.get("block-sender")?.enabled).toBe(true);
    expect(a.get("refund-postage")?.enabled).toBe(true);
    // Settle does not apply to a request.
    expect(a.get("settle-delivery")?.enabled).toBe(false);
  });

  it("reflects an already-approved or already-blocked sender", () => {
    expect(
      availability(ctxOf({ email: email({ senderPolicy: "allow" }) })).get("approve-sender"),
    ).toEqual({ enabled: false, help: "This sender is already approved." });
    expect(
      availability(ctxOf({ email: email({ senderPolicy: "block" }) })).get("block-sender"),
    ).toEqual({ enabled: false, help: "This sender is already blocked." });
  });

  it("enables settle only for delivery folders", () => {
    expect(
      availability(ctxOf({ email: email({ folder: "pending" }) })).get("settle-delivery")?.enabled,
    ).toBe(true);
    expect(
      availability(ctxOf({ email: email({ folder: "inbox" }) })).get("settle-delivery")?.enabled,
    ).toBe(false);
  });

  it("disables archive when already archived", () => {
    expect(
      availability(ctxOf({ email: email({ folder: "archive" }) })).get("archive-thread")?.enabled,
    ).toBe(false);
  });

  it("marks block and refund as dangerous with confirmation copy", () => {
    const commands = buildCommands(ctxOf({ email: email({ folder: "requests" }) }));
    const block = commands.find((c) => c.id === "block-sender")!;
    const refund = commands.find((c) => c.id === "refund-postage")!;
    expect(block.dangerous).toBe(true);
    expect(block.confirm?.confirmLabel).toBeTruthy();
    expect(refund.dangerous).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fuzzy search
// ---------------------------------------------------------------------------
describe("fuzzyScore", () => {
  it("matches everything for an empty query", () => {
    expect(fuzzyScore("", "Archive thread")).toBe(0);
  });

  it("returns -1 when the query is not a subsequence", () => {
    expect(fuzzyScore("xyz", "Archive thread")).toBe(-1);
  });

  it("scores consecutive matches above scattered ones", () => {
    expect(fuzzyScore("arc", "Archive")).toBeGreaterThan(fuzzyScore("aie", "Archive"));
  });

  it("rewards word-boundary matches", () => {
    expect(fuzzyScore("send", "Approve sender")).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Palette model
// ---------------------------------------------------------------------------
describe("buildPaletteModel", () => {
  const emails = [
    email({ id: "1", from: "Lina Park", email: "lina*vantage.studio" }),
    email({ id: "5", from: "Unknown Sender", email: "GCKN...N4XQ", folder: "requests" }),
  ];

  it("shows contextual command groups for an empty query", () => {
    const sections = buildPaletteModel(ctxOf({ email: emails[0] }), "", emails);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every((s) => s.rows.every((r) => r.type === "command"))).toBe(true);
    // Protocol group surfaces first.
    expect(sections[0].title).toBe("Sender & proof");
  });

  it("fuzzy-finds folders by name", () => {
    const sections = buildPaletteModel(ctxOf(), "spam", emails);
    const folders = sections.find((s) => s.id === "folders");
    expect(folders?.rows.some((r) => r.type === "folder" && r.folder === "spam")).toBe(true);
  });

  it("fuzzy-finds senders", () => {
    const sections = buildPaletteModel(ctxOf(), "lina", emails);
    const senders = sections.find((s) => s.id === "senders");
    expect(senders?.rows.some((r) => r.type === "sender")).toBe(true);
  });

  it("excludes disabled commands from keyboard-selectable rows", () => {
    const sections = buildPaletteModel(ctxOf({ email: null }), "", emails);
    const selectable = selectableRows(sections);
    const hasDisabled = selectable.some(
      (row) => row.type === "command" && !row.command.availability.enabled,
    );
    expect(hasDisabled).toBe(false);
  });
});
