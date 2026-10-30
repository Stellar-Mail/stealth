// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { EmailView } from "@/components/mail/EmailView";
import type { Email } from "@/components/mail/data";
import { useMailNavigation } from "@/features/mail/useMailNavigation";

afterEach(cleanup);

const first: Email = {
  id: "private-first",
  from: "First sender",
  email: "first@example.com",
  subject: "Private first subject",
  preview: "Preview",
  body: "PRIVATE FIRST BODY",
  time: "Now",
  unread: true,
  starred: false,
  folder: "inbox",
  avatarColor: "#789b47",
  labels: ["Personal"],
};
const fifth: Email = {
  ...first,
  id: "chosen-fifth",
  from: "Chosen sender",
  subject: "Chosen message",
  body: "CHOSEN BODY",
};

describe("Explicit reader selection", () => {
  it("stays private on initial load, async data arrival, and refresh", () => {
    const { result, rerender } = renderHook(({ emails }) => useMailNavigation(emails), {
      initialProps: { emails: [] as Email[] },
    });
    expect(result.current.selectedId).toBeNull();
    rerender({ emails: [first, fifth] });
    expect(result.current.selected).toBeNull();
    rerender({ emails: [{ ...first }, { ...fifth }] });
    expect(result.current.selectedId).toBeNull();
    act(() => result.current.openMessage(fifth));
    expect(result.current.selected?.id).toBe(fifth.id);
    rerender({ emails: [{ ...first }, { ...fifth, starred: true }] });
    expect(result.current.selected?.id).toBe(fifth.id);
  });

  it("clears selection when a message is removed without opening its neighbor", () => {
    const { result, rerender } = renderHook(({ emails }) => useMailNavigation(emails), {
      initialProps: { emails: [first, fifth] },
    });
    act(() => result.current.openMessage(fifth));
    rerender({ emails: [first] });
    expect(result.current.selectedId).toBeNull();
    expect(result.current.selected).toBeNull();
    rerender({ emails: [first, fifth] });
    expect(result.current.selected).toBeNull();
  });

  it("keeps ordinary folders, custom folders, and close private", () => {
    const { result } = renderHook(() => useMailNavigation([first, fifth]));
    act(() => result.current.openMessage(fifth));
    act(() => result.current.selectFolder("all"));
    expect(result.current.selected).toBeNull();
    act(() => result.current.openMessage(fifth));
    act(() => result.current.setCustomFolder("Personal"));
    expect(result.current.visibleEmails.length).toBe(2);
    expect(result.current.selected).toBeNull();
    act(() => result.current.openMessage(fifth));
    act(() => result.current.closeMessage());
    expect(result.current.selected).toBeNull();
    expect(result.current.mobileView).toBe("list");
  });
});

describe("Reader hierarchy", () => {
  it("does not leave private message content mounted during an exit animation", () => {
    const { rerender } = render(<EmailView email={fifth} />);
    expect(screen.getByText(fifth.body)).not.toBeNull();
    rerender(<EmailView email={null} />);
    expect(screen.queryByText(fifth.body)).toBeNull();
    expect(screen.queryByRole("heading", { name: fifth.subject })).toBeNull();
    expect(screen.getByRole("heading", { name: "Open only what you choose." })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
  });

  it("opens the working reply composer directly, not a submenu or an unwired inline form", () => {
    const onReply = vi.fn();
    const onForward = vi.fn();
    render(<EmailView email={fifth} actions={{ onReply, onForward }} />);
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(onReply).toHaveBeenCalledExactlyOnceWith(fifth);
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(onForward).toHaveBeenCalledExactlyOnceWith(fifth);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("keeps clearly named management tools connected to their handlers", () => {
    const onArchive = vi.fn();
    const onTrash = vi.fn();
    const onMarkUnread = vi.fn();
    const onBack = vi.fn();
    render(<EmailView email={fifth} actions={{ onArchive, onTrash, onMarkUnread, onBack }} />);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark as unread" }));
    fireEvent.click(screen.getByRole("button", { name: "Close conversation" }));
    expect(onArchive).toHaveBeenCalledExactlyOnceWith(fifth);
    expect(onTrash).toHaveBeenCalledExactlyOnceWith(fifth);
    expect(onMarkUnread).toHaveBeenCalledExactlyOnceWith(fifth);
    expect(onBack).toHaveBeenCalledOnce();
  });
});
