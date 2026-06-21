import type { Email, ReceiptState, SenderPolicy } from "@/components/mail/data";
import { getFolderLabel, isVerified } from "@/components/mail/data";
import { getSenderPolicyOption, type SenderPolicyChoice } from "@/features/sender-conversion";

export type SenderIdentityTarget = {
  emailId: string;
  sender: string;
  address: string;
  currentPolicy?: SenderPolicy;
};

export type SenderConversationSummary = {
  id: string;
  subject: string;
  preview: string;
  time: string;
  folderLabel: string;
  verified: boolean;
  postage: string;
  receipt: ReceiptState | "none";
};

export type SenderIdentityProfile = {
  displayName: string;
  address: string;
  policyLabel: string;
  policySummary: string;
  policyChoice: SenderPolicyChoice | undefined;
  statusLabel: string;
  statusSummary: string;
  proofSummary: string;
  receiptSummary: string;
  postageSummary: string;
  conversationCount: number;
  recentConversations: SenderConversationSummary[];
  lastProofLabel: string;
  lastProofDetail: string;
  lastReceiptLabel: string;
  lastReceiptDetail: string;
  lastPostageLabel: string;
  lastPostageDetail: string;
};

export function formatPostageAmount(stroops?: string) {
  if (!stroops) return "0.0 XLM";

  try {
    const value = BigInt(stroops);
    const xlm = Number(value) / 10_000_000;
    return `${xlm.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 4,
    })} XLM`;
  } catch {
    return `${stroops} stroops`;
  }
}

function getPolicyLabel(policy: SenderPolicy | undefined) {
  if (!policy) return "Default";
  return getSenderPolicyOption(policy).badge;
}

function getPolicySummary(policy: SenderPolicy | undefined) {
  if (!policy) return "No explicit rule yet. The sender is still pending review.";
  return getSenderPolicyOption(policy).summary;
}

export function buildSenderIdentityProfile(
  target: SenderIdentityTarget,
  emails: Email[],
): SenderIdentityProfile {
  const related = emails.filter(
    (email) => email.email === target.address || email.from === target.sender,
  );

  const recentConversations = related.slice(0, 3).map((email) => ({
    id: email.id,
    subject: email.subject,
    preview: email.preview,
    time: email.time,
    folderLabel: getFolderLabel(email.folder),
    verified: email.verifiedSender || isVerified(email) || email.senderPolicy === "verify",
    postage: formatPostageAmount(email.postageAmount),
    receipt: email.receiptState ?? "none",
  }));

  const verifiedCount = related.filter(
    (email) => email.verifiedSender || isVerified(email) || email.senderPolicy === "verify",
  ).length;
  const sentReceipts = related.filter((email) => email.receiptState === "sent").length;
  const pendingReceipts = related.filter((email) => email.receiptState === "pending").length;
  const postagePaid = related.filter((email) => Boolean(email.postageAmount)).length;
  const latestProof = related.find(
    (email) => email.verifiedSender || isVerified(email) || email.senderPolicy === "verify",
  );
  const latestReceipt = related.find((email) => email.receiptState && email.receiptState !== "none");
  const latestPostage = related.find((email) => Boolean(email.postageAmount));

  const policyChoice = target.currentPolicy;
  const policyLabel = getPolicyLabel(policyChoice);
  const policySummary = getPolicySummary(policyChoice);

  const statusLabel =
    policyChoice === "block"
      ? "Blocked"
      : policyChoice === "allow"
        ? "Allowed"
        : policyChoice === "verify"
          ? "Verification required"
          : verifiedCount > 0
            ? "Verified"
            : "Pending review";

  const statusSummary =
    policyChoice === "block"
      ? "Future mail from this sender is routed to Spam."
      : policyChoice === "allow"
        ? "Future mail from this sender lands in your inbox."
        : policyChoice === "verify"
          ? "Mail is accepted only after identity proof clears."
          : verifiedCount > 0
            ? "The sender has at least one verified record in recent mail."
            : "No sender rule has been applied yet.";

  const proofSummary =
    verifiedCount > 0
      ? `${verifiedCount} verified message${verifiedCount === 1 ? "" : "s"} on record`
      : "No verified proof on record yet";

  const receiptSummary =
    sentReceipts > 0 || pendingReceipts > 0
      ? [
          sentReceipts > 0 ? `${sentReceipts} receipt${sentReceipts === 1 ? "" : "s"} sent` : "",
          pendingReceipts > 0
            ? `${pendingReceipts} receipt${pendingReceipts === 1 ? "" : "s"} pending`
            : "",
        ]
          .filter(Boolean)
          .join(" | ")
      : "No receipt history recorded";

  const postageSummary =
    postagePaid > 0
      ? `${postagePaid} paid message${postagePaid === 1 ? "" : "s"} | latest ${latestPostage ? formatPostageAmount(latestPostage.postageAmount) : "0.0 XLM"}`
      : "No postage attached to recent mail";

  return {
    displayName: target.sender,
    address: target.address,
    policyLabel,
    policySummary,
    policyChoice,
    statusLabel,
    statusSummary,
    proofSummary,
    receiptSummary,
    postageSummary,
    conversationCount: related.length,
    recentConversations,
    lastProofLabel: latestProof ? "Latest proof" : "Proof pending",
    lastProofDetail: latestProof
      ? `${latestProof.subject} | ${latestProof.time}`
      : "No cryptographic proof has been captured yet.",
    lastReceiptLabel: latestReceipt ? "Latest receipt" : "Receipt pending",
    lastReceiptDetail: latestReceipt
      ? `${latestReceipt.subject} | ${latestReceipt.time}`
      : "No read or delivery receipt has been recorded yet.",
    lastPostageLabel: latestPostage ? "Latest postage" : "Postage pending",
    lastPostageDetail: latestPostage
      ? `${formatPostageAmount(latestPostage.postageAmount)} | ${latestPostage.subject}`
      : "No postage has been attached yet.",
  };
}
