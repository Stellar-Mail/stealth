// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { EmailList } from "@/components/mail/EmailList";
import { EmailTrustBadges } from "@/components/mail/EmailTrustBadges";
import { defaultMailFilters, type Email } from "@/components/mail/data";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const email: Email = {
  id: "verified-sender",
  from: "Verified sender",
  email: "sender@example.com",
  subject: "A quiet inbox",
  preview: "Message preview",
  body: "Message body",
  time: "9:42 AM",
  unread: true,
  starred: false,
  folder: "inbox",
  avatarColor: "#789b47",
  verifiedSender: true,
};
const other: Email = {
  ...email,
  id: "unknown-sender",
  from: "Unknown sender",
  verifiedSender: false,
};

describe("Clean mail cards", () => {
  const listProps = {
    emails: [email, other],
    selectedId: email.id,
    onSelect: () => {},
    folder: "inbox" as const,
    filters: defaultMailFilters,
    showAvatars: true,
  };

  it("enters only the first loaded batch with a bounded stagger", () => {
    vi.useFakeTimers();
    const emails = Array.from({ length: 12 }, (_, index) => ({ ...email, id: `mail-${index}` }));
    const { container, rerender } = render(<EmailList {...listProps} emails={[]} />);
    const list = container.querySelector("section")!;
    act(() => vi.advanceTimersByTime(500));
    expect(list.dataset.entering).toBe("true");
    rerender(<EmailList {...listProps} emails={emails} />);
    const rows = container.querySelectorAll<HTMLElement>(".mail-list-row");
    expect(rows[0].style.getPropertyValue("--mail-enter-delay")).toBe("0ms");
    expect(rows[1].style.getPropertyValue("--mail-enter-delay")).toBe("24ms");
    expect(rows[11].style.getPropertyValue("--mail-enter-delay")).toBe("96ms");
    act(() => vi.advanceTimersByTime(280));
    expect(list.dataset.entering).toBe("false");
    rerender(<EmailList {...listProps} emails={[other]} selectedId={other.id} />);
    expect(list.dataset.entering).toBe("false");
  });

  it("cancels the entrance on scroll without replaying it for new rows", () => {
    const { container, getByRole, rerender } = render(<EmailList {...listProps} />);
    const section = container.querySelector("section")!;
    expect(section.dataset.entering).toBe("true");
    fireEvent.scroll(getByRole("list"), { target: { scrollTop: 400 } });
    expect(section.dataset.entering).toBe("false");
    rerender(<EmailList {...listProps} emails={[{ ...other, id: "new-row" }]} />);
    expect(section.dataset.entering).toBe("false");
  });

  it("keeps keyboard interaction immediate and resumes press feedback for pointer input", () => {
    const { container } = render(<EmailList {...listProps} />);
    const section = container.querySelector("section")!;
    const card = container.querySelector<HTMLButtonElement>("[data-email-id]")!;
    fireEvent.keyDown(card, { key: "Enter" });
    expect(section.dataset.motionInput).toBe("keyboard");
    expect(section.dataset.entering).toBe("false");
    fireEvent.pointerDown(card);
    expect(section.dataset.motionInput).toBe("pointer");
    expect(section.dataset.entering).toBe("false");
  });

  it("preserves mobile actions without opening the message", () => {
    const onSelect = vi.fn();
    const onStar = vi.fn();
    const onSnooze = vi.fn();
    const onArchive = vi.fn();
    const { container, getByRole } = render(
      <EmailList
        {...listProps}
        emails={[email]}
        useMobile
        onSelect={onSelect}
        onStar={onStar}
        onSnooze={onSnooze}
        onArchive={onArchive}
      />,
    );
    fireEvent.click(getByRole("button", { name: "Star" }));
    fireEvent.click(getByRole("button", { name: "Snooze" }));
    fireEvent.click(getByRole("button", { name: "Archive" }));
    expect(onStar).toHaveBeenCalledExactlyOnceWith(email);
    expect(onSnooze).toHaveBeenCalledExactlyOnceWith(email);
    expect(onArchive).toHaveBeenCalledExactlyOnceWith(email);
    expect(onSelect).not.toHaveBeenCalled();
    const card = container.querySelector<HTMLButtonElement>("[data-email-id]")!;
    expect(card.getAttribute("aria-current")).toBe("true");
    fireEvent.click(card);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(email.id);
  });

  it("selects once per click and retains the selected row independently of hover", () => {
    const props = {
      emails: [email, other],
      selectedId: email.id,
      onSelect: vi.fn(),
      folder: "inbox" as const,
      filters: defaultMailFilters,
      showAvatars: true,
    };
    const { container, rerender } = render(<EmailList {...props} />);
    const first = container.querySelector<HTMLButtonElement>(`[data-email-id="${email.id}"]`)!;
    const second = container.querySelector<HTMLButtonElement>(`[data-email-id="${other.id}"]`)!;
    expect(first.className).toContain("mail-preview-card--active");
    fireEvent.pointerDown(second);
    fireEvent.click(second);
    expect(props.onSelect).toHaveBeenCalledExactlyOnceWith(other.id);
    rerender(<EmailList {...props} selectedId={other.id} />);
    fireEvent.mouseLeave(second);
    expect(second.getAttribute("aria-current")).toBe("true");
    expect(second.className).toContain("mail-preview-card--active");
    expect(first.className).not.toContain("mail-preview-card--active");
    expect(container.querySelector(".mail-preview-card__verified-effect")).toBeNull();
    expect(container.querySelector(".mail-preview-card--verified")).toBeNull();
    expect(first.className).toContain("h-[60px]");
    expect(second.className).toContain("h-[60px]");
  });

  it("shows a standalone verified mark even when the sender is also allowed", () => {
    const { container } = render(
      <EmailTrustBadges email={{ ...email, senderPolicy: "allow" }} showLabels={false} max={1} />,
    );
    const check = container.querySelector(".verified-check");
    expect(check?.getAttribute("aria-label")).toBe("Verified");
    expect(check?.className).not.toMatch(/border|rounded|bg-/);
    expect(check?.querySelector("svg")).not.toBeNull();
  });

  it("keeps nonverified trust details out of compact rows without removing detailed badges", () => {
    const { container, rerender } = render(<EmailTrustBadges email={other} showLabels={false} />);
    expect(container.textContent).toBe("");
    expect(container.querySelector("svg")).toBeNull();
    rerender(<EmailTrustBadges email={other} showLabels />);
    expect(container.textContent).toBe("Unknown");
  });
});
