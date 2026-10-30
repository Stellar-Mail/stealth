// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";

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
  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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
          actor={null}
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

  it("opens a non-modal dropdown without covering the input", () => {
    renderComponent();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/Unlocked message bodies/i)).toBeDefined();
    expect(document.querySelector(".fixed.inset-0")).toBeNull();
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

    renderComponent({ actor: "actor-1" });
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

  it("applies sender-only filters and opens the result with the keyboard", async () => {
    const onSelectEmail = vi.fn();
    renderComponent({ onSelectEmail });
    fireEvent.click(screen.getByRole("button", { name: "Search filters" }));
    fireEvent.change(screen.getByLabelText("From", { exact: true }), {
      target: { value: "marcus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search mail" }));
    await screen.findByRole("option", { name: /Protocol Architecture Review/i });
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe("mail-search-option-0");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelectEmail).toHaveBeenCalledWith("mail-1", "inbox");
  });

  it("keeps accepting input after opening and clears query and filters together", () => {
    vi.useFakeTimers();
    renderComponent();
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Architecture" } });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByRole("option", { name: /Protocol.*Architecture.*Review/i })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Attachments" }));
    expect(screen.queryByRole("option")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear search text" }));
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Reset filters")).toBeNull();
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
