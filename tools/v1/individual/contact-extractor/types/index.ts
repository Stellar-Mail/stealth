export interface ExtractedContact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  source: "header" | "signature" | "body";
}

export interface ContactExtractionResult {
  contacts: ExtractedContact[];
  skipped: string[];
}

export interface ExtractionOptions {
  includeBody: boolean;
  dedupe: boolean;
}

export type ViewState = "input" | "loading" | "error" | "empty" | "success";
