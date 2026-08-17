export interface SummarySettings {
  length: "short" | "medium" | "long";
  style: "paragraph" | "bullet_points";
  includeKeywords: boolean;
  language: string;
}

export interface PdfProcessingLimits {
  maxFileSizeBytes: number;
  supportedMimeTypes: string[];
}

export interface ToolConfig {
  summarySettings: SummarySettings;
  processingLimits: PdfProcessingLimits;
}
