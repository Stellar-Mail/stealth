import type { ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  Clock,
  FolderInput,
  Forward,
  Mail,
  MoreHorizontal,
  Reply,
  ReplyAll,
  SquareArrowOutUpRight,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EmailViewActions } from "@/components/mail/EmailView";
import { getFolderLabel, type Email } from "@/components/mail/data";
import { DROP_TARGET_FOLDERS, getDropRejectionReason } from "@/components/mail/useDragDrop";

export function MailReaderToolbar({
  email,
  actions,
  children,
  onRespond,
  onClose,
}: {
  email: Email;
  actions: EmailViewActions;
  children: ReactNode;
  onRespond: (mode: "reply" | "reply-all" | "forward") => void;
  onClose?: () => void;
}) {
  return (
    <header className="mail-reader-toolbar reader-toolbar">
      <div className="reader-toolbar-heading">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="reader-command reader-reply"
            onClick={() => onRespond("reply")}
            disabled={!actions.onReply && !actions.onInlineSubmit}
          >
            <Reply aria-hidden="true" />
            Reply
          </button>
          <button
            type="button"
            className="reader-command reader-forward"
            onClick={() => onRespond("forward")}
            disabled={!actions.onForward && !actions.onInlineSubmit}
            aria-label="Forward"
            title="Forward"
          >
            <Forward aria-hidden="true" />
            <span>Forward</span>
          </button>
        </div>
      </div>
      <div role="group" aria-label="Message tools" className="reader-toolbar-tools">
        <button
          type="button"
          className="reader-command"
          disabled={!actions.onArchive}
          onClick={() => actions.onArchive?.(email)}
        >
          <Archive aria-hidden="true" />
          Archive
        </button>
        <button
          type="button"
          className="reader-command reader-delete"
          disabled={!actions.onTrash}
          onClick={() => actions.onTrash?.(email)}
          title="Move to trash"
        >
          <Trash2 aria-hidden="true" />
          Delete
        </button>
        <span className="flex-1" />
        {actions.onMarkUnread && (
          <button
            type="button"
            className="reader-command reader-icon-command"
            onClick={() => actions.onMarkUnread?.(email)}
            aria-label="Mark as unread"
            title="Mark as unread"
          >
            <Mail aria-hidden="true" />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="reader-command reader-icon-command"
              aria-label="More message actions"
              title="More message actions"
            >
              <MoreHorizontal aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="reader-action-menu w-52">
            <DropdownMenuItem
              disabled={!actions.onReplyAll && !actions.onInlineSubmit}
              onSelect={() => onRespond("reply-all")}
            >
              <ReplyAll />
              Reply all
            </DropdownMenuItem>
            {actions.onReply && actions.onInlineSubmit && (
              <DropdownMenuItem onSelect={() => actions.onReply?.(email)}>
                <SquareArrowOutUpRight />
                Reply in compose
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {actions.onToggleStar && (
              <DropdownMenuItem onSelect={() => actions.onToggleStar?.(email)}>
                <Star />
                {email.starred ? "Remove star" : "Add star"}
              </DropdownMenuItem>
            )}
            {email.snooze && actions.onUnsnooze ? (
              <DropdownMenuItem onSelect={() => actions.onUnsnooze?.(email)}>
                <Clock />
                Unsnooze
              </DropdownMenuItem>
            ) : (
              actions.onSnooze && (
                <DropdownMenuItem onSelect={() => actions.onSnooze?.(email)}>
                  <Clock />
                  Snooze
                </DropdownMenuItem>
              )
            )}
            {actions.onMove && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput />
                  Move to
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="reader-action-menu">
                  {DROP_TARGET_FOLDERS.map((folder) => (
                    <DropdownMenuItem
                      key={folder}
                      disabled={Boolean(getDropRejectionReason(email, folder))}
                      title={getDropRejectionReason(email, folder) ?? undefined}
                      onSelect={() => actions.onMove?.(email, folder)}
                    >
                      {getFolderLabel(folder)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {actions.onConvertSender && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => actions.onConvertSender?.(email)}>
                  <UserRound />
                  Manage sender
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {onClose && (
          <button
            type="button"
            className="reader-command reader-icon-command border-l border-surface-tint/10"
            onClick={onClose}
            aria-label="Close conversation"
            title="Close conversation"
          >
            <X aria-hidden="true" className="hidden md:block" />
            <ArrowLeft aria-hidden="true" className="md:hidden" />
          </button>
        )}
      </div>
    </header>
  );
}
