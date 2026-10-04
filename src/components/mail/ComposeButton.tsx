import { ComposeIcon } from "@/features/design-system/components/mail-icons";
import { cn } from "@/lib/utils";

export function ComposeButton({
  collapsed = false,
  onCompose,
}: {
  collapsed?: boolean;
  onCompose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCompose}
      aria-label={collapsed ? "Compose" : "Compose Ctrl+N"}
      aria-keyshortcuts="Control+N Meta+N"
      title={collapsed ? "Compose (Ctrl+N)" : undefined}
      className={cn("compose-launcher mt-3", collapsed && "compose-launcher--collapsed")}
    >
      <span aria-hidden="true" className="compose-launcher__frame" />
      <span aria-hidden="true" className="compose-launcher__face" />
      <span className="compose-launcher__content">
        <ComposeIcon className="h-[18px] w-[18px] shrink-0" />
        {!collapsed && <span className="mail-preview-heading">Compose</span>}
      </span>
      {!collapsed && <kbd className="compose-launcher__shortcut">Ctrl+N</kbd>}
    </button>
  );
}
