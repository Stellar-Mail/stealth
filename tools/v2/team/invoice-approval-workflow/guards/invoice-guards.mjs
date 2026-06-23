const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected", "escalated"]);
const ALLOWED_CURRENCIES = new Set(["USD", "EUR", "GBP", "AUD", "CAD", "JPY"]);
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/csv",
]);

const LIMITS = {
  MAX_INVOICE_ID_LENGTH: 128,
  MAX_INVOICE_NUMBER_LENGTH: 64,
  MAX_VENDOR_NAME_LENGTH: 160,
  MAX_APPROVER_EMAIL_LENGTH: 254,
  MAX_MEMO_LENGTH: 2_000,
  MAX_AMOUNT: 1_000_000,
  MAX_LINE_ITEMS: 200,
  MAX_ATTACHMENTS: 25,
  MAX_ATTACHMENT_BYTES: 25 * 1024 * 1024,
  MAX_HISTORY_EVENTS: 500,
  MAX_TEAM_MEMBERS: 100,
};

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SAFE_INVOICE_NUMBER_PATTERN = /^[a-zA-Z0-9._-]+$/;

export class InvoiceValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "InvoiceValidationError";
    this.field = field;
  }
}

function stripControlCharacters(value, preserveNewlines = false) {
  const pattern = preserveNewlines
    ? /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g
    : /[\x00-\x1F\x7F-\x9F]/g;
  return value.replace(pattern, "");
}

function truncate(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function validateInvoiceId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new InvoiceValidationError("invoiceId must be a non-empty string", "invoiceId");
  }
  if (id.length > LIMITS.MAX_INVOICE_ID_LENGTH) {
    throw new InvoiceValidationError(
      `invoiceId exceeds max length of ${LIMITS.MAX_INVOICE_ID_LENGTH}`,
      "invoiceId",
    );
  }
  if (!SAFE_ID_PATTERN.test(id)) {
    throw new InvoiceValidationError(
      "invoiceId may only contain letters, numbers, underscores, and dashes",
      "invoiceId",
    );
  }
  return id;
}

export function sanitizeInvoiceNumber(invoiceNumber) {
  if (typeof invoiceNumber !== "string") {
    return "";
  }
  const sanitized = truncate(
    stripControlCharacters(invoiceNumber).trim(),
    LIMITS.MAX_INVOICE_NUMBER_LENGTH,
  );
  return sanitized;
}

export function validateInvoiceNumber(invoiceNumber) {
  const sanitized = sanitizeInvoiceNumber(invoiceNumber);
  if (!sanitized) {
    throw new InvoiceValidationError(
      "invoiceNumber must be a non-empty string",
      "invoiceNumber",
    );
  }
  if (!SAFE_INVOICE_NUMBER_PATTERN.test(sanitized)) {
    throw new InvoiceValidationError(
      "invoiceNumber may only contain letters, numbers, dots, underscores, and dashes",
      "invoiceNumber",
    );
  }
  return sanitized;
}

export function sanitizeVendorName(vendorName) {
  if (typeof vendorName !== "string") {
    return "";
  }
  return truncate(stripControlCharacters(vendorName).trim(), LIMITS.MAX_VENDOR_NAME_LENGTH);
}

export function validateVendorName(vendorName) {
  const sanitized = sanitizeVendorName(vendorName);
  if (!sanitized) {
    throw new InvoiceValidationError("vendorName must be a non-empty string", "vendorName");
  }
  if (/[<>]/.test(sanitized)) {
    throw new InvoiceValidationError("vendorName must not contain markup characters", "vendorName");
  }
  return sanitized;
}

export function sanitizeMemo(memo) {
  if (typeof memo !== "string") {
    return "";
  }
  return truncate(stripControlCharacters(memo, true).trim(), LIMITS.MAX_MEMO_LENGTH);
}

export function validateStatus(status) {
  if (typeof status !== "string" || status.length === 0) {
    throw new InvoiceValidationError("status must be a non-empty string", "status");
  }
  if (!ALLOWED_STATUSES.has(status)) {
    throw new InvoiceValidationError(
      `"${status}" is not a recognized status`,
      "status",
    );
  }
  return status;
}

export function validateCurrency(currency) {
  if (typeof currency !== "string" || currency.length === 0) {
    throw new InvoiceValidationError("currency must be a non-empty string", "currency");
  }
  const normalized = currency.toUpperCase();
  if (!ALLOWED_CURRENCIES.has(normalized)) {
    throw new InvoiceValidationError(
      `"${currency}" is not an allowed currency`,
      "currency",
    );
  }
  return normalized;
}

export function validateAmount(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new InvoiceValidationError("amount must be a finite number", "amount");
  }
  if (amount <= 0) {
    throw new InvoiceValidationError("amount must be greater than zero", "amount");
  }
  if (amount > LIMITS.MAX_AMOUNT) {
    throw new InvoiceValidationError(
      `amount exceeds max of ${LIMITS.MAX_AMOUNT}`,
      "amount",
    );
  }
  if (Math.round(amount * 100) !== amount * 100) {
    throw new InvoiceValidationError("amount must not exceed two decimal places", "amount");
  }
  return amount;
}

export function validateApproverEmail(email) {
  if (typeof email !== "string" || email.length === 0) {
    throw new InvoiceValidationError("approverEmail must be a non-empty string", "approverEmail");
  }
  if (email.length > LIMITS.MAX_APPROVER_EMAIL_LENGTH) {
    throw new InvoiceValidationError(
      `approverEmail exceeds max length of ${LIMITS.MAX_APPROVER_EMAIL_LENGTH}`,
      "approverEmail",
    );
  }
  if (/[\r\n\0]/.test(email)) {
    throw new InvoiceValidationError(
      "approverEmail contains illegal control characters",
      "approverEmail",
    );
  }
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) {
    throw new InvoiceValidationError("approverEmail is malformed", "approverEmail");
  }
  return email;
}

export function guardLineItems(lineItems) {
  if (!Array.isArray(lineItems)) {
    throw new InvoiceValidationError("lineItems must be an array", "lineItems");
  }
  if (lineItems.length > LIMITS.MAX_LINE_ITEMS) {
    throw new InvoiceValidationError(
      `line item count ${lineItems.length} exceeds safe limit of ${LIMITS.MAX_LINE_ITEMS}`,
      "lineItems",
    );
  }
  return true;
}

export function validateLineItems(lineItems) {
  guardLineItems(lineItems);
  let total = 0;

  for (let index = 0; index < lineItems.length; index += 1) {
    const item = lineItems[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new InvoiceValidationError(`line item ${index} must be an object`, "lineItems");
    }
    if (typeof item.description !== "string" || item.description.trim().length === 0) {
      throw new InvoiceValidationError(
        `line item ${index} needs a description`,
        "lineItems",
      );
    }
    total += validateAmount(item.amount);
  }

  return Number(total.toFixed(2));
}

export function guardAttachments(attachments) {
  if (!Array.isArray(attachments)) {
    throw new InvoiceValidationError("attachments must be an array", "attachments");
  }
  if (attachments.length > LIMITS.MAX_ATTACHMENTS) {
    throw new InvoiceValidationError(
      `attachment count ${attachments.length} exceeds safe limit of ${LIMITS.MAX_ATTACHMENTS}`,
      "attachments",
    );
  }
  return true;
}

export function validateAttachment(attachment) {
  if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
    throw new InvoiceValidationError("attachment must be an object", "attachments");
  }
  if (typeof attachment.filename !== "string" || attachment.filename.trim().length === 0) {
    throw new InvoiceValidationError("attachment filename is required", "attachments");
  }
  if (/[\\/\0\r\n]/.test(attachment.filename)) {
    throw new InvoiceValidationError("attachment filename contains unsafe characters", "attachments");
  }
  if (!ALLOWED_ATTACHMENT_TYPES.has(attachment.mimeType)) {
    throw new InvoiceValidationError("attachment MIME type is not allowed", "attachments");
  }
  if (
    typeof attachment.sizeBytes !== "number" ||
    !Number.isFinite(attachment.sizeBytes) ||
    attachment.sizeBytes < 0
  ) {
    throw new InvoiceValidationError("attachment size must be a non-negative number", "attachments");
  }
  if (attachment.sizeBytes > LIMITS.MAX_ATTACHMENT_BYTES) {
    throw new InvoiceValidationError(
      `attachment exceeds max size of ${LIMITS.MAX_ATTACHMENT_BYTES} bytes`,
      "attachments",
    );
  }
  return true;
}

export function validateAttachments(attachments) {
  guardAttachments(attachments);
  for (const attachment of attachments) {
    validateAttachment(attachment);
  }
  return true;
}

export function guardApprovalHistory(history) {
  if (!Array.isArray(history)) {
    throw new InvoiceValidationError("approval history must be an array", "history");
  }
  if (history.length > LIMITS.MAX_HISTORY_EVENTS) {
    throw new InvoiceValidationError(
      `history count ${history.length} exceeds safe limit of ${LIMITS.MAX_HISTORY_EVENTS}`,
      "history",
    );
  }
  return true;
}

export function guardTeamMembers(teamMembers) {
  if (!Array.isArray(teamMembers)) {
    throw new InvoiceValidationError("teamMembers must be an array", "teamMembers");
  }
  if (teamMembers.length > LIMITS.MAX_TEAM_MEMBERS) {
    throw new InvoiceValidationError(
      `team member count ${teamMembers.length} exceeds safe limit of ${LIMITS.MAX_TEAM_MEMBERS}`,
      "teamMembers",
    );
  }
  return true;
}

export function validateInvoiceSubmission(invoice) {
  if (!invoice || typeof invoice !== "object" || Array.isArray(invoice)) {
    throw new InvoiceValidationError("invoice must be a plain object", "invoice");
  }

  const invoiceId = validateInvoiceId(invoice.invoiceId);
  const invoiceNumber = validateInvoiceNumber(invoice.invoiceNumber);
  const vendorName = validateVendorName(invoice.vendorName);
  const currency = validateCurrency(invoice.currency);
  const amount = validateAmount(invoice.amount);
  const status = validateStatus(invoice.status);
  const approverEmail = validateApproverEmail(invoice.approverEmail);
  const lineItemTotal = validateLineItems(invoice.lineItems ?? []);
  validateAttachments(invoice.attachments ?? []);

  if (lineItemTotal > 0 && Number(lineItemTotal.toFixed(2)) !== amount) {
    throw new InvoiceValidationError("line item total must match invoice amount", "lineItems");
  }

  return {
    invoiceId,
    invoiceNumber,
    vendorName,
    currency,
    amount,
    status,
    approverEmail,
    memo: sanitizeMemo(invoice.memo),
    lineItemTotal,
  };
}

export {
  ALLOWED_ATTACHMENT_TYPES,
  ALLOWED_CURRENCIES,
  ALLOWED_STATUSES,
  LIMITS,
};
