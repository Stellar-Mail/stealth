import { describe, expect, it } from "vitest";
import {
  buildTaskDraft,
  describeConverter,
  detectPriority,
  hasConvertibleContent,
  resolveStatusMessage,
  suggestDueDate,
  DEFAULT_DUE_DATE_OFFSET_DAYS,
  HIGH_PRIORITY_DUE_DATE_OFFSET_DAYS,
  type NormalizedEmail,
} from "../ui/emailToTodoView";

function baseEmail(overrides: Partial<NormalizedEmail> = {}): NormalizedEmail {
  return {
    subject: "Project kickoff notes",
    sender: "alex@example.com",
    receivedAt: "2026-01-10T09:00:00.000Z",
    body: "Please review the attached plan and reply with feedback.",
    labels: ["work"],
    ...overrides,
  };
}

describe("detectPriority", () => {
  it("returns high when an urgent keyword is present", () => {
    expect(detectPriority(baseEmail({ subject: "URGENT: sign the contract" }))).toBe("high");
  });

  it("returns normal when no urgent keyword is present", () => {
    expect(detectPriority(baseEmail({ subject: "Lunch menu", body: "Soup and salad." }))).toBe(
      "normal",
    );
  });
});

describe("suggestDueDate", () => {
  it("uses the high-priority offset for high-priority emails", () => {
    expect(suggestDueDate(baseEmail(), "high")).toBe("2026-01-11");
    expect(HIGH_PRIORITY_DUE_DATE_OFFSET_DAYS).toBe(1);
  });

  it("uses the default offset for lower priorities", () => {
    expect(suggestDueDate(baseEmail(), "normal")).toBe("2026-01-13");
    expect(DEFAULT_DUE_DATE_OFFSET_DAYS).toBe(3);
  });

  it("returns an empty string for an unparseable timestamp", () => {
    expect(suggestDueDate(baseEmail({ receivedAt: "not-a-date" }), "normal")).toBe("");
  });

  it("uses an explicit due date when one is present", () => {
    expect(
      suggestDueDate(
        baseEmail({
          subject: "Please review the invoice by Friday",
          body: "Please review the attached invoice by Friday and let me know if anything is missing.",
        }),
        "normal",
      ),
    ).toBe("2026-01-16");
  });
});

describe("buildTaskDraft", () => {
  it("builds a deterministic draft from a normalized email", () => {
    const email = baseEmail();
    expect(buildTaskDraft(email)).toEqual(buildTaskDraft(email));
    const draft = buildTaskDraft(email);
    expect(draft.title).toBe("Project kickoff notes");
    expect(draft.sourceSender).toBe("alex@example.com");
    expect(draft.suggestedPriority).toBe("normal");
  });

  it("preserves the source email id when present", () => {
    const draft = buildTaskDraft(baseEmail({ id: "email-direct-request" }));
    expect(draft.sourceEmailId).toBe("email-direct-request");
  });

  it("extracts a title from a direct request in the subject", () => {
    const draft = buildTaskDraft(
      baseEmail({
        subject: "Please review the invoice by Friday",
        body: "Please review the attached invoice by Friday and let me know if anything is missing.",
      }),
    );
    expect(draft.title).toBe("Review the invoice");
    expect(draft.suggestedDueDate).toBe("2026-01-17");
  });

  it("uses the first actionable sentence in the body when the subject is generic", () => {
    const draft = buildTaskDraft(
      baseEmail({
        subject: "Weekly product updates",
        body: "Here are this week's product updates.\nPlease follow up with the partner today.",
      }),
    );
    expect(draft.title).toBe("Follow up with the partner");
    expect(draft.suggestedDueDate).toBe("2026-01-10");
  });

  it("strips trailing deadline words from a body-derived title", () => {
    const draft = buildTaskDraft(
      baseEmail({
        subject: "Weekly product updates",
        body: "Please call the bank today.",
      }),
    );
    expect(draft.title).toBe("Call the bank");
  });

  it("falls back to a placeholder when subject and body are empty", () => {
    expect(buildTaskDraft(baseEmail({ subject: "", body: "" })).title).toBe("Untitled task");
  });
});

describe("hasConvertibleContent", () => {
  it("is false for null", () => {
    expect(hasConvertibleContent(null)).toBe(false);
  });

  it("is false when subject and body are blank", () => {
    expect(hasConvertibleContent(baseEmail({ subject: "  ", body: "  " }))).toBe(false);
  });

  it("is true when there is a subject", () => {
    expect(hasConvertibleContent(baseEmail({ body: "" }))).toBe(true);
  });
});

describe("describeConverter", () => {
  it("shows the empty state when there is no email", () => {
    const view = describeConverter({ status: "empty", hasEmail: false });
    expect(view.showEmptyState).toBe(true);
    expect(view.canConvert).toBe(false);
  });

  it("allows converting when an email is ready", () => {
    const view = describeConverter({ status: "ready", hasEmail: true });
    expect(view.canConvert).toBe(true);
    expect(view.isBusy).toBe(false);
  });

  it("marks busy while loading", () => {
    const view = describeConverter({ status: "loading", hasEmail: true });
    expect(view.isBusy).toBe(true);
    expect(view.canConvert).toBe(false);
  });

  it("shows the draft on success and the error on failure", () => {
    expect(describeConverter({ status: "success", hasEmail: true }).showDraft).toBe(true);
    expect(describeConverter({ status: "error", hasEmail: true }).showError).toBe(true);
  });
});

describe("resolveStatusMessage", () => {
  it("returns a distinct message for each status", () => {
    const statuses = ["empty", "ready", "loading", "success", "error"] as const;
    const messages = statuses.map((status) => resolveStatusMessage(status));
    expect(new Set(messages).size).toBe(statuses.length);
  });
});
