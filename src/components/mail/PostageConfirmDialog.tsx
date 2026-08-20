import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/mail/useSession";
import { Loader2 } from "lucide-react";
import type { PostageAction } from "@/features/ledger/postage-types";
import { xlmFromStroops } from "@/features/compose/RecipientPolicyBanner";

interface PostageConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: PostageAction | null;
  amount: string; // in stroops
  onConfirm: () => void;
  isPending: boolean;
}

export function PostageConfirmDialog({
  open,
  onOpenChange,
  action,
  amount,
  onConfirm,
  isPending,
}: PostageConfirmDialogProps) {
  const { data: sessionData } = useSession();

  const isStaleSession = React.useMemo(() => {
    if (!sessionData?.session?.lastActiveAt) return false;
    const lastActive = new Date(sessionData.session.lastActiveAt).getTime();
    const now = Date.now();
    return now - lastActive > 5 * 60 * 1000; // 5 minutes
  }, [sessionData]);

  if (!action) return null;

  const title = {
    settle: "Settle Escrow",
    refund: "Refund Escrow",
    dispute: "Dispute Escrow",
    expire: "Expire Escrow",
    reclaim: "Reclaim Escrow",
  }[action];

  const description = {
    settle: "This will release the escrowed funds to your account.",
    refund: "This will return the escrowed funds back to the sender.",
    dispute: "This will raise a dispute, locking the funds until resolved.",
    expire: "This will mark the escrow as expired.",
    reclaim: "This will reclaim your funds from an expired escrow.",
  }[action];

  const amountXlm = xlmFromStroops(amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex justify-between items-center bg-muted/50 p-3 rounded-md">
            <span className="text-sm font-medium">Amount</span>
            <span className="text-sm font-bold">{amountXlm} XLM</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isStaleSession ? "Re-authenticate" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
