import {
  ExecutionInput,
  ExecutionOutput,
  ExecutionErrorCode,
  ExecutionAction,
} from "../types/execution";

export class ExecutionService {
  /**
   * Non-UI service entry point for personal-crm-reminder
   * Provides a stable backend-facing execution contract
   */
  public async execute(input: ExecutionInput): Promise<ExecutionOutput> {
    try {
      if (!input || !input.action) {
        return {
          success: false,
          error: {
            code: ExecutionErrorCode.INVALID_INPUT,
            message: "Missing execution action",
          },
        };
      }

      switch (input.action) {
        case ExecutionAction.CREATE_REMINDER:
          return this.handleCreateReminder(input);
        case ExecutionAction.COMPLETE_REMINDER:
          return this.handleCompleteReminder(input);
        case ExecutionAction.LIST_REMINDERS:
          return this.handleListReminders(input);
        default:
          return {
            success: false,
            error: {
              code: ExecutionErrorCode.ACTION_NOT_SUPPORTED,
              message: `Action ${input.action} is not supported`,
            },
          };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : "Unknown internal error",
        },
      };
    }
  }

  private async handleCreateReminder(input: ExecutionInput): Promise<ExecutionOutput> {
    if (!input.payload?.contactId || !input.payload?.dueDate) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_INPUT,
          message: "contactId and dueDate are required for CREATE_REMINDER",
        },
      };
    }
    return {
      success: true,
      data: {
        id: "rem-123",
        status: "PENDING",
      },
    };
  }

  private async handleCompleteReminder(input: ExecutionInput): Promise<ExecutionOutput> {
    if (!input.payload?.reminderId) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_INPUT,
          message: "reminderId is required for COMPLETE_REMINDER",
        },
      };
    }
    return {
      success: true,
      data: {
        id: input.payload.reminderId,
        status: "COMPLETED",
      },
    };
  }

  private async handleListReminders(_input: ExecutionInput): Promise<ExecutionOutput> {
    return {
      success: true,
      data: {
        reminders: [],
      },
    };
  }
}
