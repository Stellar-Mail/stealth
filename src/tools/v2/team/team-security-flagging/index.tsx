/**
 * Team Security Flagging Tool - Main Entry Point
 *
 * Self-contained security flagging tool with full accessibility support
 */

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Components
import { FlagList } from "./components/FlagList";
import { FlagDetail } from "./components/FlagDetail";
import { FlagForm } from "./components/FlagForm";
import { FlagFilters } from "./components/FlagFilters";

// States
import { EmptyState } from "./states/EmptyState";
import { LoadingState } from "./states/LoadingState";
import { ErrorState } from "./states/ErrorState";
import { SuccessState, SuccessBanner } from "./states/SuccessState";

// Hooks
import { useFlagData } from "./hooks/useFlagData";
import { useKeyboard } from "./hooks/useKeyboard";

// Types
import type { SecurityFlag, FlagFilters as FlagFiltersType } from "./types";

// Utils
import { announce } from "./utils/accessibility";
import { ARIA_LABELS } from "./constants";

interface TeamSecurityFlaggingProps {
  className?: string;
}

export function TeamSecurityFlagging({ className }: TeamSecurityFlaggingProps) {
  // State
  const [filters, setFilters] = useState<FlagFiltersType>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<SecurityFlag | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Data hook
  const {
    flags,
    selectedFlag,
    isLoading,
    error,
    selectFlag,
    createFlag,
    updateFlag,
    deleteFlag,
    refresh,
  } = useFlagData({ filters, autoLoad: true });

  // Keyboard shortcuts
  useKeyboard({
    enabled: true,
    onNewFlag: () => {
      setIsCreateDialogOpen(true);
    },
    onRefresh: () => {
      refresh();
    },
    onCloseDialog: () => {
      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
    },
  });

  // Handlers
  const handleCreateFlag = async (data: any) => {
    try {
      const newFlag = await createFlag(data);
      setIsCreateDialogOpen(false);
      selectFlag(newFlag);
      setSuccessMessage("Flag created successfully");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      // Error handling is done in the hook
    }
  };

  const handleUpdateFlag = async (data: any) => {
    if (!editingFlag) return;

    try {
      const updated = await updateFlag(editingFlag.id, data);
      setIsEditDialogOpen(false);
      setEditingFlag(null);
      selectFlag(updated);
      setSuccessMessage("Flag updated successfully");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      // Error handling is done in the hook
    }
  };

  const handleEditFlag = (flag: SecurityFlag) => {
    setEditingFlag(flag);
    setIsEditDialogOpen(true);
  };

  const handleDeleteFlag = async (flag: SecurityFlag) => {
    if (!confirm(`Are you sure you want to delete "${flag.title}"?`)) {
      return;
    }

    try {
      await deleteFlag(flag.id);
      setSuccessMessage("Flag deleted successfully");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      // Error handling is done in the hook
    }
  };

  const handleResolveFlag = async (flag: SecurityFlag) => {
    try {
      await updateFlag(flag.id, { status: "resolved" });
      setSuccessMessage("Flag resolved successfully");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      // Error handling is done in the hook
    }
  };

  const handleDismissFlag = async (flag: SecurityFlag) => {
    try {
      await updateFlag(flag.id, { status: "dismissed" });
      setSuccessMessage("Flag dismissed successfully");
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      // Error handling is done in the hook
    }
  };

  return (
    <div
      className={cn("flex h-screen flex-col bg-background", className)}
      role="main"
      aria-label="Team Security Flagging Tool"
    >
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Security Flags</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage team security concerns and potential threats
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              aria-label={ARIA_LABELS.createButton}
            >
              <RefreshCw
                className={cn("size-4 mr-2", isLoading && "animate-spin")}
                aria-hidden="true"
              />
              Refresh
            </Button>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              aria-label={ARIA_LABELS.createButton}
            >
              <Plus className="size-4 mr-2" aria-hidden="true" />
              Create Flag
            </Button>
          </div>
        </div>
      </header>

      {/* Success banner */}
      {successMessage && (
        <div className="px-6 pt-4">
          <SuccessBanner message={successMessage} onClose={() => setSuccessMessage(null)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Filters */}
        <aside
          className="w-64 border-r border-border bg-card p-6 overflow-y-auto"
          aria-label="Filters sidebar"
        >
          <FlagFilters filters={filters} onFiltersChange={setFilters} resultCount={flags.length} />
        </aside>

        {/* Middle - Flag List */}
        <div className="flex-1 overflow-y-auto p-6">
          {error ? (
            <ErrorState error={error} onRetry={refresh} variant="page" />
          ) : isLoading && flags.length === 0 ? (
            <LoadingState variant="list" />
          ) : flags.length === 0 ? (
            <EmptyState
              variant={Object.keys(filters).length > 0 ? "no-results" : "no-flags"}
              onCreateFlag={() => setIsCreateDialogOpen(true)}
              onClearFilters={() => setFilters({})}
            />
          ) : (
            <FlagList flags={flags} selectedId={selectedFlag?.id} onSelect={selectFlag} />
          )}
        </div>

        {/* Right Panel - Detail View */}
        {selectedFlag && (
          <aside
            className="w-96 border-l border-border bg-card overflow-y-auto"
            aria-label="Flag details panel"
          >
            <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-4 z-10">
              <h2 className="text-lg font-semibold text-foreground">Flag Details</h2>
            </div>
            <div className="p-6">
              <FlagDetail
                flag={selectedFlag}
                onEdit={handleEditFlag}
                onDelete={handleDeleteFlag}
                onResolve={handleResolveFlag}
                onDismiss={handleDismissFlag}
              />
            </div>
          </aside>
        )}
      </div>

      {/* Create Flag Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          aria-describedby="create-dialog-description"
        >
          <DialogHeader>
            <DialogTitle>Create Security Flag</DialogTitle>
          </DialogHeader>
          <p id="create-dialog-description" className="text-sm text-muted-foreground mb-4">
            Report a security concern or potential threat for team review.
          </p>
          <FlagForm
            onSubmit={handleCreateFlag}
            onCancel={() => setIsCreateDialogOpen(false)}
            isLoading={isLoading}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Flag Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          aria-describedby="edit-dialog-description"
        >
          <DialogHeader>
            <DialogTitle>Edit Security Flag</DialogTitle>
          </DialogHeader>
          <p id="edit-dialog-description" className="text-sm text-muted-foreground mb-4">
            Update the details of this security flag.
          </p>
          {editingFlag && (
            <FlagForm
              flag={editingFlag}
              onSubmit={handleUpdateFlag}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setEditingFlag(null);
              }}
              isLoading={isLoading}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export all components for flexible usage
export { FlagList, CompactFlagList } from "./components/FlagList";
export { FlagDetail } from "./components/FlagDetail";
export { FlagForm } from "./components/FlagForm";
export { FlagFilters, FilterBadge } from "./components/FlagFilters";
export { EmptyState } from "./states/EmptyState";
export { LoadingState, Spinner } from "./states/LoadingState";
export { ErrorState } from "./states/ErrorState";
export { SuccessState, SuccessBanner } from "./states/SuccessState";
export { useFlagData } from "./hooks/useFlagData";
export { useKeyboard } from "./hooks/useKeyboard";
export * from "./types";
export * from "./constants";
