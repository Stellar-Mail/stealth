import type { EditableMessage } from "../constants/messageListEditorModel";

export const messageListFixtures: EditableMessage[] = [
  {
    id: "msg-welcome",
    subject: "Welcome to the demo inbox",
    sender: "demo-team@stealth.demo",
    preview: "Here is how seeded conversations appear in the admin view.",
    folder: "inbox",
    unread: true,
    starred: false,
  },
  {
    id: "msg-invoice",
    subject: "Invoice #1042 is ready",
    sender: "billing@example.com",
    preview: "Your latest demo invoice has been generated for review.",
    folder: "inbox",
    unread: false,
    starred: true,
  },
  {
    id: "msg-archive-note",
    subject: "Project notes archived",
    sender: "notes@example.org",
    preview: "These notes were moved out of the inbox for reference.",
    folder: "archive",
    unread: false,
    starred: false,
  },
];
