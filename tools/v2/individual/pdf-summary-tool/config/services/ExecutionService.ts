import {
  ExecutionInput,
  ExecutionOutput,
  ExecutionErrorCode,
  ExecutionAction,
} from "../types/execution";
import { ToolConfig } from "../types/config";

const DEFAULT_CONFIG: ToolConfig = {
  summarySettings: {
    length: "medium",
    style: "paragraph",
    includeKeywords: false,
    language: "en",
  },
  processingLimits: {
    maxFileSizeBytes: 50 * 1024 * 1024,
    supportedMimeTypes: ["application/pdf"],
  },
};

export class ExecutionService {
  private currentConfig: ToolConfig = { ...DEFAULT_CONFIG };

  /**
   * Non-UI service entry point for pdf-summary-tool/config
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
        case ExecutionAction.GET_CONFIG:
          return this.handleGetConfig(input);
        case ExecutionAction.UPDATE_CONFIG:
          return this.handleUpdateConfig(input);
        case ExecutionAction.RESET_CONFIG:
          return this.handleResetConfig(input);
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

  private async handleGetConfig(_input: ExecutionInput): Promise<ExecutionOutput<ToolConfig>> {
    return {
      success: true,
      data: this.currentConfig,
    };
  }

  private async handleUpdateConfig(input: ExecutionInput): Promise<ExecutionOutput<ToolConfig>> {
    if (!input.payload?.summarySettings) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.VALIDATION_ERROR,
          message: "summarySettings are required for UPDATE_CONFIG",
        },
      };
    }

    this.currentConfig = {
      ...this.currentConfig,
      summarySettings: {
        ...this.currentConfig.summarySettings,
        ...input.payload.summarySettings,
      },
    };

    return {
      success: true,
      data: this.currentConfig,
    };
  }

  private async handleResetConfig(_input: ExecutionInput): Promise<ExecutionOutput<ToolConfig>> {
    this.currentConfig = { ...DEFAULT_CONFIG };
    return {
      success: true,
      data: this.currentConfig,
    };
  }
}
