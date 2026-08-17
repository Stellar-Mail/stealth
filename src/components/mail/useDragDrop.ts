import { useState } from "react";
import { canMoveEmail, MOVE_FOLDERS } from "./bulk-actions";
import type { Email, MailLocation } from "./data";

export type DragState = {
  emailIds: string[];
  sourceFolder: MailLocation;
};

export type DropResult = { ok: true } | { ok: false; reason: string };

/** Protocol folders cannot be drag-targets (messages cannot be moved into them). */
const PROTOCOL_FOLDERS = new Set<MailLocation>(["verified", "pending", "requests", "encrypted"]);

/** Folders that are valid drop targets for drag-and-drop moves. */
export const DROP_TARGET_FOLDERS: MailLocation[] = MOVE_FOLDERS;

export function canDragEmail(email: Email): boolean {
  return canMoveEmail(email);
}

export function getDropRejectionReason(email: Email, target: MailLocation): string | null {
  if (!canMoveEmail(email)) {
    if (PROTOCOL_FOLDERS.has(email.folder)) {
      return "Protocol messages cannot be moved — they track required system state.";
    }
    return "This message cannot be moved.";
  }
  if (email.folder === target) return "Already in this folder.";
  if (!DROP_TARGET_FOLDERS.includes(target)) return "Messages cannot be moved to this folder.";
  return null;
}

export function useDragDrop() {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<MailLocation | null>(null);

  const startDrag = (emails: Email[]) => {
    const draggable = emails.filter(canDragEmail);
    if (draggable.length === 0) return;
    setDrag({
      emailIds: draggable.map((e) => e.id),
      sourceFolder: draggable[0].folder,
    });
  };

  const endDrag = () => {
    setDrag(null);
    setDropTarget(null);
  };

  return { drag, dropTarget, setDropTarget, startDrag, endDrag };
}
