import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfflineBannerProps {
  isOffline: boolean;
  queuedCount?: number;
}

export function OfflineBanner({ isOffline, queuedCount = 0 }: OfflineBannerProps) {
  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative z-50 overflow-hidden bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-md"
        >
          <div className="flex items-center justify-center gap-3 px-4 py-2 text-xs font-medium text-amber-200/90 shadow-sm">
            <WifiOff className="h-3.5 w-3.5" />
            <span>
              You are offline. Actions will be queued and sent when connection is restored.
            </span>
            {queuedCount > 0 && (
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-amber-500/30">
                <AlertCircle className="h-3 w-3" />
                <span>{queuedCount} action{queuedCount !== 1 ? "s" : ""} queued</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
