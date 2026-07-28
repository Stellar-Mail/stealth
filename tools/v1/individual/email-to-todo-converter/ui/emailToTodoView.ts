// Email-to-Todo Converter -- UI view-model helpers.
//
// Thin layer on top of the core services that converts engine results into
// UI-friendly state descriptors. No React imports; pure functions only.

import {
  hasConvertibleContent as coreHasConvertibleContent,
  type NormalizedEmail,
  type TaskDraft,
  type TaskPriority,
} from "../services/emailToTodo";

export type { NormalizedEmail, TaskDraft, TaskPriority };

export type ConverterStatus = "empty" | "ready" | "loading" | "success" | "error";

export interface EmailToTodoConverterProps {
  email: NormalizedEmail | null;
  onSaveDraft?: (draft: TaskDraft) => void;
  idPrefix?: string;
}

export interface ConverterViewModel {
  statusMessage: string;
  isBusy: boolean;
  showEmptyState: boolean;
  showDraft: boolean;
  showError: boolean;
  canConvert: boolean;
}

export function resolveStatusMessage(status: ConverterStatus): string {
  switch (status) {
    case "empty":
      return "No email selected. Choose an email to convert into a task draft.";
    case "ready":
      return "Ready to convert the selected email into a task draft.";
    case "loading":
      return "Converting email into a task draft...";
    case "success":
      return "Task draft ready for review. Nothing has been saved yet.";
    case "error":
      return "The selected email could not be converted into a task draft.";
    default:
      return "";
  }
}

export function describeConverter(args: {
  status: ConverterStatus;
  hasEmail: boolean;
}): ConverterViewModel {
  const { status, hasEmail } = args;
  return {
    statusMessage: resolveStatusMessage(status),
    isBusy: status === "loading",
    showEmptyState: status === "empty" || !hasEmail,
    showDraft: status === "success",
    showError: status === "error",
    canConvert: hasEmail && status !== "loading",
  };
}

export const hasConvertibleContent = coreHasConvertibleContent;
