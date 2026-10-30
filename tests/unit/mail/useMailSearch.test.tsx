// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { useMailSearch } from "../../../src/features/mail/useMailSearch";
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  mergeSearchResults,
  removeSearchHistory,
  searchLocalEmails,
} from "../../../src/features/mail/searchApi";
import type { Email } from "../../../src/components/mail/data";
import { parseSearchQuery } from "../../../src/server/api/search-service";
import type { SearchResultItemDto } from "../../../src/lib/api";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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
    from: "Alice Smith",
    email: "alice@stealth.xyz",
    subject: "Zero-Knowledge Proofs Roadmap",
    preview: "Here are the notes on zk-SNARKs and verification circuits.",
    body: "Here are the notes on zk-SNARKs and verification circuits. We should pair tomorrow.",
    time: "10:00 AM",
    unread: true,
    starred: false,
    folder: "inbox",
    avatarColor: "#000",
    labels: ["Engineering"],
  },
  {
    id: "mail-2",
    from: "Bob Jones",
    email: "bob@northwind.io",
    subject: "Budget Allocations Q3",
    preview: "Attached spreadsheet with marketing spend.",
    body: "Attached spreadsheet with marketing spend.",
    time: "Yesterday",
    unread: false,
    starred: true,
    folder: "archive",
    attachments: [{ name: "budget.xlsx", size: "12 KB", type: "application/vnd.ms-excel" }],
    avatarColor: "#111",
  },
];

describe("Client Search Logic (Issue #1972 / BETA-065)", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  describe("Search History Storage", () => {
    it("reads empty history initially", () => {
      const history = getSearchHistory("actor-1");
      expect(history).toEqual([]);
    });

    it("adds search terms and deduplicates case-insensitively in MRU order", () => {
      addSearchHistory("actor-1", "zk-proofs");
      addSearchHistory("actor-1", "budget");
      addSearchHistory("actor-1", "ZK-PROOFS");

      const history = getSearchHistory("actor-1");
      expect(history).toEqual(["ZK-PROOFS", "budget"]);
    });

    it("removes individual search history items", () => {
      addSearchHistory("actor-1", "zk-proofs");
      addSearchHistory("actor-1", "budget");
      removeSearchHistory("actor-1", "zk-proofs");

      const history = getSearchHistory("actor-1");
      expect(history).toEqual(["budget"]);
    });

    it("clears all search history", () => {
      addSearchHistory("actor-1", "zk-proofs");
      addSearchHistory("actor-1", "budget");
      clearSearchHistory("actor-1");

      const history = getSearchHistory("actor-1");
      expect(history).toEqual([]);
    });
  });

  describe("Local Plaintext Search", () => {
    it.each([
      ["from:alice", ["mail-1"]],
      ["has:attachment", ["mail-2"]],
      ["is:read", ["mail-2"]],
    ])("supports directive-only queries: %s", (query, ids) => {
      expect(searchLocalEmails(mockEmails, parseSearchQuery(query)).map((item) => item.id)).toEqual(
        ids,
      );
    });

    it("uses original timestamps and excludes unknown dates and deleted mail", () => {
      const mail: Email[] = [
        { ...mockEmails[0], receivedAt: "2026-10-01T12:00:00Z" },
        { ...mockEmails[1], receivedAt: "2026-09-01T12:00:00Z" },
        { ...mockEmails[0], id: "deleted", folder: "trash" },
      ];
      expect(
        searchLocalEmails(mail, parseSearchQuery("after:2026-09-30")).map((item) => item.id),
      ).toEqual(["mail-1"]);
      expect(searchLocalEmails(mail, parseSearchQuery("Roadmap")).map((item) => item.id)).toEqual([
        "mail-1",
      ]);
      expect(searchLocalEmails(mail, parseSearchQuery("in:trash")).map((item) => item.id)).toEqual([
        "deleted",
      ]);
    });
    it("searches decrypted message bodies and subjects locally", () => {
      const parsed = parseSearchQuery("circuits");
      const results = searchLocalEmails(mockEmails, parsed);

      expect(results.length).toBe(1);
      expect(results[0].id).toBe("mail-1");
      expect(results[0].subject).toBe("Zero-Knowledge Proofs Roadmap");
      expect(results[0].highlights.length).toBeGreaterThan(0);
    });

    it("applies filters (folder, unread, attachments) on local search", () => {
      const parsed = parseSearchQuery("folder:inbox is:unread Roadmap");
      const results = searchLocalEmails(mockEmails, parsed);

      expect(results.length).toBe(1);
      expect(results[0].id).toBe("mail-1");

      const nonMatchParsed = parseSearchQuery("folder:archive is:unread Roadmap");
      const nonMatchResults = searchLocalEmails(mockEmails, nonMatchParsed);
      expect(nonMatchResults.length).toBe(0);
    });

    it("merges local decrypted matches with server metadata results deduplicating by ID", () => {
      const serverItems: SearchResultItemDto[] = [
        {
          type: "message",
          id: "mail-1",
          senderId: "alice@stealth.xyz",
          recipientId: "me",
          folder: "inbox",
          subject: "Encrypted message",
          preview: "Encrypted payload",
          createdAt: new Date().toISOString(),
          unread: true,
          starred: false,
          hasAttachments: false,
          isTombstone: false,
          highlights: [],
        },
        {
          type: "message",
          id: "server-only-mail",
          senderId: "carol@stealth.xyz",
          recipientId: "me",
          folder: "inbox",
          subject: "Server Metadata Subject",
          preview: "Server Metadata Preview",
          createdAt: new Date().toISOString(),
          unread: false,
          starred: false,
          hasAttachments: false,
          isTombstone: false,
          highlights: [],
        },
      ];

      const merged = mergeSearchResults(serverItems, mockEmails, "Roadmap");
      expect(merged.length).toBe(2);
      // Local decrypted item has richer subject & body preview
      const mail1 = merged.find((m) => m.id === "mail-1");
      expect(mail1?.subject).toBe("Zero-Knowledge Proofs Roadmap");
    });
  });

  describe("useMailSearch Hook", () => {
    it("does not discard explicit filters when merging local matches", () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
      const { result, unmount } = renderHook(
        () => useMailSearch({ actor: null, emails: mockEmails }),
        { wrapper },
      );
      act(() => result.current.setFilters({ hasAttachments: true }));
      expect(result.current.results.map((item) => item.id)).toEqual(["mail-2"]);
      act(() => result.current.setFilters({ sender: "alice", unread: false }));
      expect(result.current.results).toEqual([]);
      unmount();
      queryClient.clear();
    });
    it("manages query state and debouncing", async () => {
      vi.useFakeTimers();
      const queryClient = new QueryClient();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(
        () =>
          useMailSearch({
            actor: "actor-1",
            emails: mockEmails,
            debounceMs: 100,
          }),
        { wrapper },
      );

      act(() => {
        result.current.setRawQuery("Roadmap");
      });

      expect(result.current.rawQuery).toBe("Roadmap");
      expect(result.current.debouncedQuery).toBe("");

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current.debouncedQuery).toBe("Roadmap");
      vi.useRealTimers();
    });
  });
});
