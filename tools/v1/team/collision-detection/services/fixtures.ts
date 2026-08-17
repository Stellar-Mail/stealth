import type { ActiveReply } from "./collisionDetection";

export interface CollisionFixture {
  id: string;
  description: string;
  replies: ActiveReply[];
  expectedEventCount: number;
}

export const COLLISION_FIXTURES: CollisionFixture[] = [
  {
    id: "two-reply-collision",
    description: "Two teammates replying to the same thread simultaneously.",
    replies: [
      {
        userId: "user-1",
        userName: "Alex Chen",
        threadId: "thread-101",
        startedAt: "2026-06-23T09:00:00.000Z",
        preview: "Re: Q3 Budget Review",
      },
      {
        userId: "user-2",
        userName: "Jordan Lee",
        threadId: "thread-101",
        startedAt: "2026-06-23T09:01:00.000Z",
        preview: "Re: Q3 Budget Review",
      },
    ],
    expectedEventCount: 1,
  },
  {
    id: "three-reply-critical",
    description: "Three teammates replying to the same thread (critical severity).",
    replies: [
      {
        userId: "user-1",
        userName: "Alex Chen",
        threadId: "thread-202",
        startedAt: "2026-06-23T10:00:00.000Z",
        preview: "Re: Deploy Schedule",
      },
      {
        userId: "user-3",
        userName: "Morgan Smith",
        threadId: "thread-202",
        startedAt: "2026-06-23T10:02:00.000Z",
        preview: "Re: Deploy Schedule",
      },
      {
        userId: "user-4",
        userName: "Taylor Wu",
        threadId: "thread-202",
        startedAt: "2026-06-23T10:03:00.000Z",
        preview: "Re: Deploy Schedule",
      },
    ],
    expectedEventCount: 1,
  },
  {
    id: "no-collision",
    description: "All replies to different threads — no collision.",
    replies: [
      {
        userId: "user-1",
        userName: "Alex Chen",
        threadId: "thread-301",
        startedAt: "2026-06-23T11:00:00.000Z",
      },
      {
        userId: "user-2",
        userName: "Jordan Lee",
        threadId: "thread-302",
        startedAt: "2026-06-23T11:05:00.000Z",
      },
    ],
    expectedEventCount: 0,
  },
];

export const EMPTY_REPLIES: ActiveReply[] = [];

export const SINGLE_REPLY: ActiveReply[] = [
  {
    userId: "user-1",
    userName: "Alex Chen",
    threadId: "thread-401",
    startedAt: "2026-06-23T12:00:00.000Z",
    preview: "Re: Standup Notes",
  },
];
