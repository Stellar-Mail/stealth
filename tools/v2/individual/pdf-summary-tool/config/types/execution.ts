import { ToolConfig } from "./config";

export enum ExecutionAction {
  GET_CONFIG = "GET_CONFIG",
  UPDATE_CONFIG = "UPDATE_CONFIG",
  RESET_CONFIG = "RESET_CONFIG",
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
  CONFIG_NOT_FOUND = "CONFIG_NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  ACTION_NOT_SUPPORTED = "ACTION_NOT_SUPPORTED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
