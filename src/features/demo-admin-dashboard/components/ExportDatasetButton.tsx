import { useCallback } from "react";
import type { Draft } from "../types/draft";
import { buildExportFilename, serializeDraftDataset } from "../helpers/datasetExport";

export interface ExportDatasetButtonProps {
  /** Drafts to export. */
  drafts: Draft[];
  /** Optional explicit filename; defaults to a UTC-dated name. */
  filename?: string;
  /** Optional override for the export date used to build the filename. */
  exportDate?: Date;
  /** Force-disable the button. When omitted, it disables on an empty dataset. */
  disabled?: boolean;
  /** Optional class name for styling hooks. */
  className?: string;
  /** Visible button label. */
  label?: string;
  /** Optional callback invoked with the serialized payload. */
  onExport?: (result: { filename: string; json: string }) => void;
}

/**
 * Admin control that serializes the current draft dataset to JSON and triggers
 * a browser download. DOM side effects are guarded so the component is safe to
 * render during SSR or in non-DOM test environments.
 */
export function ExportDatasetButton({
  drafts,
  filename,
  exportDate,
  disabled,
  className,
  label = "Export JSON",
  onExport,
}: ExportDatasetButtonProps) {
  const handleExport = useCallback(() => {
    const json = serializeDraftDataset(drafts);
    const resolvedName = filename ?? buildExportFilename(exportDate ?? new Date());

    onExport?.({ filename: resolvedName, json });

    const hasDom =
      typeof document !== "undefined" &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function";
    if (!hasDom) return;

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = resolvedName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [drafts, filename, exportDate, onExport]);

  const isDisabled = disabled ?? drafts.length === 0;

  return (
    <button type="button" className={className} onClick={handleExport} disabled={isDisabled}>
      {label}
    </button>
  );
}
