import { useState } from "react";
import { Tag, Plus, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { normalizeLabelName, toLabelId } from "../labels/labelNormalization";
import type { DemoMessage } from "../types/dataset";

export interface BulkLabelPanelProps {
  /** The currently selected demo messages to modify. */
  selectedMessages: DemoMessage[];
  /** All available label names in the system. */
  availableLabels: string[];
  /** Callback when labels are applied or removed. */
  onApply: (messageIds: string[], operation: "add" | "remove", labels: string[]) => void;
  /** Optional className for the root element. */
  className?: string;
}

interface LabelState {
  /** Labels that exist on ALL selected messages. */
  common: string[];
  /** Labels that exist on SOME but not all selected messages. */
  partial: string[];
  /** Labels that exist on NONE of the selected messages. */
  available: string[];
}

/**
 * BulkLabelPanel allows admins to add or remove labels across multiple
 * selected demo messages.
 *
 * Features:
 * - Shows labels common to all selected messages
 * - Shows labels present on some messages (partial state)
 * - Allows adding new or existing labels
 * - Handles duplicate label prevention
 * - Provides visual feedback for bulk operations
 */
export function BulkLabelPanel({
  selectedMessages,
  availableLabels,
  onApply,
  className,
}: BulkLabelPanelProps) {
  const [newLabelInput, setNewLabelInput] = useState("");
  const [selectedForAdd, setSelectedForAdd] = useState<Set<string>>(new Set());
  const [selectedForRemove, setSelectedForRemove] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Calculate label distribution across selected messages
  const labelState = calculateLabelState(selectedMessages, availableLabels);

  const handleAddNewLabel = () => {
    const normalized = normalizeLabelName(newLabelInput);
    if (!normalized) {
      showFeedback("error", "Label name cannot be empty");
      return;
    }

    const labelId = toLabelId(normalized);

    // Check if label already exists (case-insensitive)
    const existingLabel = availableLabels.find((label) => toLabelId(label) === labelId);

    if (existingLabel) {
      // Label already exists, toggle it for addition
      toggleLabelForAdd(existingLabel);
      setNewLabelInput("");
      return;
    }

    // Add the new label to selected messages
    const messageIds = selectedMessages.map((msg) => msg.id);
    onApply(messageIds, "add", [normalized]);
    setNewLabelInput("");
    showFeedback("success", `Added label "${normalized}" to ${messageIds.length} message(s)`);
  };

  const toggleLabelForAdd = (label: string) => {
    setSelectedForAdd((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
    // Clear from remove selection if present
    setSelectedForRemove((prev) => {
      const next = new Set(prev);
      next.delete(label);
      return next;
    });
  };

  const toggleLabelForRemove = (label: string) => {
    setSelectedForRemove((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
    // Clear from add selection if present
    setSelectedForAdd((prev) => {
      const next = new Set(prev);
      next.delete(label);
      return next;
    });
  };

  const applyAddLabels = () => {
    if (selectedForAdd.size === 0) {
      showFeedback("error", "No labels selected to add");
      return;
    }

    const messageIds = selectedMessages.map((msg) => msg.id);
    const labelsToAdd = Array.from(selectedForAdd);
    onApply(messageIds, "add", labelsToAdd);
    setSelectedForAdd(new Set());
    showFeedback(
      "success",
      `Added ${labelsToAdd.length} label(s) to ${messageIds.length} message(s)`,
    );
  };

  const applyRemoveLabels = () => {
    if (selectedForRemove.size === 0) {
      showFeedback("error", "No labels selected to remove");
      return;
    }

    const messageIds = selectedMessages.map((msg) => msg.id);
    const labelsToRemove = Array.from(selectedForRemove);
    onApply(messageIds, "remove", labelsToRemove);
    setSelectedForRemove(new Set());
    showFeedback(
      "success",
      `Removed ${labelsToRemove.length} label(s) from ${messageIds.length} message(s)`,
    );
  };

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  if (selectedMessages.length === 0) {
    return (
      <div className={cn("p-6 border rounded-lg bg-muted/20", className)}>
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <Tag className="h-8 w-8 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            No messages selected. Select one or more messages to manage labels.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Bulk Label Management
          </h3>
          <p className="text-sm text-muted-foreground">
            Managing labels for {selectedMessages.length} selected message(s)
          </p>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg border",
            feedback.type === "success"
              ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
          )}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          )}
          <p className="text-sm">{feedback.message}</p>
        </div>
      )}

      {/* Add New Label */}
      <div className="p-4 border rounded-lg space-y-3">
        <Label htmlFor="new-label-input" className="text-sm font-medium">
          Add New Label
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="new-label-input"
            placeholder="Enter label name..."
            value={newLabelInput}
            onChange={(e) => setNewLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddNewLabel();
              }
            }}
            className="flex-1"
          />
          <Button onClick={handleAddNewLabel} disabled={!newLabelInput.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Create a new label and apply it to all selected messages
        </p>
      </div>

      <Separator />

      {/* Common Labels (on all messages) */}
      {labelState.common.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Common Labels ({labelState.common.length})
            </Label>
            {selectedForRemove.size > 0 && (
              <Button onClick={applyRemoveLabels} variant="destructive" size="sm">
                Remove Selected ({selectedForRemove.size})
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            These labels exist on all selected messages
          </p>
          <ScrollArea className="h-32">
            <div className="flex flex-wrap gap-2">
              {labelState.common.map((label) => (
                <Badge
                  key={label}
                  variant={selectedForRemove.has(label) ? "destructive" : "secondary"}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleLabelForRemove(label)}
                >
                  {label}
                  {selectedForRemove.has(label) && <X className="h-3 w-3 ml-1" />}
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Partial Labels (on some messages) */}
      {labelState.partial.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Partial Labels ({labelState.partial.length})
            </Label>
            {(selectedForAdd.size > 0 || selectedForRemove.size > 0) && (
              <div className="flex gap-2">
                {selectedForAdd.size > 0 && (
                  <Button onClick={applyAddLabels} variant="default" size="sm">
                    Add Selected ({selectedForAdd.size})
                  </Button>
                )}
                {selectedForRemove.size > 0 && (
                  <Button onClick={applyRemoveLabels} variant="destructive" size="sm">
                    Remove Selected ({selectedForRemove.size})
                  </Button>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            These labels exist on some but not all selected messages. Click to add to all, or click
            the X to remove from all.
          </p>
          <ScrollArea className="h-32">
            <div className="flex flex-wrap gap-2">
              {labelState.partial.map((label) => {
                const isMarkedForAdd = selectedForAdd.has(label);
                const isMarkedForRemove = selectedForRemove.has(label);
                return (
                  <Badge
                    key={label}
                    variant={
                      isMarkedForAdd ? "default" : isMarkedForRemove ? "destructive" : "outline"
                    }
                    className={cn(
                      "transition-colors",
                      !isMarkedForAdd &&
                        !isMarkedForRemove &&
                        "cursor-pointer border-dashed hover:border-solid",
                    )}
                    onClick={() => {
                      if (!isMarkedForAdd && !isMarkedForRemove) {
                        toggleLabelForAdd(label);
                      } else if (isMarkedForAdd) {
                        setSelectedForAdd((prev) => {
                          const next = new Set(prev);
                          next.delete(label);
                          return next;
                        });
                      }
                    }}
                  >
                    {label}
                    {isMarkedForAdd ? (
                      <CheckCircle2 className="h-3 w-3 ml-1" />
                    ) : isMarkedForRemove ? (
                      <X className="h-3 w-3 ml-1" />
                    ) : (
                      <button
                        type="button"
                        className="ml-1 hover:text-destructive focus:outline-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLabelForRemove(label);
                        }}
                        aria-label={`Remove ${label} from all selected`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      <Separator />

      {/* Available Labels (not on any selected message) */}
      {labelState.available.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Available Labels ({labelState.available.length})
            </Label>
            {selectedForAdd.size > 0 && (
              <Button onClick={applyAddLabels} variant="default" size="sm">
                Add Selected ({selectedForAdd.size})
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Click labels to select them for bulk addition
          </p>
          <ScrollArea className="h-32">
            <div className="flex flex-wrap gap-2">
              {labelState.available.map((label) => (
                <Badge
                  key={label}
                  variant={selectedForAdd.has(label) ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleLabelForAdd(label)}
                >
                  {label}
                  {selectedForAdd.has(label) && <CheckCircle2 className="h-3 w-3 ml-1" />}
                </Badge>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {labelState.available.length === 0 &&
        labelState.common.length === 0 &&
        labelState.partial.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No labels available. Create a new label above to get started.
          </div>
        )}
    </div>
  );
}

/**
 * Calculate which labels are common, partial, or available across selected messages.
 */
export function calculateLabelState(
  selectedMessages: DemoMessage[],
  availableLabels: string[],
): LabelState {
  if (selectedMessages.length === 0) {
    return {
      common: [],
      partial: [],
      available: [
        ...new Set(availableLabels.map((label) => normalizeLabelName(label)).filter(Boolean)),
      ].sort(),
    };
  }

  const totalMessages = selectedMessages.length;
  const labelDisplayMap = new Map<string, string>();
  const labelCountMap = new Map<string, number>();
  const labelIdSet = new Set<string>();

  const registerLabel = (rawLabel: string) => {
    const normalized = normalizeLabelName(rawLabel);
    if (!normalized) {
      return;
    }

    const id = toLabelId(normalized);
    if (!id) {
      return;
    }

    if (!labelDisplayMap.has(id)) {
      labelDisplayMap.set(id, normalized);
    }
    labelIdSet.add(id);
  };

  for (const message of selectedMessages) {
    const seenInMessage = new Set<string>();
    for (const label of message.labels) {
      const normalized = normalizeLabelName(label);
      const id = toLabelId(normalized);
      if (!normalized || !id || seenInMessage.has(id)) {
        continue;
      }
      seenInMessage.add(id);
      registerLabel(normalized);
      labelCountMap.set(id, (labelCountMap.get(id) ?? 0) + 1);
    }
  }

  for (const label of availableLabels) {
    registerLabel(label);
  }

  const common: string[] = [];
  const partial: string[] = [];
  const available: string[] = [];

  for (const id of labelIdSet) {
    const count = labelCountMap.get(id) ?? 0;
    const display = labelDisplayMap.get(id) ?? id;

    if (count === totalMessages) {
      common.push(display);
    } else if (count > 0) {
      partial.push(display);
    } else {
      available.push(display);
    }
  }

  common.sort((a, b) => a.localeCompare(b));
  partial.sort((a, b) => a.localeCompare(b));
  available.sort((a, b) => a.localeCompare(b));

  return { common, partial, available };
}
