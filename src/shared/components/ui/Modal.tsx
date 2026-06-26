import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Generic accessible modal dialog.
 * Refactored to use semantic design tokens:
 * - Backdrop: bg-background-overlay
 * - Content surface: bg-surface-card
 * - Border: border-border
 * - Title/Text: text-foreground / text-muted-foreground
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background-overlay backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-md p-6 rounded-lg bg-surface-card border border-border shadow-glow flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h2 id="modal-title" className="text-lg font-medium text-foreground">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
};
