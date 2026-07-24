export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  role: "admin" | "member" | "guest";
}

export interface Comment {
  id: string;
  threadId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  isDeleted: boolean;
}

export interface Thread {
  id: string;
  targetId: string;
  targetType: string;
  status: "open" | "resolved" | "archived";
  createdAt: string;
  updatedAt: string;
}

export type ThreadWithComments = Thread & { comments: Comment[] };
