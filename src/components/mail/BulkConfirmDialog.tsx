import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { BulkActionConfirmation } from "./bulk-actions";

type BulkConfirmDialogProps = {
  confirmation: BulkActionConfirmation | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function BulkConfirmDialog({ confirmation, onCancel, onConfirm }: BulkConfirmDialogProps) {
  return (
    <AlertDialog open={!!confirmation} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        {confirmation && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmation.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm}>{confirmation.confirmLabel}</AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
