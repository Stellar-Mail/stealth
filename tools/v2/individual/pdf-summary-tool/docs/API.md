# PDF Summary Tool - API Reference

Internal API reference for the PDF Summary Tool.

## Table of Contents

- [Services](#services)
- [Hooks](#hooks)
- [Types](#types)
- [Utilities](#utilities)

---

## Services

### pdfProcessing

```typescript
export async function extractText(file: File): Promise<string>;
```

Extract text content from a PDF file using PDF.js.

**Parameters:**

- `file` (File): PDF file object

**Returns:** String containing extracted text

**Throws:**

- Error if file is not a valid PDF
- Error if PDF parsing fails

**Example:**

```typescript
const file = userSelectedFile;
const text = await extractText(file);
console.log(text);
```

---

```typescript
export function validatePDF(file: File): boolean;
```

Validate that a file is a valid PDF.

**Parameters:**

- `file` (File): File to validate

**Returns:** Boolean indicating if file is valid

**Validation checks:**

- File MIME type is 'application/pdf'
- File size is less than 50MB
- File exists and is readable

**Example:**

```typescript
if (!validatePDF(file)) {
  console.error("Invalid PDF file");
}
```

---

### summarization

```typescript
export async function generateSummary(text: string, settings: SummarySettings): Promise<string>;
```

Generate a summary from extracted text using specified settings.

**Parameters:**

- `text` (string): Input text to summarize
- `settings` (SummarySettings): Configuration options

**Settings:**

- `length` ('short' | 'medium' | 'long'): Summary length
- `style` ('bullet-points' | 'paragraph'): Output format
- `includeKeywords` (boolean): Extract keywords
- `language` (string): Language code (e.g., 'en')

**Returns:** Summary string

**Throws:**

- Error if text is too short
- Error if summarization fails

**Example:**

```typescript
const summary = await generateSummary(text, {
  length: "medium",
  style: "bullet-points",
  includeKeywords: true,
  language: "en",
});
```

---

### storage

```typescript
export async function saveSummary(pdfId: string, summary: Summary): Promise<void>;
```

Persist a summary to browser localStorage.

**Parameters:**

- `pdfId` (string): Unique identifier for the PDF
- `summary` (Summary): Summary object to save

**Returns:** Resolves when save completes

**localStorage Key:** `pdf-summary-tool:summaries`

**Example:**

```typescript
const summary: Summary = {
  id: '123',
  pdfId: 'file-1',
  content: 'Summary text...',
  settings: {...},
  generatedAt: new Date(),
};
await saveSummary('file-1', summary);
```

---

```typescript
export async function getSummary(pdfId: string): Promise<Summary | null>;
```

Retrieve a previously saved summary from localStorage.

**Parameters:**

- `pdfId` (string): Unique identifier for the PDF

**Returns:** Summary object or null if not found

**Example:**

```typescript
const saved = await getSummary("file-1");
if (saved) {
  console.log("Found saved summary:", saved.content);
}
```

---

```typescript
export async function listSummaries(): Promise<Summary[]>;
```

Retrieve all saved summaries from localStorage.

**Returns:** Array of all Summary objects

**Example:**

```typescript
const all = await listSummaries();
console.log(`Found ${all.length} summaries`);
```

---

```typescript
export async function deleteSummary(pdfId: string): Promise<void>;
```

Delete a summary from localStorage.

**Parameters:**

- `pdfId` (string): Unique identifier for the PDF to delete

**Returns:** Resolves when delete completes

**Example:**

```typescript
await deleteSummary("file-1");
```

---

## Hooks

### usePDFSummary

```typescript
export function usePDFSummary(file: File | null): {
  summary: Summary | null;
  isLoading: boolean;
  error?: string;
};
```

Manage the complete PDF summarization lifecycle.

**Parameters:**

- `file` (File | null): Selected PDF file

**Returns:**

- `summary` (Summary | null): Generated summary
- `isLoading` (boolean): Processing in progress
- `error` (string): Error message if any

**Behavior:**

- Extracts text from PDF on file change
- Generates summary using current settings
- Persists summary to localStorage
- Clears state when file is null

**Example:**

```typescript
const { summary, isLoading, error } = usePDFSummary(selectedFile);

if (isLoading) return <div>Summarizing...</div>;
if (error) return <div>Error: {error}</div>;
if (summary) return <div>{summary.content}</div>;
```

---

### useSummarySettings

```typescript
export function useSummarySettings(): {
  settings: SummarySettings;
  updateSettings: (settings: SummarySettings) => void;
};
```

Manage user's summary generation preferences.

**Returns:**

- `settings` (SummarySettings): Current settings
- `updateSettings` (function): Update settings function

**Behavior:**

- Loads settings from localStorage on mount
- Persists changes to localStorage
- Syncs across tool components

**Example:**

```typescript
const { settings, updateSettings } = useSummarySettings();

const handleLengthChange = (length: "short" | "medium" | "long") => {
  updateSettings({ ...settings, length });
};
```

---

### useLocalSummaryStorage

```typescript
export function useLocalSummaryStorage(): {
  summaries: Summary[];
  saveSummary: (summary: Summary) => Promise<void>;
  deleteSummary: (id: string) => Promise<void>;
  isLoading: boolean;
};
```

Manage access to local summary storage.

**Returns:**

- `summaries` (Summary[]): All stored summaries
- `saveSummary` (function): Save a summary
- `deleteSummary` (function): Delete a summary
- `isLoading` (boolean): Loading state

**Example:**

```typescript
const { summaries, saveSummary, deleteSummary } = useLocalSummaryStorage();

// List all
summaries.forEach((s) => console.log(s.content));

// Save new
await saveSummary(newSummary);

// Delete
await deleteSummary("summary-id");
```

---

## Types

```typescript
interface PDF {
  id: string; // Generated from file
  name: string; // Filename
  size: number; // File size in bytes
  uploadedAt: Date; // When file was selected
  content?: string; // Extracted text (temporary)
}
```

---

```typescript
interface Summary {
  id: string; // Generated on creation
  pdfId: string; // Reference to PDF
  content: string; // Summary text
  settings: SummarySettings; // Settings used
  generatedAt: Date; // When created
}
```

---

```typescript
interface SummarySettings {
  length: "short" | "medium" | "long"; // Summary length
  style: "bullet-points" | "paragraph"; // Output format
  includeKeywords: boolean; // Extract keywords
  language: string; // Language code (e.g., 'en')
}
```

---

```typescript
interface ValidationResult {
  isValid: boolean; // File is valid
  error?: string; // Error message if not valid
}
```

---

## Utilities

### pdfValidation

```typescript
export function validatePDFFile(file: File): ValidationResult;
```

Validate a PDF file with detailed error information.

**Parameters:**

- `file` (File): File to validate

**Returns:**

- `isValid` (boolean): File is valid
- `error` (string): Error message if invalid

**Checks:**

- MIME type is PDF
- Size <= 50MB
- File is readable

**Example:**

```typescript
const result = validatePDFFile(file);
if (!result.isValid) {
  console.error(result.error);
}
```

---

### textNormalization

```typescript
export function normalizeSummaryText(text: string): string;
```

Clean and normalize summary text.

**Parameters:**

- `text` (string): Input text

**Returns:** Normalized text

**Normalizations:**

- Remove extra whitespace
- Fix punctuation
- Remove HTML entities
- Normalize line breaks

**Example:**

```typescript
const clean = normalizeSummaryText(rawText);
```

---

### textAnalysis

```typescript
export function extractKeywords(text: string, limit?: number): string[];
```

Extract important keywords from text.

**Parameters:**

- `text` (string): Input text
- `limit` (number, optional): Max keywords (default: 5)

**Returns:** Array of keywords

**Algorithm:**

- Frequency analysis
- Filters stop words
- Sorts by relevance

**Example:**

```typescript
const keywords = extractKeywords(summary, 10);
console.log(keywords); // ['pdf', 'summary', ...]
```

---

## Error Handling

All async operations may throw errors:

```typescript
try {
  const text = await extractText(file);
} catch (error) {
  if (error instanceof Error) {
    console.error("Failed to extract:", error.message);
  }
}
```

Common errors:

- `Invalid PDF file` - File is not a valid PDF
- `File too large` - PDF exceeds size limit
- `Extraction failed` - PDF parsing error
- `Summarization failed` - Processing error

---

## localStorage Keys

All data uses prefix `pdf-summary-tool:` to avoid collisions:

- `pdf-summary-tool:summaries` - Array of Summary objects
- `pdf-summary-tool:settings` - Current SummarySettings

---

## Performance Notes

- PDF extraction is CPU-intensive (happens in browser)
- Large PDFs (>20MB) may take several seconds
- Summaries are cached in localStorage for instant retrieval
- Settings are loaded once per session

---

## Versioning

This API is currently **unstable** as the tool is in development. Breaking changes may occur between releases.

For integration with main app, see [FUTURE_INTEGRATION.md](./FUTURE_INTEGRATION.md).
