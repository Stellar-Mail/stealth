import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOLDER,
  DEMO_FOLDERS,
  FOLDER_DEFINITIONS,
  MAILBOX_GROUPS,
  getFolderDefinition,
  getFoldersForGroup,
} from "../constants/folderTaxonomy";

describe("folder and mailbox taxonomy", () => {
  it("defines the supported demo folders", () => {
    expect(DEMO_FOLDERS).toEqual([
      "inbox",
      "sent",
      "drafts",
      "snoozed",
      "archive",
      "spam",
      "trash",
    ]);
  });

  it("provides a definition with a known group for every folder", () => {
    expect(Object.keys(FOLDER_DEFINITIONS).sort()).toEqual([...DEMO_FOLDERS].sort());
    for (const folder of DEMO_FOLDERS) {
      const definition = getFolderDefinition(folder);
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(MAILBOX_GROUPS).toContain(definition.group);
    }
  });

  it("maps every folder to a group and uses a valid default", () => {
    const mapped = MAILBOX_GROUPS.flatMap((group) => getFoldersForGroup(group));
    expect(mapped.sort()).toEqual([...DEMO_FOLDERS].sort());
    expect(DEMO_FOLDERS).toContain(DEFAULT_FOLDER);
  });
});
