import type { DemoDataset } from "./types/dataset";
import type { ValidationIssue } from "./validation-types";

const SAFE_DOMAIN_RE =
  /@(example\.com|example\.org|[\w-]+\.stealth\.demo|[\w-]+\.stealth\.network)$/;

const SECRET_PATTERNS: RegExp[] = [
  /S[A-Z0-9]{55}/,
  /-----BEGIN.*PRIVATE KEY-----/,
  /sk_[a-zA-Z0-9]{20,}/,
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function validateInboxSeedDataset(dataset: DemoDataset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const id = dataset.id;

  if (!dataset.messages || dataset.messages.length === 0) {
    issues.push({
      id: `${id}-empty`,
      severity: "error",
      fieldPath: "messages",
      message: "Dataset contains no messages.",
      datasetId: id,
      hint: "Add at least one message to the dataset.",
    });
    return issues;
  }

  const seenIds = new Set<string>();

  for (let i = 0; i < dataset.messages.length; i++) {
    const msg = dataset.messages[i];
    const path = `messages[${i}]`;

    // Mandatory fields
    if (!msg.id) {
      issues.push({
        id: `${id}-msg-${i}-no-id`,
        severity: "error",
        fieldPath: `${path}.id`,
        message: `Message at index ${i} is missing an id.`,
        datasetId: id,
        hint: "Assign a unique string id to every message.",
      });
    } else if (seenIds.has(msg.id)) {
      issues.push({
        id: `${id}-msg-${msg.id}-duplicate`,
        severity: "error",
        fieldPath: `${path}.id`,
        message: `Duplicate message id "${msg.id}".`,
        datasetId: id,
        recordId: msg.id,
        hint: "Each message id must be unique.",
      });
    }
    seenIds.add(msg.id);

    if (!msg.subject) {
      issues.push({
        id: `${id}-msg-${msg.id}-no-subject`,
        severity: "warning",
        fieldPath: `${path}.subject`,
        message: `Message "${msg.id}" has no subject.`,
        datasetId: id,
        recordId: msg.id,
        hint: "Consider adding a subject line.",
      });
    }

    if (!msg.body) {
      issues.push({
        id: `${id}-msg-${msg.id}-no-body`,
        severity: "error",
        fieldPath: `${path}.body`,
        message: `Message "${msg.id}" has no body content.`,
        datasetId: id,
        recordId: msg.id,
        hint: "Every message should have a body.",
      });
    }

    // ISO date check
    if (!ISO_DATE_RE.test(msg.date)) {
      issues.push({
        id: `${id}-msg-${msg.id}-bad-date`,
        severity: "error",
        fieldPath: `${path}.date`,
        message: `Message "${msg.id}" has an invalid date "${msg.date}". Expected ISO 8601 local format.`,
        datasetId: id,
        recordId: msg.id,
        hint: "Use the format yyyy-MM-ddTHH:mm.",
      });
    }

    // Sender domain safety
    if (!SAFE_DOMAIN_RE.test(msg.sender.address)) {
      issues.push({
        id: `${id}-msg-${msg.id}-sender-domain`,
        severity: "warning",
        fieldPath: `${path}.sender.address`,
        message: `Sender address "${msg.sender.address}" uses an unsafe domain.`,
        datasetId: id,
        recordId: msg.id,
        hint: "Use example.com, example.org, or *.stealth.demo.",
      });
    }

    // Recipient domain safety
    for (let r = 0; r < msg.recipients.length; r++) {
      if (!SAFE_DOMAIN_RE.test(msg.recipients[r])) {
        issues.push({
          id: `${id}-msg-${msg.id}-recipient-${r}-domain`,
          severity: "warning",
          fieldPath: `${path}.recipients[${r}]`,
          message: `Recipient "${msg.recipients[r]}" uses an unsafe domain.`,
          datasetId: id,
          recordId: msg.id,
          hint: "Use example.com, example.org, or *.stealth.demo.",
        });
      }
    }

    // Secret pattern check
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(msg.body)) {
        issues.push({
          id: `${id}-msg-${msg.id}-secret-pattern`,
          severity: "error",
          fieldPath: `${path}.body`,
          message: `Message "${msg.id}" body may contain a secret.`,
          datasetId: id,
          recordId: msg.id,
          hint: "Remove any private keys, tokens, or secrets from demo data.",
        });
        break;
      }
    }

    // Proof record consistency
    if (msg.proofRecord) {
      const pr = msg.proofRecord;
      if (!["verified", "pending", "failed", "none"].includes(pr.status)) {
        issues.push({
          id: `${id}-msg-${msg.id}-proof-status`,
          severity: "error",
          fieldPath: `${path}.proofRecord.status`,
          message: `Invalid proof status "${pr.status}".`,
          datasetId: id,
          recordId: msg.id,
          hint: "Use verified, pending, failed, or none.",
        });
      }
      if (!ISO_DATE_RE.test(pr.timestamp)) {
        issues.push({
          id: `${id}-msg-${msg.id}-proof-timestamp`,
          severity: "error",
          fieldPath: `${path}.proofRecord.timestamp`,
          message: `Proof record timestamp "${pr.timestamp}" is not ISO 8601.`,
          datasetId: id,
          recordId: msg.id,
        });
      }
    }
  }

  // Sender uniqueness
  if (dataset.senders) {
    const seenAddresses = new Set<string>();
    for (let s = 0; s < dataset.senders.length; s++) {
      const sender = dataset.senders[s];
      const addr = sender.address.toLowerCase();
      if (seenAddresses.has(addr)) {
        issues.push({
          id: `${id}-sender-${s}-duplicate`,
          severity: "error",
          fieldPath: `senders[${s}].address`,
          message: `Duplicate sender address "${sender.address}".`,
          datasetId: id,
          hint: "Each sender address must be unique.",
        });
      }
      seenAddresses.add(addr);

      if (!SAFE_DOMAIN_RE.test(sender.address)) {
        issues.push({
          id: `${id}-sender-${s}-domain`,
          severity: "warning",
          fieldPath: `senders[${s}].address`,
          message: `Sender address "${sender.address}" uses an unsafe domain.`,
          datasetId: id,
          hint: "Use example.com, example.org, or *.stealth.demo.",
        });
      }
    }
  }

  return issues;
}
