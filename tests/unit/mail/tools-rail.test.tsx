// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MailToolsRail } from "@/features/mail/tools/MailToolsRail";
import { useWorkSession } from "@/features/work/model";
import type { Email } from "@/components/mail/data";

vi.mock("@/features/mail/useContacts", () => ({
  useContacts: () => ({ data: { items: [] }, isLoading: false, isError: false }),
}));
afterEach(cleanup);
const email: Email = {
  id: "mail-1",
  from: "Lina Park",
  email: "lina*studio",
  subject: "Review the design",
  preview: "Review",
  body: "Review",
  time: "Now",
  folder: "inbox",
  unread: false,
  starred: false,
  avatarColor: "#555",
  attachments: [{ name: "design.pdf", type: "pdf", size: "1 MB" }],
};

function setup(workEnabled = false) {
  const props = {
    actor: null,
    emails: [email],
    selected: email,
    events: [],
    workEnabled,
    onOpenCalendar: vi.fn(),
    onOpenEmail: vi.fn(),
    onCompose: vi.fn(),
    onImportContacts: vi.fn(),
    onToggleSaved: vi.fn(),
    onSnooze: vi.fn(),
    onOpenProofInspector: vi.fn(),
  };
  function Harness() {
    const work = useWorkSession("demo:test");
    return <MailToolsRail {...props} session={work.session} update={work.update} />;
  }
  render(<Harness />);
  return props;
}

describe("Contextual mail tools", () => {
  it("keeps Work-only tools out of Personal and opens the real calendar", () => {
    const props = setup();
    expect(screen.queryByRole("button", { name: "Open tasks tool" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open calendar tool" }));
    fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
    expect(props.onOpenCalendar).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region", { name: "Calendar tool" })).toBeNull();
  });

  it("composes to mailbox people and opens the attachment's actual message", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Open people tool" }));
    fireEvent.click(screen.getByRole("button", { name: "Write to Lina Park" }));
    expect(props.onCompose).toHaveBeenCalledWith("lina*studio");
    fireEvent.click(screen.getByRole("button", { name: "Open files tool" }));
    fireEvent.click(screen.getByRole("button", { name: /design.pdf/ }));
    expect(props.onOpenEmail).toHaveBeenCalledWith(email);
  });

  it("closes with Escape, restores focus and can collapse the rail", () => {
    setup();
    const trigger = screen.getByRole("button", { name: "Open calendar tool" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("region", { name: "Calendar tool" }), { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Hide tools rail" }));
    expect(screen.queryByRole("button", { name: "Open calendar tool" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show tools rail" }));
    expect(screen.getByRole("button", { name: "Open calendar tool" })).toBeDefined();
  });

  it("connects the added tools to existing mail actions", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Open saved mail tool" }));
    fireEvent.click(screen.getByRole("button", { name: "Save current mail" }));
    expect(props.onToggleSaved).toHaveBeenCalledWith(email);

    fireEvent.click(screen.getByRole("button", { name: "Open follow-ups tool" }));
    fireEvent.click(screen.getByRole("button", { name: "Set a reminder for this mail" }));
    expect(props.onSnooze).toHaveBeenCalledWith(email);
    expect(screen.queryByRole("region", { name: "Follow-ups tool" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open proofs tool" }));
    fireEvent.click(screen.getByRole("button", { name: "Open proof inspector" }));
    expect(props.onOpenProofInspector).toHaveBeenCalledWith();
    expect(screen.queryByRole("region", { name: "Proofs tool" })).toBeNull();
  });

  it("creates a linked Work task, completes it and deletes it", () => {
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Open tasks tool" }));
    fireEvent.click(screen.getByRole("button", { name: "Make this mail a task" }));
    const checkbox = screen.getByRole("checkbox", {
      name: "Complete Review the design",
    }) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete Review the design" }));
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("adds a private note tied to the open conversation", async () => {
    setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Open private notes tool" }));
    await vi.dynamicImportSettled();
    const input = await screen.findByLabelText("Add a private note");
    fireEvent.change(input, { target: { value: "Check spacing before replying" } });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    expect(
      within(screen.getByRole("list", { name: "Conversation notes" })).getByText(
        "Check spacing before replying",
      ),
    ).toBeDefined();
  });
});
