import type { SenderPersona } from "./types";
import type { ValidationIssue } from "../validation-types";

// Safe domains constraint for demo admin data.
const SENDER_SAFE_DOMAIN_PATTERN = /(@example\.(com|org)|@([\w.-]+\.)?stealth\.demo)$/i;

export function validateSenderPersona(persona: SenderPersona): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!persona.name || persona.name.trim() === "") {
    issues.push({
      id: `sp-${persona.id}-name-empty`,
      severity: "error",
      fieldPath: "name",
      message: "Sender name is required.",
      datasetId: "sender-personas",
      recordId: persona.id,
      hint: "Enter a name for the sender persona.",
    });
  }

  const normalizedEmail = persona.email.replace("*", "@");
  if (!SENDER_SAFE_DOMAIN_PATTERN.test(normalizedEmail)) {
    issues.push({
      id: `sp-${persona.id}-unsafe-email`,
      severity: "warning",
      fieldPath: "email",
      message: `Sender email "${persona.email}" uses an external or unverified domain.`,
      datasetId: "sender-personas",
      recordId: persona.id,
      hint: "For safety, stick to example.com, example.org, or *.stealth.demo.",
    });
  }

  return issues;
}
