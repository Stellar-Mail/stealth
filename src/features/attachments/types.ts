export type AttachmentRiskState = "scanning" | "verified" | "blocked" | "failed";

export type AttachmentOrigin = "known" | "encrypted" | "unknown";

export type AttachmentInfo = {
  name: string;
  size: string;
  type: string;
  checksum: string;
  origin: AttachmentOrigin;
  riskState: AttachmentRiskState;
};

export type AttachmentAction = "preview" | "download" | "copy-hash" | "quarantine";

export type AttachmentActions = {
  onPreview?: (attachment: AttachmentInfo) => void;
  onQuarantine?: (attachment: AttachmentInfo) => void;
};
