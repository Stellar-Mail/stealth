// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Topbar } from "@/components/mail/Topbar";
import { defaultMailFilters, emails } from "@/components/mail/data";

vi.mock("@/components/mail/TopbarSearch", () => ({
  TopbarSearch: () => <input aria-label="Search messages" />,
}));
vi.mock("@/components/mail/NotificationsPanel", () => ({ NotificationsPanel: () => null }));

afterEach(cleanup);

function topbarProps() {
  return {
    onOpenPalette: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenProofInspector: vi.fn(),
    onImportContacts: vi.fn(),
    onShowToast: vi.fn(),
    onOpenShortcuts: vi.fn(),
    filters: defaultMailFilters,
    onFiltersChange: vi.fn(),
    onViewNotifications: vi.fn(),
    notifications: [],
    onMarkNotificationRead: vi.fn(),
    onMarkAllNotificationsRead: vi.fn(),
    emails,
    onToggleWork: vi.fn(),
  };
}

describe("Compact glass navbar", () => {
  it("keeps Work and Notifications grouped with Personal and no extra toolbar actions", () => {
    render(<Topbar {...topbarProps()} />);
    const header = screen.getByRole("banner");
    expect(
      within(header)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Work", "Notifications", "Account menu"]);
    expect(header.className).toContain("h-12");
    const account = within(header).getByRole("button", { name: "Account menu" });
    expect(account.parentElement?.parentElement?.className).toContain("glass-tile");
    const avatar = account.querySelector("img");
    expect(avatar?.getAttribute("src")).toBe("/avatars/personal.svg");
    expect(avatar?.className).toContain("h-5 w-5");
    expect(within(header).queryByText("?")).toBeNull();
  });

  it.each([
    ["Settings", "onOpenSettings"],
    ["Import contacts", "onImportContacts"],
    ["Proof Inspector", "onOpenProofInspector"],
    ["Keyboard shortcuts", "onOpenShortcuts"],
    ["Command palette", "onOpenPalette"],
  ] as const)("preserves %s in the account menu", (label, callback) => {
    const props = topbarProps();
    render(<Topbar {...props} />);
    expect(screen.queryByRole("button", { name: label })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: label }));
    expect(props[callback]).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Account menu" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });
  it("opens filters from Personal and toggles Work independently of mail actions", () => {
    const props = topbarProps();
    render(<Topbar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Work" }));
    expect(props.onToggleWork).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Filter" }));
    expect(screen.getByRole("dialog", { name: "Filters" })).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Account menu" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });
});
