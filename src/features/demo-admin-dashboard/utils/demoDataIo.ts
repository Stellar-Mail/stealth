// JSON import/export utilities with validation and normalization
import { DemoDashboardData, DemoAccount, DemoMail, DemoAuditEvent } from "../types/demoData";

/**
 * Parses, validates, and normalizes a JSON string representing demo dashboard data.
 *
 * @param jsonStr The JSON string to parse and validate.
 * @returns A validated and normalized DemoDashboardData object.
 * @throws Error with a specific validation/parse error message if validation fails.
 */
export function validateAndNormalizeDemoData(jsonStr: string): DemoDashboardData {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error: any) {
    throw new Error(`Invalid JSON format: ${error.message}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Validation error: Root must be a JSON object");
  }

  // Validate and normalize accounts
  const normalizedAccounts: DemoAccount[] = [];
  if (parsed.accounts !== undefined) {
    if (!Array.isArray(parsed.accounts)) {
      throw new Error("Validation error: 'accounts' must be an array");
    }
    for (const item of parsed.accounts) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("Validation error: Each account must be an object");
      }
      const { name, address, balance, type } = item;
      if (name === undefined || address === undefined || balance === undefined || type === undefined) {
        throw new Error("Validation error: Account is missing required field(s) (name, address, balance, type)");
      }
      if (
        typeof name !== "string" ||
        typeof address !== "string" ||
        typeof balance !== "string" ||
        typeof type !== "string"
      ) {
        throw new Error("Validation error: Account fields (name, address, balance, type) must be strings");
      }

      const trimmedName = name.trim();
      const trimmedAddress = address.trim();
      const trimmedBalance = balance.trim();
      const trimmedType = type.trim();

      if (!trimmedName) {
        throw new Error("Validation error: Account name cannot be empty");
      }
      if (!trimmedAddress) {
        throw new Error("Validation error: Account address cannot be empty");
      }
      if (!trimmedAddress.startsWith("G")) {
        throw new Error("Validation error: Account address must start with 'G'");
      }
      if (!trimmedBalance) {
        throw new Error("Validation error: Account balance cannot be empty");
      }
      if (!trimmedType) {
        throw new Error("Validation error: Account type cannot be empty");
      }

      normalizedAccounts.push({
        name: trimmedName,
        address: trimmedAddress,
        balance: trimmedBalance,
        type: trimmedType,
      });
    }
  }

  // Validate and normalize mail
  const normalizedMail: DemoMail[] = [];
  if (parsed.mail !== undefined) {
    if (!Array.isArray(parsed.mail)) {
      throw new Error("Validation error: 'mail' must be an array");
    }
    for (const item of parsed.mail) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("Validation error: Each mail item must be an object");
      }
      const { subject, status, folder } = item;
      if (subject === undefined || status === undefined || folder === undefined) {
        throw new Error("Validation error: Mail item is missing required field(s) (subject, status, folder)");
      }
      if (typeof subject !== "string" || typeof status !== "string" || typeof folder !== "string") {
        throw new Error("Validation error: Mail fields (subject, status, folder) must be strings");
      }

      const trimmedSubject = subject.trim();
      const trimmedStatus = status.trim() as any;
      const trimmedFolder = folder.trim();

      if (!trimmedSubject) {
        throw new Error("Validation error: Mail subject cannot be empty");
      }
      if (trimmedStatus !== "delivered" && trimmedStatus !== "pending" && trimmedStatus !== "held") {
        throw new Error("Validation error: Mail status must be 'delivered', 'pending', or 'held'");
      }
      if (!trimmedFolder) {
        throw new Error("Validation error: Mail folder cannot be empty");
      }

      normalizedMail.push({
        subject: trimmedSubject,
        status: trimmedStatus,
        folder: trimmedFolder,
      });
    }
  }

  // Validate and normalize audit events
  const normalizedAudit: DemoAuditEvent[] = [];
  if (parsed.audit !== undefined) {
    if (!Array.isArray(parsed.audit)) {
      throw new Error("Validation error: 'audit' must be an array");
    }
    for (const item of parsed.audit) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        throw new Error("Validation error: Each audit event must be an object");
      }
      const { action, actor, timestamp } = item;
      if (action === undefined || actor === undefined || timestamp === undefined) {
        throw new Error("Validation error: Audit event is missing required field(s) (action, actor, timestamp)");
      }
      if (typeof action !== "string" || typeof actor !== "string" || typeof timestamp !== "string") {
        throw new Error("Validation error: Audit event fields (action, actor, timestamp) must be strings");
      }

      const trimmedAction = action.trim();
      const trimmedActor = actor.trim();
      const trimmedTimestamp = timestamp.trim();

      if (!trimmedAction) {
        throw new Error("Validation error: Audit event action cannot be empty");
      }
      if (!trimmedActor) {
        throw new Error("Validation error: Audit event actor cannot be empty");
      }
      if (!trimmedTimestamp) {
        throw new Error("Validation error: Audit event timestamp cannot be empty");
      }

      const parsedDate = new Date(trimmedTimestamp);
      if (isNaN(parsedDate.getTime())) {
        throw new Error(`Validation error: Audit event timestamp '${trimmedTimestamp}' is not a valid date`);
      }

      normalizedAudit.push({
        action: trimmedAction,
        actor: trimmedActor,
        timestamp: parsedDate.toISOString(),
      });
    }
  }

  return {
    accounts: normalizedAccounts,
    mail: normalizedMail,
    audit: normalizedAudit,
  };
}

/**
 * Serializes demo dashboard data to a pretty-printed JSON string.
 *
 * @param data The DemoDashboardData object to serialize.
 * @returns A pretty-printed JSON string.
 */
export function serializeDemoData(data: DemoDashboardData): string {
  return JSON.stringify(data, null, 2);
}
