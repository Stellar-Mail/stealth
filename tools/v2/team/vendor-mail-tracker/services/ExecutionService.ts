import { ExecutionInput, ExecutionOutput, ExecutionErrorCode, ExecutionAction } from "../types";

export class ExecutionService {
  /**
   * Non-UI service entry point for vendor-mail-tracker
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
        case ExecutionAction.TRACK_MAIL:
          return this.handleTrackMail(input);
        case ExecutionAction.UPDATE_VENDOR_STATUS:
          return this.handleUpdateVendorStatus(input);
        case ExecutionAction.GET_VENDOR_STATS:
          return this.handleGetVendorStats(input);
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

  private async handleTrackMail(input: ExecutionInput): Promise<ExecutionOutput> {
    if (!input.vendorId) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_INPUT,
          message: "vendorId is required for TRACK_MAIL",
        },
      };
    }
    return {
      success: true,
      data: {
        tracked: true,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async handleUpdateVendorStatus(input: ExecutionInput): Promise<ExecutionOutput> {
    if (!input.vendorId || !input.payload?.status) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_INPUT,
          message: "vendorId and payload.status are required for UPDATE_VENDOR_STATUS",
        },
      };
    }
    return {
      success: true,
      data: {
        vendorId: input.vendorId,
        status: input.payload.status,
        updated: true,
      },
    };
  }

  private async handleGetVendorStats(input: ExecutionInput): Promise<ExecutionOutput> {
    if (!input.vendorId) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_INPUT,
          message: "vendorId is required for GET_VENDOR_STATS",
        },
      };
    }
    return {
      success: true,
      data: {
        vendorId: input.vendorId,
        totalMessages: 42,
      },
    };
  }
}
