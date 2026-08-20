import { useCallback, useState } from "react";

import {
  buildBulkActionPatch,
  getBulkActionConfirmation,
  getBulkActionProgressLabel,
  type BulkActionConfirmation,
  type BulkActionRequest,
  type BulkFailure,
  type BulkProgressState,
} from "@/components/mail/bulk-actions";
import type { Email } from "@/components/mail/data";
import type { TrashResult } from "./useMailSource";
import type { FeedbackTone } from "@/features/design-system/feedback/use-feedback";
import type { MailboxFlagsPatch } from "@/lib/api";
import { flagsPatchFromEmail } from "./live-mailbox";

function delay(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export function useMailBulkActions({
  selectedEmails,
  updateEmail,
  trashEmail,
  mutateMailbox,
  onToast,
  onClearSelection,
  paceMs = 90,
}: {
  selectedEmails: Email[];
  updateEmail: (id: string, patch: Partial<Email>) => void;
  trashEmail: (email: Email) => Promise<TrashResult>;
  mutateMailbox?: (email: Email, patch: MailboxFlagsPatch) => Promise<TrashResult>;
  onToast: (message: string, options?: { tone: FeedbackTone }) => void;
  onClearSelection: () => void;
  paceMs?: number;
}) {
  const [bulkProgress, setBulkProgress] = useState<BulkProgressState | null>(null);
  const [bulkFailures, setBulkFailures] = useState<BulkFailure[]>([]);
  const [bulkConfirmation, setBulkConfirmation] = useState<{
    request: BulkActionRequest;
    confirmation: BulkActionConfirmation;
  } | null>(null);

  const runBulkAction = useCallback(
    async (request: BulkActionRequest) => {
      if (!selectedEmails.length) return;

      const targets = selectedEmails;
      let failures: BulkFailure[] = [];
      setBulkFailures([]);
      setBulkProgress({
        action: request.action,
        label: getBulkActionProgressLabel(request, targets.length),
        total: targets.length,
        completed: 0,
        failures: [],
      });

      for (const email of targets) {
        const result = buildBulkActionPatch(request, email);
        if (!result.ok) {
          failures = [...failures, { id: email.id, subject: email.subject, reason: result.reason }];
          setBulkProgress((current) =>
            current
              ? {
                  ...current,
                  completed: current.completed + 1,
                  failures,
                }
              : current,
          );
          continue;
        }

        if (result.patch.folder === "trash") {
          const trash = await trashEmail(email);
          if (!trash.ok) {
            failures = [
              ...failures,
              { id: email.id, subject: email.subject, reason: trash.reason },
            ];
          }
        } else {
          const flags = flagsPatchFromEmail(result.patch);
          if (flags && mutateMailbox) {
            const live = await mutateMailbox(email, flags);
            if (!live.ok) {
              failures = [
                ...failures,
                { id: email.id, subject: email.subject, reason: live.reason },
              ];
            }
          } else {
            updateEmail(email.id, result.patch);
          }
        }

        await delay(paceMs);
        setBulkProgress((current) =>
          current
            ? {
                ...current,
                completed: current.completed + 1,
                failures,
              }
            : current,
        );
      }

      const successCount = targets.length - failures.length;
      setBulkFailures(failures);
      setBulkProgress((current) =>
        current
          ? {
              ...current,
              completed: current.total,
              failures,
            }
          : current,
      );
      onClearSelection();

      if (failures.length > 0) {
        onToast(
          `${failures.length} selected message${
            failures.length === 1 ? "" : "s"
          } could not be updated`,
          { tone: "danger" },
        );
      } else if (successCount > 0) {
        onToast(`${getBulkActionProgressLabel(request, successCount)} complete`);
      }
    },
    [mutateMailbox, onClearSelection, onToast, paceMs, selectedEmails, trashEmail, updateEmail],
  );

  const handleBulkActionRequest = useCallback(
    (request: BulkActionRequest) => {
      if (!selectedEmails.length) return;
      const confirmation = getBulkActionConfirmation(request, selectedEmails);
      if (confirmation) {
        setBulkConfirmation({ request, confirmation });
        return;
      }
      void runBulkAction(request);
    },
    [runBulkAction, selectedEmails],
  );

  return {
    bulkProgress,
    bulkFailures,
    bulkConfirmation,
    setBulkConfirmation,
    runBulkAction,
    handleBulkActionRequest,
  };
}
