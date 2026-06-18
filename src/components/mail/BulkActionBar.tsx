import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Archive,
  BadgeCheck,
  Ban,
  CheckCheck,
  Clock3,
  FolderInput,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { SNOOZE_PRESETS, type SnoozeChoice } from "@/features/snooze";
import {
  canApplyBulkActionToEmail,
  getBulkActionIdsForContext,
  MOVE_FOLDERS,
  type BulkActionId,
  type BulkActionRequest,
  type BulkFailure,
  type BulkProgressState,
  type BulkSnoozeChoice,
} from "./bulk-actions";
import { getFolderLabel, type Email, type MailFolder, type MailLocation } from "./data";

type BulkActionBarProps = {
  selectedEmails: Email[];
  folder: MailFolder;
  customFolder?: string | null;
  onAction: (request: BulkActionRequest) => void;
  onClearSelection: () => void;
  bulkProgress: BulkProgressState | null;
  bulkFailures: BulkFailure[];
};

export function BulkActionBar({
  selectedEmails,
  folder,
  customFolder,
  onAction,
  onClearSelection,
  bulkProgress,
  bulkFailures,
}: BulkActionBarProps) {
  const actions = useMemo(
    () => getBulkActionIdsForContext(selectedEmails, folder, customFolder),
    [selectedEmails, folder, customFolder],
  );
  const starValue = selectedEmails.some((email) => !email.starred);
  const moveTargets = useMemo(
    () =>
      MOVE_FOLDERS.filter((target) =>
        selectedEmails.some((email) =>
          canApplyBulkActionToEmail({ action: "move", folder: target }, email),
        ),
      ),
    [selectedEmails],
  );
  const snoozeChoices = useMemo(
    () =>
      SNOOZE_PRESETS.filter((preset) =>
        selectedEmails.some((email) =>
          canApplyBulkActionToEmail(
            { action: "snooze", snoozeChoice: preset.id as BulkSnoozeChoice },
            email,
          ),
        ),
      ),
    [selectedEmails],
  );
  const progressValue = bulkProgress
    ? Math.round((bulkProgress.completed / Math.max(bulkProgress.total, 1)) * 100)
    : 0;

  if (selectedEmails.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative z-20 mx-3 rounded-t-[8px] border-x border-t border-white/10 bg-white/[0.045] p-2 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-medium text-foreground">
          {selectedEmails.length} selected
        </span>

        {actions.includes("archive") && (
          <ActionButton
            icon={Archive}
            label="Archive"
            onClick={() => onAction({ action: "archive" })}
            disabled={!!bulkProgress}
          />
        )}

        {actions.includes("star") && (
          <ActionButton
            icon={Star}
            label={starValue ? "Star" : "Unstar"}
            onClick={() => onAction({ action: "star", value: starValue })}
            disabled={!!bulkProgress}
          />
        )}

        {actions.includes("mark-read") && (
          <ActionButton
            icon={CheckCheck}
            label="Mark read"
            onClick={() => onAction({ action: "mark-read" })}
            disabled={!!bulkProgress}
          />
        )}

        {snoozeChoices.length > 0 && (
          <ActionDropdown
            icon={Clock3}
            label="Snooze"
            disabled={!!bulkProgress}
            items={snoozeChoices.map((preset) => ({
              id: preset.id as BulkSnoozeChoice,
              label: preset.label,
              onClick: () =>
                onAction({ action: "snooze", snoozeChoice: preset.id as BulkSnoozeChoice }),
            }))}
          />
        )}

        {actions.includes("approve") && (
          <ActionButton
            icon={BadgeCheck}
            label="Approve"
            onClick={() => onAction({ action: "approve" })}
            disabled={!!bulkProgress}
          />
        )}

        {actions.includes("block") && (
          <ActionButton
            icon={Ban}
            label="Block"
            tone="danger"
            onClick={() => onAction({ action: "block" })}
            disabled={!!bulkProgress}
          />
        )}

        {actions.includes("move") && (
          <ActionDropdown
            icon={FolderInput}
            label="Move"
            disabled={!!bulkProgress}
            items={moveTargets.map((target) => ({
              id: target,
              label: getFolderLabel(target),
              onClick: () => onAction({ action: "move", folder: target }),
            }))}
          />
        )}

        <button
          type="button"
          onClick={onClearSelection}
          disabled={!!bulkProgress}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.035] px-2.5 text-[11px] font-medium text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {bulkProgress && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
            <span className="truncate">{bulkProgress.label}</span>
            <span className="shrink-0 tabular-nums">
              {bulkProgress.completed}/{bulkProgress.total}
            </span>
          </div>
          <Progress value={progressValue} className="h-1.5" />
        </div>
      )}

      {bulkFailures.length > 0 && (
        <div className="mt-2 rounded-lg border border-red-300/20 bg-red-300/[0.06] p-2 text-[11px] text-red-100">
          <p className="font-medium">
            {bulkFailures.length} message{bulkFailures.length === 1 ? "" : "s"} skipped
          </p>
          <ul className="mt-1 space-y-0.5 text-red-100/75">
            {bulkFailures.slice(0, 3).map((failure) => (
              <li key={failure.id} className="truncate">
                {failure.subject}: {failure.reason}
              </li>
            ))}
            {bulkFailures.length > 3 && (
              <li className="text-muted-foreground">+{bulkFailures.length - 3} more</li>
            )}
          </ul>
        </div>
      )}
    </motion.div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger"
          ? "border-red-300/20 bg-red-300/[0.08] text-red-100 hover:bg-red-300/[0.14]"
          : "border-white/10 bg-white/[0.04] text-foreground/90 hover:bg-white/[0.08]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
}

function ActionDropdown({
  icon: Icon,
  label,
  disabled,
  items,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  items: { id: BulkActionId | MailLocation | SnoozeChoice; label: string; onClick: () => void }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionButton icon={Icon} label={label} onClick={() => undefined} disabled={disabled} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="z-[120]">
        {items.map((item) => (
          <DropdownMenuItem key={`${item.id}`} onClick={item.onClick} className="text-xs">
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
