import { describe, it, expect, beforeEach, vi } from "vitest";
import { InMemoryPublishingAdapter, type DemoDataset } from "./adapter";

describe("InMemoryPublishingAdapter", () => {
  let adapter: InMemoryPublishingAdapter;

  const mockDataset: DemoDataset = {
    id: "test-dataset",
    name: "Test Dataset",
    version: 1,
    updatedAt: "",
    emails: [
      {
        id: "1",
        from: "Sender",
        email: "sender*stealth.xyz",
        subject: "Subject",
        preview: "Preview",
        body: "Body",
        time: "Now",
        unread: false,
        starred: false,
        folder: "inbox",
        avatarColor: "#5b6470",
      },
    ],
  };

  beforeEach(() => {
    adapter = new InMemoryPublishingAdapter();
    if (typeof window !== "undefined") {
      localStorage.clear();
    } else {
      // Mock localStorage for node environment if needed, but vitest runs in jsdom/node
      // with standard global mocks if configured.
      const store: Record<string, string> = {};
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          for (const k in store) delete store[k];
        },
      });
    }
  });

  it("should publish and retrieve a dataset", async () => {
    const publishRes = await adapter.publishDataset(mockDataset);
    expect(publishRes.success).toBe(true);
    expect(publishRes.datasetId).toBe(mockDataset.id);

    const retrieved = await adapter.getDataset(mockDataset.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe(mockDataset.name);
    expect(retrieved?.emails.length).toBe(1);
  });

  it("should list published datasets", async () => {
    await adapter.publishDataset(mockDataset);
    const list = await adapter.listDatasets();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(mockDataset.id);
  });

  it("should delete a dataset", async () => {
    await adapter.publishDataset(mockDataset);
    const deleted = await adapter.deleteDataset(mockDataset.id);
    expect(deleted).toBe(true);

    const list = await adapter.listDatasets();
    expect(list.length).toBe(0);
  });

  it("should handle network mock failure", async () => {
    adapter.setMockFailure("network");
    await expect(adapter.listDatasets()).rejects.toThrow("Failed to fetch");
  });

  it("should handle auth mock failure", async () => {
    adapter.setMockFailure("auth");
    await expect(adapter.getDataset("some-id")).rejects.toThrow("Unauthorized");
  });

  it("should handle validation mock failure", async () => {
    adapter.setMockFailure("validation");
    const res = await adapter.publishDataset(mockDataset);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Validation failed");
  });
});
