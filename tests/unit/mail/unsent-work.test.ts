import { describe, expect, it } from "vitest";

import {
  clearUnsentDraft,
  isDraftEmpty,
  memoryStorage,
  readUnsentDraft,
  restoreDraftIfBlank,
  saveUnsentDraft,
  UNSENT_DRAFT_STORAGE_KEY,
} from "@/features/mail/unsent-work";

describe("unsent work (BETA-071)", () => {
  it("saves, restores, and clears a compose draft", () => {
    const storage = memoryStorage();
    const saved = saveUnsentDraft(
      { to: "ada@example.com", subject: "Hello", body: "Draft body", postage: "0.0001" },
      storage,
      () => "2026-08-20T12:00:00.000Z",
    );
    expect(saved?.updatedAt).toBe("2026-08-20T12:00:00.000Z");
    expect(readUnsentDraft(storage)).toEqual(saved);
    clearUnsentDraft(storage);
    expect(readUnsentDraft(storage)).toBeNull();
  });

  it("does not overwrite reply or forward initials with a stored draft", () => {
    const stored = {
      to: "stored@example.com",
      subject: "Stored",
      body: "kept locally",
      postage: "0.0001",
      updatedAt: "2026-08-20T12:00:00.000Z",
    };
    const reply = restoreDraftIfBlank(
      { to: "ada@example.com", subject: "Re: Hello", body: "quoted" },
      stored,
    );
    expect(reply.restored).toBe(false);
    expect(reply.to).toBe("ada@example.com");
    expect(reply.body).toBe("quoted");
  });

  it("restores a stored draft only when compose opens blank", () => {
    const stored = {
      to: "stored@example.com",
      subject: "Stored",
      body: "kept locally",
      postage: "0.0002",
      updatedAt: "2026-08-20T12:00:00.000Z",
    };
    const blank = restoreDraftIfBlank({ to: "", subject: "", body: "" }, stored);
    expect(blank).toEqual({
      to: "stored@example.com",
      subject: "Stored",
      body: "kept locally",
      postage: "0.0002",
      restored: true,
    });
  });

  it("clears storage when the draft is empty so failure never implies a send", () => {
    const storage = memoryStorage({
      [UNSENT_DRAFT_STORAGE_KEY]: JSON.stringify({
        to: "ada@example.com",
        subject: "Hello",
        body: "Draft",
        postage: "0.0001",
        updatedAt: "2026-08-20T12:00:00.000Z",
      }),
    });
    expect(isDraftEmpty({ to: "  ", subject: "", body: "" })).toBe(true);
    expect(
      saveUnsentDraft({ to: "", subject: "", body: "", postage: "0.0001" }, storage),
    ).toBeNull();
    expect(readUnsentDraft(storage)).toBeNull();
  });
});
