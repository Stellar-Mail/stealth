import type { Email } from "@/components/mail/data";
import { isVerified } from "@/components/mail/data";
import type { AttachmentInfo, AttachmentOrigin, AttachmentRiskState } from "./types";

const CHECKSUM_CACHE = new Map<string, string>();

function pseudoChecksum(name: string): string {
  if (CHECKSUM_CACHE.has(name)) return CHECKSUM_CACHE.get(name)!;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const raw = Math.abs(hash).toString(16).padStart(8, "0");
  const result = `${raw.slice(0, 8)}${raw.slice(0, 4)}`;
  CHECKSUM_CACHE.set(name, result);
  return result;
}

export function deriveChecksum(name: string): string {
  return pseudoChecksum(name);
}

export function deriveOrigin(email: Email): AttachmentOrigin {
  if (email.folder === "encrypted" || email.labels?.some((l) => l === "Encrypted")) {
    return "encrypted";
  }
  if (email.verifiedSender || isVerified(email) || email.senderPolicy === "allow") {
    return "known";
  }
  return "unknown";
}

export function deriveRiskState(
  origin: AttachmentOrigin,
  email: Email,
  _index: number,
): AttachmentRiskState {
  if (email.senderPolicy === "block") return "blocked";
  if (origin === "known") return "verified";
  if (origin === "encrypted") return "scanning";
  if (email.postageAmount) return "scanning";
  return "failed";
}

export function deriveAttachmentInfo(
  base: { name: string; size: string; type: string },
  email: Email,
  index: number,
): AttachmentInfo {
  const origin = deriveOrigin(email);
  return {
    name: base.name,
    size: base.size,
    type: base.type,
    checksum: deriveChecksum(base.name),
    origin,
    riskState: deriveRiskState(origin, email, index),
  };
}

export function deriveAttachmentInfoList(
  attachments: { name: string; size: string; type: string }[],
  email: Email,
): AttachmentInfo[] {
  return attachments.map((att, i) => deriveAttachmentInfo(att, email, i));
}
