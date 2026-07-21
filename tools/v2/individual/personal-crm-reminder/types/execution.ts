export enum ExecutionAction {
  CREATE_REMINDER = "CREATE_REMINDER",
  COMPLETE_REMINDER = "COMPLETE_REMINDER",
  LIST_REMINDERS = "LIST_REMINDERS",
}

export interface ExecutionInput {
  action: ExecutionAction | string;
  payload?: Record<string, any>;
}

export interface ExecutionOutput<T = any> {
  success: boolean;
  data?: T;
  error?: ExecutionError;
}

export interface ExecutionError {
  code: ExecutionErrorCode;
  message: string;
}

export enum ExecutionErrorCode {
  INVALID_INPUT = "INVALID_INPUT",
  REMINDER_NOT_FOUND = "REMINDER_NOT_FOUND",
  ACTION_NOT_SUPPORTED = "ACTION_NOT_SUPPORTED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
