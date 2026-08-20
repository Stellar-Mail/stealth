import { describe, expect, it } from "vitest";

import {
  commitContactImport,
  createContact,
  deleteContact,
  getContact,
  listContacts,
  mergeContacts,
  previewContactImport,
  resolveContactState,
  updateContact,
  type ContactImportCommitInput,
} from "../../../src/server/api/contact-service";
import { buildImportPreview, parseCsv, parseVCard } from "../../../src/server/api/contact-import";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { getSenderRule } from "../../../src/server/api/policy-service";

const owner = `G${"A".repeat(55)}`;
const otherOwner = `G${"B".repeat(55)}`;

const VALID_G = `G${"C".repeat(55)}`;
const VALID_S = `S${"D".repeat(55)}`;

describe("contact import parsing (BETA-066 / Issue #1973)", () => {
  it("parses headerless CSV with name,address columns", () => {
    const rows = parseCsv("Alice,galice\nBob,gbob");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "Alice", address: "galice", source: "csv", error: null });
  });

  it("parses CSV with a header row and skips it", () => {
    const rows = parseCsv("name,address\nAlice,GALICE-ADDR\nBob,GBOB-ADDR");
    expect(rows).toHaveLength(2);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[1].name).toBe("Bob");
  });

  it("accepts TSV and semicolon-delimited files", () => {
    expect(parseCsv("name\taddress\nAlice\tga")).toHaveLength(1);
    expect(parseCsv("name;address\nBob;gb")).toHaveLength(1);
  });

  it("handles quoted CSV fields containing delimiters", () => {
    const rows = parseCsv(`"Smith, John","g*smith"`);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Smith, John");
    expect(rows[0].address).toBe("g*smith");
  });

  it("flags malformed addresses with per-row errors instead of failing", () => {
    const rows = parseCsv("Alice,\nBob,g*bob");
    expect(rows).toHaveLength(2);
    expect(rows[0].error).not.toBeNull();
    expect(rows[1].error).toBeNull();
  });

  it("truncates overlong names", () => {
    const rows = parseCsv(`${"x".repeat(300)},g*a`);
    expect(rows[0].name).toHaveLength(200);
  });

  it("parses vCard blocks with FN and EMAIL", () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Alice Example",
      `EMAIL:${VALID_G}`,
      "END:VCARD",
    ].join("\n");
    const rows = parseVCard(vcard);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Alice Example",
      address: VALID_G,
      source: "vcard",
      error: null,
    });
  });

  it("prefers a Stellar-shaped email over a plain email in vCards", () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:4.0",
      "FN:Bob",
      "EMAIL:bob@example.com",
      `EMAIL:${VALID_S}`,
      "END:VCARD",
    ].join("\n");
    const rows = parseVCard(vcard);
    expect(rows[0].address).toBe(VALID_S);
  });

  it("falls back to the N line when FN is missing", () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Example;Alice;;;",
      `EMAIL:${VALID_G}`,
      "END:VCARD",
    ].join("\n");
    const rows = parseVCard(vcard);
    expect(rows[0].name).toBe("Alice Example");
  });

  it("handles multiple vCards and ignores garbage blocks", () => {
    const vcard = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:One",
      `EMAIL:${VALID_G}`,
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:Two",
      `EMAIL:${VALID_S}`,
      "END:VCARD",
      "not-a-card",
    ].join("\n");
    const rows = parseVCard(vcard);
    expect(rows).toHaveLength(2);
  });

  it("buildImportPreview truncates at the row limit and reports it", () => {
    const csv = Array.from({ length: 5 }, (_, i) => `Name${i},g*addr${i}`).join("\n");
    const { rows, truncated } = buildImportPreview("csv", csv, 3);
    expect(rows).toHaveLength(3);
    expect(truncated).toBe(true);
  });

  it("preview deduplicates repeated addresses keeping the row that has a name", async () => {
    const repository = new MemoryApiRepository();
    const preview = await previewContactImport(repository, owner, {
      format: "csv",
      content: `,${VALID_G}\nNamed,${VALID_G}`,
    });
    expect(preview.totalRows).toBe(2);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].name).toBe("Named");
  });
});

describe("contact service CRUD (BETA-066 / Issue #1973)", () => {
  it("creates a contact and resolves its state", async () => {
    const repository = new MemoryApiRepository();
    const created = await createContact(repository, owner, { name: "Alice", address: "galice" });

    expect(created.contact).toMatchObject({
      owner,
      name: "Alice",
      address: "galice",
      canonicalAddress: null,
      trust: "default",
      source: "manual",
      version: 1,
    });
    expect(created.contact.contactId).toMatch(/^c_/);
    expect(created.resolution.senderRule).toBe("default");
    expect(created.resolution.senderRuleConfigured).toBe(false);
  });

  it("throws not-found when reading a missing contact", async () => {
    const repository = new MemoryApiRepository();
    await expect(getContact(repository, owner, "c_missing")).rejects.toMatchObject({ status: 404 });
  });

  it("lists contacts and respects the owner scope", async () => {
    const repository = new MemoryApiRepository();
    await createContact(repository, owner, { name: "A", address: "ga" });
    await createContact(repository, owner, { name: "B", address: "gb" });
    await createContact(repository, otherOwner, { name: "C", address: "gc" });

    const page = await listContacts(repository, owner, { query: "g" });
    expect(page.items).toHaveLength(2);
    expect(page.items.every((item) => item.contact.owner === owner)).toBe(true);
  });

  it("updates a contact and bumps the version", async () => {
    const repository = new MemoryApiRepository();
    const created = await createContact(repository, owner, { name: "Old", address: VALID_G });

    const updated = await updateContact(repository, owner, created.contact.contactId, {
      name: "New",
      trust: "allow",
    });
    expect(updated.contact.name).toBe("New");
    expect(updated.contact.trust).toBe("allow");
    expect(updated.contact.version).toBe(2);
  });

  it("update never mutates policy, even when trust is changed", async () => {
    const repository = new MemoryApiRepository();
    const created = await createContact(repository, owner, { name: "A", address: VALID_G });
    await updateContact(repository, owner, created.contact.contactId, { trust: "block" });

    const rule = await getSenderRule(repository, owner, VALID_G);
    expect(rule.rule).toBe("default");
  });

  it("deletes a contact", async () => {
    const repository = new MemoryApiRepository();
    const created = await createContact(repository, owner, { name: "A", address: VALID_G });
    await deleteContact(repository, owner, created.contact.contactId);
    await expect(getContact(repository, owner, created.contact.contactId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("merges contacts keeping the survivor and deleting the merged rows", async () => {
    const repository = new MemoryApiRepository();
    const keep = await createContact(repository, owner, { name: "Keep", address: VALID_G });
    const dup = await createContact(repository, owner, { name: "Dup", address: VALID_S });

    const merged = await mergeContacts(repository, owner, {
      keepContactId: keep.contact.contactId,
      mergeContactIds: [dup.contact.contactId],
    });
    expect(merged.contact.contactId).toBe(keep.contact.contactId);

    await expect(getContact(repository, owner, dup.contact.contactId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("merge rejects a self-merge", async () => {
    const repository = new MemoryApiRepository();
    const c = await createContact(repository, owner, { name: "A", address: VALID_G });
    await expect(
      mergeContacts(repository, owner, {
        keepContactId: c.contact.contactId,
        mergeContactIds: [c.contact.contactId],
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("resolveContactState returns default trust when no rule is configured", async () => {
    const repository = new MemoryApiRepository();
    const created = await createContact(repository, owner, { name: "A", address: VALID_G });
    const state = await resolveContactState(repository, owner, created.contact);
    expect(state).toMatchObject({ senderRule: "default", senderRuleConfigured: false });
  });
});

describe("contact import commit (BETA-066 / Issue #1973)", () => {
  it("creates contacts idempotently on repeated commits", async () => {
    const repository = new MemoryApiRepository();
    const input: ContactImportCommitInput = {
      rows: [
        { name: "Alice", address: VALID_G, source: "csv" },
        { name: "Bob", address: VALID_S, source: "vcard" },
      ],
    };

    const first = await commitContactImport(repository, owner, input);
    expect(first.created).toBe(2);
    expect(first.total).toBe(2);
    expect(first.contacts).toHaveLength(2);
    expect(first.contacts[0].source).toBe("csv");
    expect(first.contacts[1].source).toBe("vcard");

    const second = await commitContactImport(repository, owner, input);
    expect(second.created).toBe(0);
    expect(second.unchanged).toBe(2);

    const page = await listContacts(repository, owner);
    expect(page.items).toHaveLength(2);
  });

  it("updates existing contacts when the address matches", async () => {
    const repository = new MemoryApiRepository();
    await createContact(repository, owner, { name: "Old", address: VALID_G });

    const result = await commitContactImport(repository, owner, {
      rows: [{ name: "New", address: VALID_G, source: "csv" }],
    });
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
  });

  it("rejects invalid rows without aborting valid ones", async () => {
    const repository = new MemoryApiRepository();
    const result = await commitContactImport(repository, owner, {
      rows: [
        { name: "Good", address: VALID_G },
        { name: "Bad", address: "" },
      ],
    });
    expect(result.rejected).toBe(1);
    expect(result.created).toBe(1);
  });

  it("does not touch sender rules unless applyTrust is explicitly set", async () => {
    const repository = new MemoryApiRepository();
    await commitContactImport(repository, owner, {
      rows: [{ name: "A", address: VALID_G, trust: "block" }],
    });
    const rule = await getSenderRule(repository, owner, VALID_G);
    expect(rule.rule).toBe("default");
  });

  it("applies allow/block trust rules when applyTrust is true", async () => {
    const repository = new MemoryApiRepository();
    const result = await commitContactImport(repository, owner, {
      rows: [
        { name: "Blocked", address: VALID_G, trust: "block" },
        { name: "Default", address: VALID_S },
      ],
      applyTrust: true,
    });
    expect(result.appliedRules).toBe(1);
    const blocked = await getSenderRule(repository, owner, VALID_G);
    expect(blocked.rule).toBe("block");
    const unset = await getSenderRule(repository, owner, VALID_S);
    expect(unset.rule).toBe("default");
  });

  it("rejects a commit that exceeds the row limit", async () => {
    const repository = new MemoryApiRepository();
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      name: `N${i}`,
      address: `g*n${i}`,
    }));
    await expect(commitContactImport(repository, owner, { rows })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("preview detects existing contacts and reports them as duplicates", async () => {
    const repository = new MemoryApiRepository();
    await createContact(repository, owner, { name: "Existing", address: VALID_G });

    const preview = await previewContactImport(repository, owner, {
      format: "csv",
      content: `Existing,${VALID_G}\nFresh,${VALID_S}`,
    });
    expect(preview.format).toBe("csv");
    expect(preview.validRows).toBe(2);
    expect(preview.duplicateRows).toBe(1);
    const existingRow = preview.rows.find((row) => row.address === VALID_G);
    expect(existingRow?.existing).toMatchObject({ trust: "default" });
  });
});
