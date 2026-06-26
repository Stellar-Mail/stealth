export {
  extractTaskFromEmail,
  groupTasksByStatus,
  createTaskBoardService,
} from "./services/taskBoardService";

export type { TaskBoardService } from "./services/taskBoardService";

export type { Email, TaskCard, TaskBoard, LoadState, TaskBoardServiceConfig } from "./types";
