export class DraftValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message);
    this.name = "DraftValidationError";
  }
}

export class DraftNotFoundError extends Error {
  constructor(public readonly draftId: string) {
    super(`Draft not found: ${draftId}`);
    this.name = "DraftNotFoundError";
  }
}

export class DraftLimitError extends Error {
  constructor(public readonly limit: number) {
    super(`Draft limit reached: ${limit}`);
    this.name = "DraftLimitError";
  }
}

export type DraftError = DraftValidationError | DraftNotFoundError | DraftLimitError;
