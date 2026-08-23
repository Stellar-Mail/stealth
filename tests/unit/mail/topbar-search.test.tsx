// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { TopbarSearch, HighlightedText } from "../../../src/components/mail/TopbarSearch";
import type { Email } from "../../../src/components/mail/data";

function mockLocalStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}

const mockEmails: Email[] = [
  {
    id: "mail-1",
    from: "Marcus Chen",
    email: "marcus@stealth.xyz",
    subject: "Protocol Architecture Review",
    preview: "Follow up on the Stellar postage memo verification.",
    body: "Follow up on the Stellar postage memo verification.",
    time: "10:30 AM",
    unread: true,
    starred: false,
    folder: "inbox",
    avatarColor: "#000",
  },
];

describe("TopbarSearch Component (Issue #1972 / BETA-065)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockLocalStorage();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof TopbarSearch>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TopbarSearch
          actor="actor-1"
          emails={mockEmails}
          onOpenPalette={vi.fn()}
          onSelectEmail={vi.fn()}
          {...props}
        />
      </QueryClientProvider>,
    );
  };

  it("renders search input with accessibility attributes and placeholder", () => {
    renderComponent();
    const input = screen.getByRole("combobox", { name: /search messages/i });
    expect(input).toBeDefined();
    expect(input.getAttribute("placeholder")).toContain("Search messages, contacts, drafts");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens dropdown on focus and shows privacy notice banner", () => {
    renderComponent();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/Privacy-Safe Index:/i)).toBeDefined();
  });

  it("shows filter pills and allows toggling filters", () => {
    renderComponent();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    const unreadPill = screen.getByRole("button", { name: /Unread/i });
    expect(unreadPill).toBeDefined();
    fireEvent.click(unreadPill);

    const resetFiltersBtn = screen.getByText(/Reset filters/i);
    expect(resetFiltersBtn).toBeDefined();
    fireEvent.click(resetFiltersBtn);
  });

  it("renders recent search history and allows clearing", () => {
    localStorage.setItem(
      "stealth:search_history:actor-1",
      JSON.stringify(["quarterly roadmap", "postage quote"]),
    );

    renderComponent();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    expect(screen.getByText("quarterly roadmap")).toBeDefined();
    expect(screen.getByText("postage quote")).toBeDefined();

    const clearAllBtn = screen.getByRole("button", { name: /Clear All/i });
    fireEvent.click(clearAllBtn);

    expect(screen.queryByText("quarterly roadmap")).toBeNull();
  });

  it("closes dropdown on Escape key", () => {
    renderComponent();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(input.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  describe("HighlightedText helper", () => {
    it("highlights matching keywords in text", () => {
      const { container } = render(
        <HighlightedText text="Stellar Postage Verification" query="Postage" />,
      );
      const mark = container.querySelector("mark");
      expect(mark).toBeDefined();
      expect(mark?.textContent).toBe("Postage");
    });

    it("renders plain text when query is empty", () => {
      const { container } = render(<HighlightedText text="Plain Unmatched Text" query="" />);
      expect(container.querySelector("mark")).toBeNull();
      expect(container.textContent).toBe("Plain Unmatched Text");
    });
  });
});
