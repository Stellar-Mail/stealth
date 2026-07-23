import { User, Comment, Thread } from "./types";

export const mockUsers: User[] = [
  { id: "u-1", name: "Alice Admin", role: "admin" },
  { id: "u-2", name: "Bob Member", role: "member" },
];

export const mockThreads: Thread[] = [
  {
    id: "th-1",
    targetId: "txn-123",
    targetType: "transaction",
    status: "open",
    createdAt: new Date("2026-07-20T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-07-20T10:05:00Z").toISOString(),
  },
];

export const mockComments: Comment[] = [
  {
    id: "c-1",
    threadId: "th-1",
    authorId: "u-1",
    content: "Can someone verify this transaction amount?",
    createdAt: new Date("2026-07-20T10:00:00Z").toISOString(),
    isDeleted: false,
  },
  {
    id: "c-2",
    threadId: "th-1",
    authorId: "u-2",
    content: "Looking into it right now.",
    createdAt: new Date("2026-07-20T10:05:00Z").toISOString(),
    isDeleted: false,
  },
];
