import type { ConfidentialModeInput, ConfidentialModeResult } from "../types";

export function analyzeConfidentialMode(_input: ConfidentialModeInput): ConfidentialModeResult {
  return {
    score: 100,
    summary: "No confidential mode recommendations available.",
    suggestions: [],
  };
}
