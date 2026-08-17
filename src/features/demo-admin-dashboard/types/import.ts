import type { DemoDataset } from "./dataset";

/**
 * Types for importing dataset JSON into the demo admin dashboard.
 */

export interface ImportValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ImportResult {
  success: boolean;
  dataset?: DemoDataset;
  errors: ImportValidationError[];
  rawJson?: string;
}

export interface ImportState {
  isImporting: boolean;
  lastResult: ImportResult | null;
}
