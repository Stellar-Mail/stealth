export type MessageFolder = "inbox" | "sent" | "drafts" | "archive" | "spam" | "trash";

export type MessageFieldKey = "subject" | "sender" | "preview" | "folder" | "unread" | "starred";

export type MessageFieldType = "text" | "longtext" | "folder" | "boolean";

export interface EditableMessage {
  /** Stable identifier for the demo message. */
  id: string;
  /** Subject line shown in the message list. */
  subject: string;
  /** Display name or address of the sender. */
  sender: string;
  /** Short preview snippet of the body. */
  preview: string;
  /** Folder the message is filed under. */
  folder: MessageFolder;
  /** Whether the message is unread. */
  unread: boolean;
  /** Whether the message is starred. */
  starred: boolean;
}

export interface MessageFieldMeta {
  /** The editable field key. */
  key: MessageFieldKey;
  /** Human-readable label for the field. */
  label: string;
  /** Input type used to edit the field. */
  type: MessageFieldType;
  /** Whether the field must have a value. */
  required: boolean;
  /** Guidance shown next to the field. */
  helpText: string;
}

export const MESSAGE_FOLDERS: MessageFolder[] = [
  "inbox",
  "sent",
  "drafts",
  "archive",
  "spam",
  "trash",
];

export const DEFAULT_MESSAGE_FOLDER: MessageFolder = "inbox";

export const MESSAGE_FIELDS: MessageFieldMeta[] = [
  {
    key: "subject",
    label: "Subject",
    type: "text",
    required: true,
    helpText: "Short subject line shown in the message list.",
  },
  {
    key: "sender",
    label: "Sender",
    type: "text",
    required: true,
    helpText: "Display name or address the message appears to come from.",
  },
  {
    key: "preview",
    label: "Preview",
    type: "longtext",
    required: false,
    helpText: "Optional snippet of the body shown under the subject.",
  },
  {
    key: "folder",
    label: "Folder",
    type: "folder",
    required: true,
    helpText: "Folder the message is filed under in the demo inbox.",
  },
  {
    key: "unread",
    label: "Unread",
    type: "boolean",
    required: false,
    helpText: "Marks the message as unread in the list.",
  },
  {
    key: "starred",
    label: "Starred",
    type: "boolean",
    required: false,
    helpText: "Marks the message as starred in the list.",
  },
];

export function getMessageField(key: MessageFieldKey): MessageFieldMeta {
  const field = MESSAGE_FIELDS.find((meta) => meta.key === key);
  if (!field) {
    throw new Error(`Unknown message field: ${key}`);
  }
  return field;
}

export function createEmptyMessage(id: string): EditableMessage {
  return {
    id,
    subject: "",
    sender: "",
    preview: "",
    folder: DEFAULT_MESSAGE_FOLDER,
    unread: true,
    starred: false,
  };
}
