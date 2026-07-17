import { draftSample } from "./fixtures/draftFixtures";
import type { Draft } from "./types/draft";
import { buildPublishChecklist } from "./publishChecklist";
import type { PublishChecklistResult } from "./publishChecklist-types";
import { demoValidationIssues, demoValidationIssuesEmpty } from "./validationFixtures";

/** A single valid draft for checklist demos. */
export const publishReadyDrafts: Draft[] = [draftSample];

/** Drafts missing recipients — triggers a blocked checklist item. */
export const publishBlockedDraftsNoRecipients: Draft[] = [
  {
    id: "draft-empty-recipients",
    subject: "No recipients",
    body: "This draft cannot be published yet.",
    recipients: [],
  },
];

/** Draft with a non-demo recipient domain — triggers safe-domain blocker. */
export const publishBlockedDraftsUnsafeDomain: Draft[] = [
  {
    id: "draft-unsafe",
    subject: "Unsafe recipient",
    body: "Uses a real-looking domain.",
    recipients: ["user@gmail.com"],
  },
];

/** Checklist result when the dataset is ready to publish. */
export const demoPublishChecklistReady: PublishChecklistResult = buildPublishChecklist(
  publishReadyDrafts,
  demoValidationIssuesEmpty,
);

/** Checklist result with blockers from empty recipients. */
export const demoPublishChecklistBlocked: PublishChecklistResult = buildPublishChecklist(
  publishBlockedDraftsNoRecipients,
  demoValidationIssuesEmpty,
);

/** Checklist result combining draft issues and validation errors. */
export const demoPublishChecklistWithValidationErrors: PublishChecklistResult =
  buildPublishChecklist(publishReadyDrafts, demoValidationIssues);
