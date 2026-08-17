import { describe, expect, it } from "vitest";
import {
  addLabel,
  countLabelUsage,
  createLabel,
  normalizeLabelName,
  removeLabel,
  toLabelId,
  unusedLabels,
} from "./labelNormalization";
import { demoLabels, labeledDemoMessages } from "./labelFixtures";

describe("normalizeLabelName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeLabelName("  Follow   up  ")).toBe("Follow up");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(normalizeLabelName("   ")).toBe("");
  });
});

describe("toLabelId", () => {
  it("slugifies a label name", () => {
    expect(toLabelId("Follow up")).toBe("follow-up");
  });

  it("is case-insensitive and strips stray punctuation", () => {
    expect(toLabelId("  VIP!! Clients  ")).toBe("vip-clients");
  });
});

describe("createLabel", () => {
  it("builds a label from a raw name", () => {
    expect(createLabel("Follow up")).toEqual({ id: "follow-up", name: "Follow up" });
  });

  it("keeps a provided color", () => {
    expect(createLabel("Events", "sky")).toEqual({
      id: "events",
      name: "Events",
      color: "sky",
    });
  });

  it("returns null when the name has no usable characters", () => {
    expect(createLabel("   ")).toBeNull();
    expect(createLabel("!!!")).toBeNull();
  });
});

describe("addLabel", () => {
  it("appends a new label", () => {
    const result = addLabel([], "Follow up");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("follow-up");
  });

  it("ignores duplicates by id", () => {
    const labels = addLabel([], "Follow up");
    expect(addLabel(labels, "  follow   UP ")).toBe(labels);
  });

  it("ignores invalid names", () => {
    const labels: ReturnType<typeof addLabel> = [];
    expect(addLabel(labels, "   ")).toBe(labels);
  });
});

describe("countLabelUsage", () => {
  it("counts how many messages use each label, most used first", () => {
    const usage = countLabelUsage(demoLabels, labeledDemoMessages);
    const counts = Object.fromEntries(usage.map((entry) => [entry.label.id, entry.count]));
    expect(counts).toMatchObject({
      "follow-up": 3,
      invoices: 2,
      partners: 2,
      events: 1,
      archive: 0,
    });
    expect(usage[0]?.label.id).toBe("follow-up");
  });
});

describe("unusedLabels", () => {
  it("returns only labels no message uses", () => {
    const unused = unusedLabels(demoLabels, labeledDemoMessages);
    expect(unused.map((label) => label.id)).toEqual(["archive"]);
  });
});

describe("removeLabel", () => {
  it("drops the label and strips it from messages", () => {
    const { labels, messages } = removeLabel(demoLabels, labeledDemoMessages, "follow-up");
    expect(labels.some((label) => label.id === "follow-up")).toBe(false);
    expect(messages.every((message) => !message.labelIds.includes("follow-up"))).toBe(true);
  });
});
