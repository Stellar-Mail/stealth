export {
  extractTaskFromEmail,
  groupTasksByStatus,
  createTaskBoardService,
} from "./services/taskBoardService";

export type { TaskBoardService } from "./services/taskBoardService";

export type { Email, TaskCard, TaskBoard, LoadState, TaskBoardServiceConfig } from "./types";

// Backend-facing execution contract (non-UI)
export {
  createTaskBoardExecutor,
  taskBoardExecutor,
  extractTaskFromEmail as extractTaskFromEmailContract,
  groupTasksByStatus as groupTasksByStatusContract,
} from "./services/task-board-execution.service.mjs";

export type {
  EmailInput,
  TaskBoardContext,
  CreateTaskInput,
  TaskCard as TaskCardContract,
  TaskBoardResult,
  TaskBoardErrorPayload,
  TaskBoardErrorCode,
} from "./contract/task-board-contract";
