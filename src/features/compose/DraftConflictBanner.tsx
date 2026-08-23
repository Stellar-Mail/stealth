import { AlertTriangle, ArrowDownToLine, Copy, RefreshCw } from "lucide-react";
import type { Draft } from "@/server/api/domain";

interface DraftConflictBannerProps {
  conflictDraft: Draft;
  onOverwrite: () => void;
  onLoadServer: () => void;
  onForkNew: () => void;
}

export function DraftConflictBanner({
  conflictDraft,
  onOverwrite,
  onLoadServer,
  onForkNew,
}: DraftConflictBannerProps) {
  return (
    <div
      role="alert"
      className="m-4 p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 backdrop-blur-md shadow-lg"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-2 flex-1">
          <div className="text-sm font-semibold text-amber-300">
            Concurrent edit detected (Server revision {conflictDraft.version})
          </div>
          <p className="text-xs text-amber-200/80 leading-relaxed">
            This draft was updated in another browser tab or device. Choose how you would like to
            resolve this conflict:
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onLoadServer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg border border-amber-500/40 transition-colors"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              Load server copy
            </button>

            <button
              type="button"
              onClick={onOverwrite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-amber-200 rounded-lg border border-neutral-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Overwrite server with local edits
            </button>

            <button
              type="button"
              onClick={onForkNew}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Keep both (Save as separate copy)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
