import type { Note } from "../types";

export const seedNotes: Note[] = [
  {
    id: "note-alice-1",
    contactId: "contact-alice",
    content: "Alice prefers email communication over phone. Best time to reach is before noon.",
    authorId: "user-current",
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    archivedAt: null,
  },
  {
    id: "note-alice-2",
    contactId: "contact-alice",
    content: "Follow up on Q2 proposal — Alice mentioned budget approval is pending.",
    authorId: "user-colleague",
    createdAt: "2026-06-10T14:30:00.000Z",
    updatedAt: "2026-06-12T09:00:00.000Z",
    archivedAt: null,
  },
  {
    id: "note-bob-1",
    contactId: "contact-bob",
    content: "Bob is the technical contact for the integration project.",
    authorId: "user-current",
    createdAt: "2026-05-20T08:00:00.000Z",
    updatedAt: "2026-05-20T08:00:00.000Z",
    archivedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "note-carol-1",
    contactId: "contact-carol",
    content: "Carol shared her public key for encrypted messaging.",
    authorId: "user-current",
    createdAt: "2026-06-15T16:45:00.000Z",
    updatedAt: "2026-06-15T16:45:00.000Z",
    archivedAt: null,
  },
  {
    id: "note-dave-1",
    contactId: "contact-dave",
    content: "Dave requested pricing for the enterprise tier.",
    authorId: "user-sales",
    createdAt: "2026-06-18T11:00:00.000Z",
    updatedAt: "2026-06-18T11:30:00.000Z",
    archivedAt: null,
  },
];
