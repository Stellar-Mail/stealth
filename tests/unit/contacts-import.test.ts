import { describe, expect, it, vi } from "vitest";

import {
  findDuplicateAddresses,
  parseCsv,
  revalidate,
} from "../../src/features/contacts/parseContacts";

const VALID_STELLAR_ADDRESS = `G${"A".repeat(55)}`;

describe("contacts import parsing", () => {
  it("parses headered CSV rows into valid imported contacts", () => {
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

    const rows = parseCsv(`name,address
Alice Safety,alice*example.com
Bob Control,${VALID_STELLAR_ADDRESS}`);

    expect(rows).toEqual([
      {
        id: "import-0-1768478400000",
        name: "Alice Safety",
        address: "alice*example.com",
        trust: "default",
        error: null,
      },
      {
        id: "import-1-1768478400000",
        name: "Bob Control",
        address: VALID_STELLAR_ADDRESS,
        trust: "default",
        error: null,
      },
    ]);

    vi.useRealTimers();
  });

  it("surfaces invalid and recoverable malformed row state", () => {
    const [badRow] = parseCsv("name,address\nMallory,not-a-stellar-address");

    expect(badRow).toMatchObject({
      name: "Mallory",
      address: "not-a-stellar-address",
      trust: "default",
      error: "Not a valid Stellar address or federation address (name*domain).",
    });

    expect(revalidate({ ...badRow, address: "mallory*example.com" })).toMatchObject({
      name: "Mallory",
      address: "mallory*example.com",
      trust: "default",
      error: null,
    });
  });

  it("detects duplicate addresses case-insensitively while ignoring blanks", () => {
    const duplicates = findDuplicateAddresses([
      {
        id: "contact-1",
        name: "Case One",
        address: "Shared*Example.com",
        trust: "default",
        error: null,
      },
      {
        id: "contact-2",
        name: "Case Two",
        address: " shared*example.com ",
        trust: "allow",
        error: null,
      },
      {
        id: "contact-3",
        name: "Blank",
        address: " ",
        trust: "block",
        error: "Address is required.",
      },
    ]);

    expect(duplicates).toEqual(new Set(["shared*example.com"]));
  });
});
