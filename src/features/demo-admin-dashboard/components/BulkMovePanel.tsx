import { useMemo, useState } from "react";
import { ArrowRight, FolderInput, MoveRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MESSAGE_FOLDERS,
  type EditableMessage,
  type MessageFolder,
} from "../constants/messageListEditorModel";
import {
  applyBulkFolderMove,
  getMessageFolderLabel,
  previewBulkFolderMove,
  summarizeBulkFolderMove,
  validateBulkFolderMove,
  type BulkMoveEditResult,
} from "../bulkMovePanel";

export interface BulkMovePanelProps {
  /** Full demo message list used to resolve moves. */
  messages: EditableMessage[];
  /** IDs of the messages selected for a bulk move. */
  selectedIds: string[];
  /** Called with the updated list and audit result after a successful move. */
  onApply?: (result: BulkMoveEditResult) => void;
  className?: string;
}

export function BulkMovePanel({ messages, selectedIds, onApply, className }: BulkMovePanelProps) {
  const [targetFolder, setTargetFolder] = useState<MessageFolder>("drafts");
  const [lastResult, setLastResult] = useState<BulkMoveEditResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedMessages = useMemo(
    () => messages.filter((message) => selectedIds.includes(message.id)),
    [messages, selectedIds],
  );

  const preview = useMemo(
    () => previewBulkFolderMove(messages, selectedIds, targetFolder),
    [messages, selectedIds, targetFolder],
  );

  const handleMove = () => {
    const validation = validateBulkFolderMove(messages, selectedIds, targetFolder);
    if (!validation.ok) {
      setValidationError(validation.error);
      setLastResult(null);
      return;
    }

    setValidationError(null);
    const result = applyBulkFolderMove(messages, selectedIds, targetFolder);
    setLastResult(result);
    onApply?.(result);
  };

  if (selectedMessages.length === 0) {
    return (
      <section
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 text-center",
          className,
        )}
      >
        <FolderInput className="h-8 w-8 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">
          No messages selected. Select one or more demo messages to move between folders.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4",
        className,
      )}
    >
      <header className="flex items-center gap-2">
        <MoveRight className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Bulk folder move</h3>
      </header>

      <p className="text-sm text-muted-foreground">
        Move {selectedMessages.length} selected message
        {selectedMessages.length === 1 ? "" : "s"} to another demo folder.
      </p>

      <ul className="flex flex-col gap-1">
        {selectedMessages.map((message) => (
          <li
            key={message.id}
            className="flex items-center justify-between rounded-lg border border-white/[0.06] px-3 py-2 text-sm"
          >
            <span className="truncate pr-3">{message.subject || "(no subject)"}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {getMessageFolderLabel(message.folder)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <label htmlFor="bulk-move-target-folder" className="text-sm font-medium">
          Destination folder
        </label>
        <select
          id="bulk-move-target-folder"
          value={targetFolder}
          onChange={(event) => setTargetFolder(event.target.value as MessageFolder)}
          className="rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-sm outline-none focus:border-sky-500/40"
        >
          {MESSAGE_FOLDERS.map((folder) => (
            <option key={folder} value={folder}>
              {getMessageFolderLabel(folder)}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-sm">
        <p className="font-medium">Move preview</p>
        <p className="mt-1 text-muted-foreground">
          {preview.movedCount} will move to {getMessageFolderLabel(preview.targetFolder)}
          {preview.skippedCount > 0
            ? `; ${preview.skippedCount} already in ${getMessageFolderLabel(preview.targetFolder)}`
            : ""}
          .
        </p>
        {preview.movedCount > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            {selectedMessages
              .filter((message) => message.folder !== targetFolder)
              .map((message) => (
                <li key={message.id} className="flex items-center gap-1">
                  <span className="truncate">{message.subject || message.id}</span>
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span>{getMessageFolderLabel(targetFolder)}</span>
                </li>
              ))}
          </ul>
        ) : null}
      </div>

      {validationError ? (
        <p className="text-sm text-rose-300" role="alert">
          {validationError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleMove}
        disabled={preview.movedCount === 0}
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
          preview.movedCount > 0
            ? "border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20"
            : "cursor-not-allowed border-white/[0.06] text-muted-foreground opacity-60",
        )}
      >
        <MoveRight className="h-4 w-4" />
        Move to {getMessageFolderLabel(targetFolder)}
      </button>

      {lastResult ? (
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-sm">
          <p className="font-medium">{summarizeBulkFolderMove(lastResult)}</p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
            {lastResult.changes
              .filter((change) => change.applied)
              .map((change) => (
                <li key={change.id}>
                  {change.subject}: {getMessageFolderLabel(change.fromFolder)} →{" "}
                  {getMessageFolderLabel(change.toFolder)}
                </li>
              ))}
            {lastResult.changes
              .filter((change) => !change.applied)
              .map((change) => (
                <li key={change.id}>
                  {change.subject}: skipped ({change.skippedReason})
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
