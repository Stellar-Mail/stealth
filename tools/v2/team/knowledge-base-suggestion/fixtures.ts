/**
 * fixtures.ts — Knowledge Base Suggestion (execution contract fixtures)
 *
 * Deterministic local fixtures used by the contract tests and as documentation
 * of the contract shape.
 */

import type { KbArticle } from "./types";

/** A small deterministic KB corpus. */
export const KB_ARTICLES: KbArticle[] = [
  {
    id: "kb-onboarding",
    title: "Team Onboarding Checklist",
    tags: ["onboarding", "getting-started", "team"],
    summary: "Steps for ramping new team members.",
  },
  {
    id: "kb-billing",
    title: "Billing and Invoices FAQ",
    tags: ["billing", "invoices", "finance"],
    summary: "How to read invoices and handle disputes.",
  },
  {
    id: "kb-security",
    title: "Security Incident Response",
    tags: ["security", "incident", "runbook"],
    summary: "What to do during a security incident.",
  },
];
