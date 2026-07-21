export { attachPrivateNote, safeAttachPrivateNote } from "./services/privateNoteOnEmail";

export {
  PRIVATE_NOTE_LIMITS,
  checkPrivateNoteInputLimits,
  sanitizePrivateNoteInput,
  sanitizeText,
  validatePrivateNoteInput,
  validatePrivateNoteOptions,
} from "./services/guards";

export { failureFixtures, successFixtures } from "./services/fixtures";
export type { PrivateNoteFailureFixture, PrivateNoteSuccessFixture } from "./services/fixtures";

export type {
  PrivateNoteAttachmentInput,
  PrivateNoteAttachmentOptions,
  PrivateNoteAttachmentOutput,
  PrivateNoteErrorCode,
  PrivateNoteImportance,
  PrivateNoteMetadata,
  PrivateNoteValidationIssue,
  PrivateNoteVisibility,
  SafePrivateNoteResult,
} from "./types/privateNoteOnEmail";
