export enum ExecutionAction {
  TRACK_MAIL = "TRACK_MAIL",
  UPDATE_VENDOR_STATUS = "UPDATE_VENDOR_STATUS",
  GET_VENDOR_STATS = "GET_VENDOR_STATS",
}

export interface ExecutionInput {
  action: ExecutionAction | string;
  vendorId?: string;
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
  VENDOR_NOT_FOUND = "VENDOR_NOT_FOUND",
  ACTION_NOT_SUPPORTED = "ACTION_NOT_SUPPORTED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
}
