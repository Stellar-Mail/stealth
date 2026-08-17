export type MailboxGroup = "primary" | "organized" | "review" | "system";

export type DemoFolder = "inbox" | "sent" | "drafts" | "snoozed" | "archive" | "spam" | "trash";

export interface FolderDefinition {
  /** The folder identifier. */
  folder: DemoFolder;
  /** Short, human-readable label. */
  label: string;
  /** The mailbox group this folder belongs to. */
  group: MailboxGroup;
  /** What the folder holds in the demo dataset. */
  description: string;
}

export const DEMO_FOLDERS: DemoFolder[] = [
  "inbox",
  "sent",
  "drafts",
  "snoozed",
  "archive",
  "spam",
  "trash",
];

export const MAILBOX_GROUPS: MailboxGroup[] = ["primary", "organized", "review", "system"];

export const FOLDER_DEFINITIONS: Record<DemoFolder, FolderDefinition> = {
  inbox: {
    folder: "inbox",
    label: "Inbox",
    group: "primary",
    description: "Incoming demo messages that have not been filed away yet.",
  },
  sent: {
    folder: "sent",
    label: "Sent",
    group: "primary",
    description: "Demo messages sent from the seeded account.",
  },
  drafts: {
    folder: "drafts",
    label: "Drafts",
    group: "primary",
    description: "Unsent demo drafts saved for later editing.",
  },
  snoozed: {
    folder: "snoozed",
    label: "Snoozed",
    group: "organized",
    description: "Demo messages hidden until a scheduled reference time.",
  },
  archive: {
    folder: "archive",
    label: "Archive",
    group: "organized",
    description: "Demo messages kept for reference but out of the inbox.",
  },
  spam: {
    folder: "spam",
    label: "Spam",
    group: "review",
    description: "Demo messages flagged as unwanted and pending review.",
  },
  trash: {
    folder: "trash",
    label: "Trash",
    group: "system",
    description: "Deleted demo messages awaiting cleanup.",
  },
};

export const DEFAULT_FOLDER: DemoFolder = "inbox";

export function getFolderDefinition(folder: DemoFolder): FolderDefinition {
  return FOLDER_DEFINITIONS[folder];
}

export function getFoldersForGroup(group: MailboxGroup): DemoFolder[] {
  return DEMO_FOLDERS.filter((folder) => FOLDER_DEFINITIONS[folder].group === group);
}
